"""POST /register, /login（无 /auth 前缀）；/refresh, /status, /trial/*"""
import hashlib
import logging
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
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
    
    【P0-1 会员规则对齐】优先级：正式订阅(subscription) > 试用(trial) > 免费(free)
    
    1. 优先查询 subscriptions 表（正式订阅）
    2. 其次查询 trials 表（试用）
    3. 最后兜底 user 表字段
    
    确保 Pro/ProMax/Ultra 不会被 trial 逻辑覆盖
    """
    username = user.email or user.phone or user.id
    plan = "free"
    expire_at = None
    trial: Optional[TrialOut] = None
    
    if db is not None:
        now_ts = int(time.time())
        now = datetime.utcnow()
        
        # 【第1优先级】检查正式订阅 subscriptions 表
        try:
            sub_row = db.execute(
                text("SELECT plan, current_period_end FROM subscriptions WHERE user_id = :u ORDER BY current_period_end DESC LIMIT 1"),
                {"u": user.id},
            ).fetchone()
            if sub_row and sub_row[0]:
                sub_plan = sub_row[0].strip().lower()
                sub_end_dt = sub_row[1]
                # 检查订阅是否过期
                if sub_end_dt and sub_end_dt > now:
                    plan = sub_plan
                    expire_at = sub_end_dt
        except Exception as e:
            logger.debug(f"查询 subscriptions 表失败: {e}")
        
        # 【第2优先级】如果没有正式订阅，检查试用 trials 表
        if plan == "free":
            try:
                row = db.execute(
                    text("SELECT start_ts, end_ts FROM trials WHERE username = :u"),
                    {"u": user.id},
                ).fetchone()
                if row and row[0] is not None and row[1] is not None:
                    start_ts, end_ts = row[0], row[1]
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
            except Exception as e:
                logger.debug(f"查询 trials 表失败: {e}")
                trial = TrialOut(is_active=False, is_expired=False)
    
    # 【第3优先级】兜底：从 user 对象获取（无数据库连接时）
    if plan == "free":
        user_plan = getattr(user, "plan", None)
        if user_plan and user_plan.lower() in ["pro", "pro_max", "ultra"]:
            plan = user_plan.lower()
            # 从 user 表获取过期时间
            user_expire = getattr(user, "expire_at", None)
            if user_expire:
                expire_at = user_expire
        
        # 检查试用（从 user 表字段）
        if plan == "free" and trial is None:
            trial_start_at = getattr(user, "trial_start_at", None)
            trial_end_at = getattr(user, "trial_end_at", None)
            if trial_end_at:
                is_active = trial_end_at > datetime.utcnow()
                is_expired = not is_active
                trial = TrialOut(
                    start_at=trial_start_at.isoformat() if trial_start_at else None,
                    end_at=trial_end_at.isoformat() if trial_end_at else None,
                    is_active=is_active,
                    is_expired=is_expired,
                )
                if is_active:
                    plan = "trial"
            else:
                trial = TrialOut(is_active=False, is_expired=False)
    
    # 确保 trial 对象不为 None
    if trial is None:
        trial = TrialOut(is_active=False, is_expired=False)
    
    # 如果有正式订阅，trial.is_active 应该为 false
    if plan in ["pro", "pro_max", "ultra"]:
        trial = TrialOut(is_active=False, is_expired=trial.is_expired, start_at=trial.start_at, end_at=trial.end_at)

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


# ----- POST /login：密码登录 -----
@router.post("/login", response_model=AuthResponse)
def login(body: LoginBody, db: Session = Depends(get_db)):
    """密码登录（手机号/邮箱 + 密码）"""
    identifier = (body.username or "").strip()
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_invalid_params("请输入手机号或邮箱"),
        )

    # 查找用户
    user = (
        db.query(User).filter(User.email == identifier).first()
        or db.query(User).filter(User.phone == identifier).first()
        or db.query(User).filter(User.username == identifier).first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_wrong_password(),
        )

    # 检查账号状态
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "account_disabled", "message": "账号已被禁用，请联系客服"},
        )

    # 验证密码
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_wrong_password(),
        )

    # 生成 token
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # 保存 refresh_token
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    expires_at = datetime.utcnow() + timedelta(days=7)
    db.add(RefreshToken(
        id=str(uuid.uuid4()),
        token_hash=token_hash,
        user_id=user.id,
        expires_at=expires_at,
        created_at=datetime.utcnow(),
    ))

    # 更新最后登录时间
    user.last_login_at = datetime.utcnow()
    db.commit()

    return AuthResponse(
        user=UserOut(
            id=user.id,
            email=user.email,
            phone=user.phone,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            status=user.status,
        ),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
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

        # 创建用户
        user_id = str(uuid.uuid4())
        now = datetime.utcnow()
        password_hash = hash_password(body.password)

        # 判断是邮箱还是手机
        email = identifier if is_email(identifier) else None
        phone = identifier if is_phone(identifier) else None

        user = User(
            id=user_id,
            username=identifier,
            email=email,
            phone=phone,
            password_hash=password_hash,
            created_at=now,
            updated_at=now,
            status="active",
            plan="free",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # 创建默认订阅记录
        try:
            from sqlalchemy import text as sa_text
            _sub_sql = (
                "INSERT IGNORE INTO subscriptions (id, user_id, plan, status) "
                "VALUES (:sid, :uid, 'free', 'active')"
            ) if is_mysql() else (
                "INSERT OR IGNORE INTO subscriptions (id, user_id, plan, status) "
                "VALUES (:sid, :uid, 'free', 'active')"
            )
            db.execute(sa_text(_sub_sql), {"sid": str(uuid.uuid4()), "uid": str(user.id)})
            db.commit()
        except Exception:
            db.rollback()

        # 生成 token
        token = create_access_token(user_id)
        refresh_raw = create_refresh_token(user_id)
        refresh_hashed = token_hash(refresh_raw)
        expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

        try:
            from sqlalchemy import text as sa_text
            db.execute(
                sa_text(
                    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) "
                    "VALUES (:rid, :uid, :th, :ea)"
                ),
                {"rid": str(uuid.uuid4()), "uid": user_id, "th": refresh_hashed, "ea": expires_at},
            )
            db.commit()
        except Exception:
            db.rollback()

        return AuthResponse(
            user=UserOut(
                id=user_id,
                email=email,
                phone=phone,
                created_at=now,
                last_login_at=None,
                status="active",
            ),
            access_token=token,
            refresh_token=refresh_raw,
            token_type="bearer",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[Auth] Register error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "internal_error", "message": "注册失败，请稍后重试"},
        )


# ----- POST /set-password：SMS 注册用户首次设置密码 -----
@router.post("/set-password")
def set_password(
    body: SetPasswordBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """SMS 注册用户首次设置密码（需要登录状态）"""
    # 检查用户当前是否无密码（使用默认密码 "!"）
    if verify_password("!", current_user.password_hash):
        # 可以设置密码
        current_user.password_hash = hash_password(body.password)
        db.commit()
        return {"ok": True, "message": "密码设置成功"}
    else:
        # 用户已有密码，不能通过此接口设置
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "password_exists", "message": "用户已设置密码，请使用修改密码功能"},
        )


# ----- POST /change-password：已有密码的用户修改密码 -----
@router.post("/change-password")
def change_password(
    body: ChangePasswordBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """已有密码的用户修改密码（需要登录状态）"""
    # 验证旧密码
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "wrong_password", "message": "旧密码错误"},
        )
    
    # 设置新密码
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True, "message": "密码修改成功"}


# ----- GET /status：获取当前用户状态 -----
@router.get("/status", response_model=UserStatusResponse)
def get_user_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /status：获取当前登录用户的完整状态（含会员等级、试用状态等）"""
    return build_user_status_response(current_user, db)


# ----- POST /refresh：刷新 access_token -----
@router.post("/refresh", response_model=RefreshResponse)
def refresh_token(
    body: RefreshBody,
    db: Session = Depends(get_db),
):
    """POST /refresh：使用 refresh_token 获取新的 access_token"""
    # 验证 refresh_token
    payload = decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_refresh_token", "message": "刷新令牌无效或已过期"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_token", "message": "令牌格式错误"},
        )
    
    # 验证 token 是否存在于数据库
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    refresh_record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if not refresh_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "token_revoked", "message": "刷新令牌已失效"},
        )
    
    # 生成新的 access_token
    new_access_token = create_access_token(user_id)
    
    return RefreshResponse(
        access_token=new_access_token,
        token_type="bearer"
    )


# ----- POST /trial/start：开通试用 -----
@router.post("/trial/start")
def start_trial(
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """POST /trial/start：为用户开通 7 天试用"""
    # 检查用户是否已有有效订阅
    existing_sub = db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.current_period_end > datetime.utcnow()
    ).first()
    
    if existing_sub and existing_sub.plan in ["pro", "pro_max", "ultra"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "already_paid", "message": "您已是付费会员，无需试用"},
        )
    
    # 检查是否已有试用记录
    existing_trial = db.execute(
        text("SELECT end_ts FROM trials WHERE username = :u"),
        {"u": current_user.id}
    ).fetchone()
    
    if existing_trial and existing_trial[0] > int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "trial_active", "message": "您已有有效试用"},
        )
    
    # 创建试用记录（7天）
    now_ts = int(time.time())
    end_ts = now_ts + 7 * 24 * 60 * 60  # 7天后
    
    db.execute(
        text("""
            INSERT INTO trials (username, start_ts, end_ts) 
            VALUES (:u, :s, :e)
            ON DUPLICATE KEY UPDATE start_ts = :s, end_ts = :e
        """),
        {"u": current_user.id, "s": now_ts, "e": end_ts}
    )
    db.commit()
    
    return {
        "success": True,
        "start_ts": now_ts,
        "end_ts": end_ts
    }


# ----- GET /trial/status：查询试用状态 -----
@router.get("/trial/status")
def get_trial_status(
    username: str = Query(..., description="用户名"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /trial/status：查询用户的试用状态"""
    # 只能查询自己的状态
    if username != current_user.id and username != current_user.username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "无权查询其他用户状态"},
        )
    
    row = db.execute(
        text("SELECT start_ts, end_ts FROM trials WHERE username = :u"),
        {"u": current_user.id}
    ).fetchone()
    
    if not row:
        return {"has_trial": False, "active": False}
    
    start_ts, end_ts = row
    now_ts = int(time.time())
    is_active = end_ts > now_ts
    
    return {
        "has_trial": True,
        "active": is_active,
        "start_ts": start_ts,
        "end_ts": end_ts
    }


# ----- GET /server-time：获取服务器时间 -----
@router.get("/server-time")
def get_server_time():
    """GET /server-time：获取服务器当前时间戳（秒）"""
    return {"server_time": int(time.time())}