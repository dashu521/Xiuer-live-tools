"""GET /me：需 Bearer Token，返回当前会话对应用户标识"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from deps import err_token_invalid, require_active_access_session

router = APIRouter(tags=["me"])
security = HTTPBearer(auto_error=False)


class MeResponse(BaseModel):
    ok: bool = True
    username: str


@router.get("/me", response_model=MeResponse)
def me(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    user_id = require_active_access_session(credentials.credentials, db)
    return MeResponse(ok=True, username=user_id)
