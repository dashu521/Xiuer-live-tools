"""启动入口：将顶层 main 的 app 暴露给 uvicorn app.main:app"""
from main import app

__all__ = ["app"]
