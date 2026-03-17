"""Auth API 配置：从环境变量读取，便于阿里云/本地部署"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库：阿里云 RDS 或本地 MySQL / SQLite（如 sqlite:////data/users.db）
    # 生产环境必须从环境变量读取，不提供默认值
    DATABASE_URL: str = ""
    # SQLite 时可选：DB_PATH 默认 /data/users.db，与容器挂载一致
    DB_PATH: str = "/data/users.db"
    # JWT - 生产环境必须从环境变量读取
    JWT_SECRET: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # 管理员（/admin/* 鉴权）- 生产环境必须从环境变量读取
    ADMIN_USERNAME: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_JWT_SECRET: str = ""  # 空则复用 JWT_SECRET
    # CORS：先放开 * 测通，生产可改为 Electron 或具体域名
    CORS_ORIGINS: str = "*"
    # 短信服务配置
    SMS_CODE_EXPIRE_MINUTES: int = 5
    SMS_CODE_MAX_ATTEMPTS_PER_HOUR: int = 10
    SMS_CODE_RATE_LIMIT_MINUTES: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
# 支持从环境变量覆盖
if os.getenv("DATABASE_URL"):
    settings.DATABASE_URL = os.getenv("DATABASE_URL")
if os.getenv("DB_PATH"):
    settings.DB_PATH = os.getenv("DB_PATH")
# 当显式设置 DB_PATH 时，使用 SQLite 连接该路径（容器内 /data/users.db）
if os.getenv("DB_PATH"):
    p = os.getenv("DB_PATH").strip()
    settings.DATABASE_URL = "sqlite:///" + (p if p.startswith("/") else "/" + p)
if os.getenv("JWT_SECRET"):
    settings.JWT_SECRET = os.getenv("JWT_SECRET")
if os.getenv("ADMIN_USERNAME"):
    settings.ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
if os.getenv("ADMIN_PASSWORD"):
    settings.ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if os.getenv("ADMIN_JWT_SECRET"):
    settings.ADMIN_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET")

# [SECURITY] 生产环境强制检查 SMS_MODE，禁止 fallback 到 dev 模式
ENV = os.getenv("ENV", "development").lower()
SMS_MODE = os.getenv("SMS_MODE", "dev").strip().lower()
if ENV == "production":
    if SMS_MODE not in ["aliyun_dypns", "aliyun"]:
        raise ValueError(
            f"[SECURITY] 生产环境 SMS_MODE 必须是 'aliyun_dypns' 或 'aliyun'，"
            f"当前值为 '{SMS_MODE}'。请正确配置环境变量后重启服务。"
        )