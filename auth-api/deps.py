"""JWT 与依赖：access_token 解析、get_current_user、refresh 校验；管理员 admin token 与审计日志"""
import json
import logging
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User

security = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)

# 管理员 JWT 使用独立 secret（空则复用 JWT_SECRET）
def _admin_jwt_secret() -> str:
    return (settings.ADMIN_JWT_SECRET or settings.JWT_SECRET).strip() or settings.JWT_SECRET


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    """JWT with type=refresh，与 login 相同 SECRET+算法，较长有效期（如 7d）"""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def token_hash(raw: str) -> str:
    """对 refresh_token 做稳定哈希，便于持久化与查找。"""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def decode_refresh_token(token: str) -> Optional[str]:
    """校验 refresh_token（type=refresh），成功返回 sub（user_id）"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    user = db.query(User).filter(
        (User.id == user_id) | (User.username == user_id)
    ).first()
    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    now = datetime.utcnow()
    if not user.last_active_at or (now - user.last_active_at).total_seconds() > 60:
        try:
            user.last_active_at = now
            db.commit()
        except Exception:
            db.rollback()
    return user


def err_token_invalid() -> dict:
    return {"code": "token_invalid", "message": "token 失效或已过期"}


# ----- 管理员 JWT（type=admin） -----
ADMIN_TOKEN_EXPIRE_HOURS = 24


def create_admin_token() -> str:
    """签发管理员 JWT，sub=ADMIN_USERNAME，type=admin。"""
    expire = datetime.utcnow() + timedelta(hours=ADMIN_TOKEN_EXPIRE_HOURS)
    payload = {"sub": settings.ADMIN_USERNAME, "exp": expire, "type": "admin"}
    return jwt.encode(payload, _admin_jwt_secret(), algorithm="HS256")


def decode_admin_token(token: str) -> Optional[str]:
    """校验 admin token，成功返回 sub（管理员名）。"""
    try:
        payload = jwt.decode(token, _admin_jwt_secret(), algorithms=["HS256"])
        if payload.get("type") != "admin":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """依赖：仅当 Bearer 为有效 admin token 时通过，返回管理员用户名。"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "admin_unauthorized", "message": "需要管理员 token"},
        )
    admin_sub = decode_admin_token(credentials.credentials)
    if not admin_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "admin_unauthorized", "message": "管理员 token 无效或已过期"},
        )
    return admin_sub


# ----- 审计日志（脱敏） -----
def _mask_response(obj: Any) -> Any:
    """对 response 中 password/token 等字段脱敏。"""
    if obj is None:
        return None
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            key_lower = (k or "").lower()
            if any(x in key_lower for x in ("password", "token", "secret", "refresh_token", "access_token")):
                out[k] = "***"
            else:
                out[k] = _mask_response(v)
        return out
    if isinstance(obj, list):
        return [_mask_response(x) for x in obj]
    return obj


def auth_audit_log(
    request_id: str,
    url: str,
    action: str,
    target_user: Optional[str],
    status: str,
    response: Any,
) -> None:
    """写入审计日志到 logger + 数据库。"""
    try:
        masked = _mask_response(response)
        if isinstance(masked, (dict, list)):
            response_str = json.dumps(masked, ensure_ascii=False, default=str)
        else:
            response_str = str(masked)
    except Exception:
        response_str = "<serialize_error>"
    logger.info(
        "[AUTH-AUDIT] requestId=%s url=%s action=%s targetUser=%s status=%s response=%s",
        request_id, url, action, target_user or "", status, response_str,
    )
    try:
        from database import SessionLocal
        from models import AuditLog
        db = SessionLocal()
        try:
            db.add(AuditLog(
                request_id=request_id,
                url=url,
                action=action,
                target_user=target_user,
                status=status,
                response=response_str[:2048] if response_str else None,
            ))
            db.commit()
        finally:
            db.close()
    except Exception:
        pass
