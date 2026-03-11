"""POST /register, /login（无 /auth 前缀）；/refresh, /status, /trial/*"""
import hashlib
import logging
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database import get_db, is_mysql
from deps import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_current_user,
    hash_password,
    security,
    verify_password,
)
from models import RefreshToken, Subscription, User
from schemas import (
    AuthResponse,
    ChangePasswordBody,
    ErrorDetail,
    LoginBody,
    LoginResponse,
    RefreshBody,
    RefreshResponse,
    RegisterBody,
    SetPasswordBody,
    TrialOut,
    UserOut,
    UserStatusResponse,
    err_account_exists,
    err_invalid_params,
    err_wrong_password,
    err_token_invalid,
)

router = APIRouter(prefix="", tags=["auth"])


def is_email(s: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", s))


def is_phone(s: str) -> bool:
    return bool(re.match(r"^1[3-9]\d{9}$", s))


def token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def build_user_status_response(user: User, db: Optional[Session] = None) -> UserStatusResponse:
    """拼装 /auth/status 返回结构（含 plan、trial）。
    优先级：正式订阅(subscription) > 试用(trial) > 免费(free)
    """
    username = user.email or user.phone or user.id
    trial: Optional[TrialOut] = None
    
    # 1. 首先检查正式订阅（优先级最高）
    plan = "free"
    if db is not None:
        try:
            # 查询 subscriptions 表获取正式订阅
            sub_row = db.execute(
                text("SELECT plan, current_period_end FROM subscriptions WHERE user_id = :u"),
                {"u": user.id},
            ).fetchone()
            if sub_row and sub_row[0]:
                sub_plan = sub_row[0].strip().lower()
                sub_end_ts = int(sub_row[1]) if sub_row[1] else 0
                now_ts = int(time.time())
                # 正式订阅未过期
                if sub_end_ts > now_ts:
                    plan = sub_plan
        except Exception:
            pass
    
    # 2. 如果没有正式订阅，检查试用状态
    if plan == "free" and db is not None:
        try:
            row = db.execute(
                text("SELECT start_ts, end_ts FROM trials WHERE username = :u"),
                {"u": user.id},
            ).fetchone()
        except Exception:
            row = None
        if row and row[0] is not None and row[1] is not None:
            start_ts, end_ts = row[0], row[1]
            now_ts = int(time.time())
            is_active = end_ts > now_ts
            is_expired = end_ts <= now_ts
            trial = TrialOut(
                start_at=datetime.utcfromtimestamp(start_ts).isoformat() + "Z" if start_ts else None,
                end_at=datetime.utcfromtimestamp(end_ts).isoformat() + "Z" if end_ts else None,
                is_active=is_active,
                is_expired=is_expired,
            )
            if is_active:
                plan = "trial"
        else:
            trial = TrialOut(is_active=False, is_expired=False)
    
    # 3. 如果没有数据库连接，尝试从 user 对象获取
    if plan == "free":
        user_plan = getattr(user, "plan", None)
        if user_plan and user_plan.lower() in ["pro", "pro_max", "ultra"]:
            plan = user_plan.lower()
        else:
            # 检查试用
            trial_start_at = getattr(user, "trial_start_at", None)
            trial_end_at = getattr(user, "trial_end_at", None)
            now = datetime.utcnow()
            end_dt = trial_end_at
            is_active = end_dt is not None and now < end_dt
            is_expired = end_dt is not None and now >= end_dt
            trial = TrialOut(
                start_at=trial_start_at.isoformat() if trial_start_at else None,
                end_at=trial_end_at.isoformat() if trial_end_at else None,
                is_active=is_active,
                is_expired=is_expired,
            )
            if is_active:
                plan = "trial"

    has_password = not verify_password("!", user.password_hash)
    max_accounts = getattr(user, "max_accounts", 1)

    return UserStatusResponse(
        username=username,
        status=user.status or "active",
        plan=plan,
        max_accounts=max_accounts,
        has_password=has_password,
        created_at=user.created_at.isoformat() if user.created_at else None,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        trial=trial,
    )


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    try:
        identifier = (body.username or "").strip()
        if not identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_invalid_params("请输入手机号或邮箱"),
            )
        if not is_email(identifier) and not is_phone(identifier):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_invalid_params("请输入有效的手机号或邮箱"),
            )

        # 查重：email / phone / username 任一已存在则拒绝（避免 UNIQUE constraint 500）
        existing = (
            db.query(User).filter(User.email == identifier).first()
            or db.query(User).filter(User.phone == identifier).first()
            or db.query(User).filter(User.username == identifier).first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err_account_exists(),
            )