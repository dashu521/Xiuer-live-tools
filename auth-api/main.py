"""Auth API 入口：FastAPI + CORS，挂载 /auth、/me、/admin"""
import os
import uuid

# 优先加载 .env，使本地开发时 SMS_MODE / ALIYUN_* 等生效（开发模式也能真实发短信）
from pathlib import Path
_env_file = Path(__file__).resolve().parent / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from config import settings
from database import create_tables
from routers import admin, auth, config, feedback, gift_card, me, sms, subscription

_STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        return await call_next(request)


app = FastAPI(title="Auth API", lifespan=lifespan)

cors_origins = (
    settings.CORS_ORIGINS.split(",") if "," in settings.CORS_ORIGINS else [settings.CORS_ORIGINS]
)
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]
allow_credentials = "*" not in cors_origins

app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # wildcard 场景下禁止 credentials，避免出现 `* + allow_credentials=true` 的高风险组合
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sms.router)
app.include_router(me.router)
app.include_router(config.router)
app.include_router(admin.router)
app.include_router(subscription.router)
app.include_router(gift_card.router)
app.include_router(feedback.router)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/admin/app", response_class=HTMLResponse)
def admin_app():
    """管理后台 UI 页面"""
    html_path = _STATIC_DIR / "admin_ui.html"
    if html_path.exists():
        return HTMLResponse(html_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>admin_ui.html not found</h1>", status_code=404)
