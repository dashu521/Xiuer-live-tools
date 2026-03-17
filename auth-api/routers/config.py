"""用户配置同步 API：GET /config, POST /config/sync"""
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from models import User, UserConfig
from schemas import (
    GetUserConfigResponse,
    SyncConfigRequest,
    SyncConfigResponse,
    UserConfigData,
)

router = APIRouter(prefix="/config", tags=["config"])


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
    
    user_config = db.query(UserConfig).filter(UserConfig.user_id == current_user.id).first()
    
    if user_config:
        user_config.config_json = config_dict
        user_config.updated_at = datetime.utcnow()
    else:
        user_config = UserConfig(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            config_json=config_dict,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(user_config)
    
    db.commit()
    
    logger.info(f"[Config] User {current_user.id} synced config successfully")
    
    return SyncConfigResponse(
        success=True,
        message="配置同步成功",
        synced_at=datetime.utcnow().isoformat(),
    )
