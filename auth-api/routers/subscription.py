"""GET /subscription/status：订阅状态查询，需 Bearer Token，仅允许查自己。
对齐真相：users(id,username,password,is_disabled)；subscriptions(user_id,current_period_end INT,plan,updated_at)。
DB 连接使用 DB_PATH，默认 /data/users.db。
"""
import logging
import time
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user
from models import User
from schemas import err_forbidden, err_user_not_found
from subscription_rules import normalize_plan

router = APIRouter(prefix="/subscription", tags=["subscription"])
logger = logging.getLogger(__name__)


def _username_of(user: User) -> str:
    """token 对应用户的登录标识：user.email 或 user.phone 或 str(user.id)"""
    return user.email or user.phone or str(user.id)


def _to_unix_timestamp(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, datetime):
        return int(value.timestamp())
    if isinstance(value, str):
        try:
            return int(float(value))
        except ValueError:
            normalized = value.replace("Z", "+00:00")
            return int(datetime.fromisoformat(normalized).timestamp())
    raise ValueError(f"Unsupported period end value: {value!r}")


@router.get("/status")
def subscription_status(
    username: str = Query(..., description="要查询的用户名（仅允许查自己）"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    必须 Authorization: Bearer <token>。
    只能查自己：username 必须等于 user.email 或 user.phone 或 str(user.id)，否则 403。
    users 不存在则 404；subscriptions 无记录则 expired=true, current_period_end=0, plan=trial。
    """
    token_username = _username_of(user)
    if username != token_username:
        raise HTTPException(status_code=403, detail=err_forbidden("无权查询其他用户状态"))

    # a) 查 users：按 username/email/phone/id，取 is_disabled；不存在 404
    target = db.query(User).filter(
        or_(User.username == username, User.email == username, User.phone == username, User.id == username)
    ).first()
    if not target:
        raise HTTPException(
            status_code=404,
            detail=err_user_not_found(),
        )
    # is_disabled：表有 is_disabled 列则用，否则用 status 映射
    is_disabled = 0
    if getattr(target, "is_disabled", None) is not None:
        is_disabled = 1 if target.is_disabled else 0
    else:
        is_disabled = 1 if (target.status or "").lower() == "disabled" else 0

    # b) 查 subscriptions：表结构 user_id(PK), current_period_end(INT unix), plan(TEXT)
    now_ts = int(time.time())
    try:
        row = db.execute(
            text("SELECT current_period_end, plan FROM subscriptions WHERE user_id = :u"),
            {"u": target.id},
        ).fetchone()
    except Exception:
        logger.exception("subscription status query failed", extra={"user_id": target.id})
        row = None
    if not row:
        return {
            "success": True,
            "username": username,
            "is_disabled": is_disabled,
            "plan": "trial",
            "current_period_end": 0,
            "expired": True,
        }
    current_period_end = _to_unix_timestamp(row[0])
    plan = normalize_plan(row[1], default="trial")
    expired = current_period_end < now_ts

    return {
        "success": True,
        "username": username,
        "is_disabled": is_disabled,
        "plan": plan,
        "current_period_end": current_period_end,
        "expired": expired,
    }
