"""用户配置同步 API：GET /config, POST /config/sync"""
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db, is_mysql
from deps import get_current_user
from models import User, UserConfig
from schemas import (
    GetUserConfigResponse,
    SyncConfigRequest,
    SyncConfigResponse,
    UserConfigData,
)

router = APIRouter(prefix="/config", tags=["config"])


def _upsert_user_config(db: Session, user_id: str, config_dict: dict) -> datetime:
    now = datetime.utcnow()
    values = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "config_json": config_dict,
        "created_at": now,
        "updated_at": now,
    }
    dialect_name = db.bind.dialect.name if db.bind else ""

    if is_mysql() or dialect_name == "mysql":
        stmt = mysql_insert(UserConfig).values(**values)
        stmt = stmt.on_duplicate_key_update(
            config_json=stmt.inserted.config_json,
            updated_at=now,
        )
        db.execute(stmt)
        return now

    if dialect_name == "sqlite":
        stmt = sqlite_insert(UserConfig).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[UserConfig.user_id],
            set_={
                "config_json": stmt.excluded.config_json,
                "updated_at": now,
            },
        )
        db.execute(stmt)
        return now

    user_config = db.query(UserConfig).filter(UserConfig.user_id == user_id).first()
    if user_config:
        user_config.config_json = config_dict
        user_config.updated_at = now
    else:
        db.add(UserConfig(**values))
    return now


def _update_after_conflict(db: Session, user_id: str, config_dict: dict) -> datetime:
    now = datetime.utcnow()
    db.query(UserConfig).filter(UserConfig.user_id == user_id).update(
        {
            UserConfig.config_json: config_dict,
            UserConfig.updated_at: now,
        },
        synchronize_session=False,
    )
    return now


@router.get("", response_model=GetUserConfigResponse)
def get_user_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /config：获取当前用户的配置数据（用于跨设备同步）"""
    user_config = db.query(UserConfig).filter(UserConfig.user_id == current_user.id).first()
    
    if not user_config:
        return GetUserConfigResponse(
            success=True,
            config=None,
            version=1,
            updated_at=None,
        )
    
    config_data = user_config.config_json or {}
    
    return GetUserConfigResponse(
        success=True,
        config=UserConfigData(**config_data) if config_data else None,
        version=1,
        updated_at=user_config.updated_at.isoformat() if user_config.updated_at else None,
    )


@router.post("/sync", response_model=SyncConfigResponse)
def sync_user_config(
    body: SyncConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """POST /config/sync：同步用户配置数据到云端（用于跨设备同步）"""
    config_dict = body.config.model_dump(exclude_none=True)

    try:
        synced_at = _upsert_user_config(db, current_user.id, config_dict)
        db.commit()
    except IntegrityError:
        # 并发首次写入时，个别数据库仍可能抛唯一键错误；回滚后退化为更新即可。
        db.rollback()
        synced_at = _update_after_conflict(db, current_user.id, config_dict)
        db.commit()
    except Exception:
        db.rollback()
        raise
    
    logger.info(f"[Config] User {current_user.id} synced config successfully")
    
    return SyncConfigResponse(
        success=True,
        message="配置同步成功",
        synced_at=synced_at.isoformat(),
    )
