"""推广期 AI 体验 token：发放 token、上报使用、查询状态"""
import uuid
from datetime import datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import get_current_user
from models import AITrialSettings, AITrialUserUsage, User
from schemas import (
    AITrialCredentialOut,
    AITrialLimitsOut,
    AITrialModelsOut,
    AITrialReportUseBody,
    AITrialReportUseResponse,
    AITrialSessionBody,
    AITrialSessionResponse,
    AITrialStatusResponse,
)

router = APIRouter(prefix="/ai/trial", tags=["ai-trial"])

ALLOWED_FEATURES = {"chat", "auto_reply", "knowledge_draft"}


def _trial_secret() -> str:
    return (settings.AI_TRIAL_JWT_SECRET or settings.JWT_SECRET).strip() or settings.JWT_SECRET


def _get_or_create_trial_settings(db: Session) -> AITrialSettings:
    settings_row = db.query(AITrialSettings).order_by(AITrialSettings.id.asc()).first()
    if settings_row:
        return settings_row

    settings_row = AITrialSettings(
        trial_enabled=True,
        token_version=1,
        token_expires_in_seconds=43200,
        chat_daily_limit=100,
        auto_reply_daily_limit=500,
        knowledge_draft_daily_limit=50,
        default_chat_model=settings.AI_TRIAL_DEFAULT_CHAT_MODEL,
        default_auto_reply_model=settings.AI_TRIAL_DEFAULT_AUTO_REPLY_MODEL,
        default_knowledge_model=settings.AI_TRIAL_DEFAULT_KNOWLEDGE_MODEL,
        auto_send_default=True,
    )
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)
    return settings_row


def _build_models(settings_row: AITrialSettings) -> AITrialModelsOut:
    return AITrialModelsOut(
        chat=settings_row.default_chat_model,
        auto_reply=settings_row.default_auto_reply_model,
        knowledge_draft=settings_row.default_knowledge_model,
    )


def _build_limits(settings_row: AITrialSettings) -> AITrialLimitsOut:
    return AITrialLimitsOut(
        chat_remaining=settings_row.chat_daily_limit,
        auto_reply_remaining=settings_row.auto_reply_daily_limit,
        knowledge_draft_remaining=settings_row.knowledge_draft_daily_limit,
    )


def _build_credential() -> AITrialCredentialOut:
    return AITrialCredentialOut(
        provider=settings.AI_TRIAL_PROVIDER,
        base_url=settings.AI_TRIAL_BASE_URL,
        api_key=settings.AI_TRIAL_SHARED_API_KEY,
    )


@router.post("/session", response_model=AITrialSessionResponse)
def create_trial_session(
    body: AITrialSessionBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings_row = _get_or_create_trial_settings(db)
    if not settings_row.trial_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "trial_disabled", "message": "体验模式已关闭"},
        )
    if not settings.AI_TRIAL_SHARED_API_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "trial_unavailable", "message": "体验模式暂未配置共享凭证"},
        )

    requested_features = [feature for feature in body.features if feature in ALLOWED_FEATURES]
    features = requested_features or ["chat", "auto_reply", "knowledge_draft"]

    now = datetime.utcnow()
    expires_in = int(settings_row.token_expires_in_seconds)
    payload = {
        "sub": user.id,
        "did": body.device_id,
        "mode": "trial",
        "scopes": features,
        "ver": settings_row.token_version,
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
    }
    token = jwt.encode(payload, _trial_secret(), algorithm="HS256")

    return AITrialSessionResponse(
        token=token,
        expires_in=expires_in,
        models=_build_models(settings_row),
        limits=_build_limits(settings_row),
        auto_send_default=bool(settings_row.auto_send_default),
        credential=_build_credential(),
    )


@router.post("/report-use", response_model=AITrialReportUseResponse)
def report_trial_usage(
    body: AITrialReportUseBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.feature not in ALLOWED_FEATURES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_feature", "message": "不支持的 AI 功能类型"},
        )

    row = (
        db.query(AITrialUserUsage)
        .filter(AITrialUserUsage.user_id == user.id, AITrialUserUsage.feature == body.feature)
        .first()
    )

    now = datetime.utcnow()
    if row:
        row.last_used_at = now
        row.use_count += 1
        row.device_id = body.device_id or row.device_id
        row.last_model = body.model or row.last_model
        row.last_client_version = body.client_version or row.last_client_version
    else:
        row = AITrialUserUsage(
            user_id=user.id,
            device_id=body.device_id,
            feature=body.feature,
            first_used_at=now,
            last_used_at=now,
            use_count=1,
            last_model=body.model,
            last_client_version=body.client_version,
        )
        db.add(row)

    db.commit()
    return AITrialReportUseResponse()


@router.get("/status", response_model=AITrialStatusResponse)
def get_trial_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = user
    settings_row = _get_or_create_trial_settings(db)
    return AITrialStatusResponse(
        trial_enabled=bool(settings_row.trial_enabled),
        expires_in=int(settings_row.token_expires_in_seconds),
        auto_send_default=bool(settings_row.auto_send_default),
        models=_build_models(settings_row),
        provider=settings.AI_TRIAL_PROVIDER,
        base_url=settings.AI_TRIAL_BASE_URL,
    )
