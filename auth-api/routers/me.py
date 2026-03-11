"""GET /me：需 Bearer Token，校验 JWT 后返回 ok + username（不查库）"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from deps import decode_access_token, err_token_invalid

router = APIRouter(tags=["me"])
security = HTTPBearer(auto_error=False)


class MeResponse(BaseModel):
    ok: bool = True
    username: str


@router.get("/me", response_model=MeResponse)
def me(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    sub = decode_access_token(credentials.credentials)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    return MeResponse(ok=True, username=sub)
