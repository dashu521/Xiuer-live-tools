"""
用户反馈路由
- POST /feedback/submit - 提交反馈（支持匿名）
- GET /feedback/list - 获取反馈列表（管理员）
- PUT /feedback/{feedback_id}/status - 更新反馈状态（管理员）
"""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from deps import get_current_user, get_current_admin
from models import Feedback, User
from schemas import (
    FeedbackListResponse,
    FeedbackOut,
    SubmitFeedbackBody,
    SubmitFeedbackResponse,
    UpdateFeedbackStatusBody,
    err_feedback_invalid_category,
    err_feedback_not_found,
)

router = APIRouter(prefix="/feedback", tags=["feedback"])

# 有效的反馈类型
VALID_CATEGORIES = {"connection", "login", "function", "suggestion", "feature_request", "other"}

# 有效的状态值
VALID_STATUSES = {"pending", "processing", "resolved", "closed"}


@router.post("/submit", response_model=SubmitFeedbackResponse)
async def submit_feedback(
    body: SubmitFeedbackBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    提交用户反馈（需要登录）
    """
    # 验证反馈类型
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=err_feedback_invalid_category())

    # 创建反馈记录
    feedback = Feedback(
        id=str(uuid4()),
        user_id=current_user.id,
        username=current_user.username,
        contact=body.contact,
        category=body.category,
        content=body.content,
        platform=body.platform,
        app_version=body.app_version,
        os_info=body.os_info,
        diagnostic_info=body.diagnostic_info,
        status="pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(feedback)
    db.commit()

    return SubmitFeedbackResponse(
        success=True,
        message="反馈提交成功，我们会尽快处理",
        feedback_id=feedback.id,
    )


@router.get("/list", response_model=FeedbackListResponse)
async def list_feedbacks(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    获取反馈列表（管理员权限）
    """
    query = db.query(Feedback)

    # 筛选条件
    if status and status in VALID_STATUSES:
        query = query.filter(Feedback.status == status)
    if category and category in VALID_CATEGORIES:
        query = query.filter(Feedback.category == category)

    # 排序和分页
    total = query.count()
    items = (
        query.order_by(Feedback.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    # 转换为输出模型
    feedback_out_list = []
    for item in items:
        feedback_out_list.append(
            FeedbackOut(
                id=item.id,
                username=item.username,
                contact=item.contact,
                category=item.category,
                content=item.content,
                platform=item.platform,
                app_version=item.app_version,
                os_info=item.os_info,
                diagnostic_info=item.diagnostic_info,
                status=item.status,
                created_at=item.created_at.isoformat() if item.created_at else None,
                updated_at=item.updated_at.isoformat() if item.updated_at else None,
            )
        )

    return FeedbackListResponse(
        items=feedback_out_list,
        total=total,
        page=page,
        size=size,
    )


@router.put("/{feedback_id}/status", response_model=FeedbackOut)
async def update_feedback_status(
    feedback_id: str,
    body: UpdateFeedbackStatusBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    更新反馈状态（管理员权限）
    """
    # 验证状态值
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_STATUS", "message": f"无效的状态值，可选: {', '.join(VALID_STATUSES)}"},
        )

    # 查找反馈记录
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not feedback:
        raise HTTPException(status_code=404, detail=err_feedback_not_found())

    # 更新状态
    feedback.status = body.status
    feedback.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(feedback)

    return FeedbackOut(
        id=feedback.id,
        username=feedback.username,
        contact=feedback.contact,
        category=feedback.category,
        content=feedback.content,
        platform=feedback.platform,
        app_version=feedback.app_version,
        os_info=feedback.os_info,
        diagnostic_info=feedback.diagnostic_info,
        status=feedback.status,
        created_at=feedback.created_at.isoformat() if feedback.created_at else None,
        updated_at=feedback.updated_at.isoformat() if feedback.updated_at else None,
    )


@router.get("/my", response_model=FeedbackListResponse)
async def list_my_feedbacks(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取当前用户的反馈列表
    """
    query = db.query(Feedback).filter(Feedback.user_id == current_user.id)

    total = query.count()
    items = (
        query.order_by(Feedback.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    feedback_out_list = []
    for item in items:
        feedback_out_list.append(
            FeedbackOut(
                id=item.id,
                username=item.username,
                contact=item.contact,
                category=item.category,
                content=item.content,
                platform=item.platform,
                app_version=item.app_version,
                os_info=item.os_info,
                diagnostic_info=item.diagnostic_info,
                status=item.status,
                created_at=item.created_at.isoformat() if item.created_at else None,
                updated_at=item.updated_at.isoformat() if item.updated_at else None,
            )
        )

    return FeedbackListResponse(
        items=feedback_out_list,
        total=total,
        page=page,
        size=size,
    )
