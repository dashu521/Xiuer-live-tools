"""数据表：users, refresh_tokens, subscriptions, sms_codes, gift_cards, gift_card_redemptions"""
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Boolean, Integer, Float
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    phone = Column(String(32), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    last_active_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="active")
    plan = Column(String(32), default="free")
    trial_start_at = Column(DateTime, nullable=True)
    trial_end_at = Column(DateTime, nullable=True)

    # 账号数量限制（新增）
    max_accounts = Column(Integer, default=1)  # 默认允许1个账号
    trial_used = Column(Integer, default=0)    # 是否已使用过试用

    refresh_tokens = relationship("RefreshToken", back_populates="user")
    subscription = relationship("Subscription", back_populates="user", uselist=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    plan = Column(String(32), default="free")
    status = Column(String(20), default="active")
    current_period_end = Column(DateTime, nullable=True)
    features_json = Column(JSON, nullable=True)

    user = relationship("User", back_populates="subscription")


class SMSCode(Base):
    """短信验证码表"""
    __tablename__ = "sms_codes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String(32), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expire_at = Column(Integer, nullable=False)
    created_at = Column(Integer, nullable=False)
    used = Column(Integer, default=0)
    date_str = Column(String(8), nullable=False, index=True)  # 格式：YYYYMMDD，用于单日限制


class GiftCard(Base):
    __tablename__ = "gift_cards"

    id = Column(String(36), primary_key=True, index=True)
    code = Column(String(14), unique=True, nullable=False, index=True)
    type = Column(String(20), default="membership")

    # 礼品卡档位（新增）: pro/pro_max/ultra
    tier = Column(String(20), nullable=True)

    # 权益配置（JSON格式，便于扩展）
    benefits_json = Column(JSON, nullable=True, default=lambda: {
        "max_accounts": 1,
        "features": ["all"],
        "duration_days": None
    })

    membership_type = Column(String(20), nullable=True)  # 保留兼容
    membership_days = Column(Integer, default=0)         # 保留兼容
    status = Column(String(20), default="active", index=True)
    batch_id = Column(String(36), nullable=True, index=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    redeemed_at = Column(DateTime, nullable=True)
    redeemed_by = Column(String(36), nullable=True)

    redemptions = relationship("GiftCardRedemption", back_populates="gift_card")


class GiftCardRedemption(Base):
    __tablename__ = "gift_card_redemptions"

    id = Column(String(36), primary_key=True, index=True)
    gift_card_id = Column(String(36), ForeignKey("gift_cards.id"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    redeemed_at = Column(DateTime, default=datetime.utcnow)
    previous_plan = Column(String(32), nullable=True)
    new_plan = Column(String(32), nullable=True)
    previous_expiry_ts = Column(Integer, nullable=True)
    new_expiry_ts = Column(Integer, nullable=True)

    gift_card = relationship("GiftCard", back_populates="redemptions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(36), index=True)
    url = Column(String(512), nullable=True)
    action = Column(String(64), index=True)
    target_user = Column(String(255), nullable=True)
    status = Column(String(20))
    response = Column(String(2048), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserConfig(Base):
    """用户配置数据表 - 用于跨设备同步"""
    __tablename__ = "user_configs"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)

    config_json = Column(JSON, nullable=False, default=lambda: {})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="config")


class Feedback(Base):
    """用户反馈表"""
    __tablename__ = "feedbacks"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String(100), nullable=True, index=True)
    contact = Column(String(100), nullable=True)
    category = Column(String(32), nullable=False)  # 问题类型
    content = Column(String(2000), nullable=False)  # 问题描述
    platform = Column(String(32), nullable=True)  # 当前平台
    app_version = Column(String(32), nullable=True)  # 软件版本
    os_info = Column(String(100), nullable=True)  # 操作系统信息
    diagnostic_info = Column(JSON, nullable=True)  # 诊断信息摘要
    status = Column(String(20), default="pending", index=True)  # pending/processing/resolved/closed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="feedbacks")
