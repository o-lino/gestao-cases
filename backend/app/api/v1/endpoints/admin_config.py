"""
Admin Configuration API Endpoints
Manage system-wide configuration and approvals
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.collaborator import Collaborator
from app.services.config_service import ConfigService
from app.services.approval_service import ApprovalService
from app.schemas.system_config import (
    SystemConfigCreate,
    SystemConfigUpdate,
    SystemConfigResponse,
    SystemConfigListResponse,
    ConfigSummary
)
from app.schemas.pending_approval import (
    PendingApprovalResponse,
    PendingApprovalListResponse,
    ApprovalAction,
    RejectionAction,
    ApprovalStats
)

router = APIRouter()


# ============ System Configuration Endpoints ============

@router.get("/config", response_model=List[SystemConfigResponse])
async def list_configurations(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
    category: Optional[str] = None,
):
    """List all system configurations (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view system configurations"
        )
    
    configs = await ConfigService.list_configs(db, category)
    return [ConfigService.to_response(c) for c in configs]


@router.get("/config/summary", response_model=ConfigSummary)
async def get_config_summary(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get summary of all relevant configurations"""
    return await ConfigService.get_config_summary(db)


@router.get("/config/{key}", response_model=SystemConfigResponse)
async def get_configuration(
    key: str,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get a specific configuration by key"""
    config = await ConfigService.get_config(db, key)
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuration '{key}' not found"
        )
    
    return ConfigService.to_response(config)


@router.put("/config/{key}", response_model=SystemConfigResponse)
async def set_configuration(
    key: str,
    *,
    db: AsyncSession = Depends(deps.get_db),
    data: SystemConfigUpdate,
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Set a configuration value (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can modify system configurations"
        )
    
    config = await ConfigService.set_config(
        db,
        key=key,
        value=data.config_value,
        description=data.description,
        category=data.category,
        updated_by=current_user.id
    )
    
    return ConfigService.to_response(config)


@router.post("/config/initialize", response_model=dict)
async def initialize_default_configs(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Initialize default configuration values (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can initialize configurations"
        )
    
    created = await ConfigService.initialize_defaults(db)
    return {"message": f"Initialized {created} default configurations"}


# ============ Approval Endpoints ============

@router.get("/approvals/pending", response_model=List[PendingApprovalResponse])
async def get_pending_approvals(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get pending approvals for current user"""
    approvals = await ApprovalService.get_pending_for_approver(db, current_user.id)
    return [ApprovalService.to_response(a) for a in approvals]


@router.get("/approvals/stats", response_model=ApprovalStats)
async def get_approval_stats(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get approval statistics (Admin/Manager only)"""
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and managers can view approval stats"
        )
    
    return await ApprovalService.get_stats(db)


@router.get("/approvals/case/{case_id}", response_model=List[PendingApprovalResponse])
async def get_approval_history(
    case_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get approval history for a specific case"""
    approvals = await ApprovalService.get_approvals_for_case(db, case_id)
    return [ApprovalService.to_response(a) for a in approvals]


@router.get("/approvals/{approval_id}", response_model=PendingApprovalResponse)
async def get_approval(
    approval_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get a specific approval request"""
    approval = await ApprovalService.get_approval(db, approval_id)
    
    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found"
        )
    
    return ApprovalService.to_response(approval)


@router.post("/approvals/{approval_id}/approve", response_model=PendingApprovalResponse)
async def approve_case(
    approval_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    data: ApprovalAction,
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Approve a pending case"""
    try:
        approval = await ApprovalService.approve_case(
            db, approval_id, current_user.id, data.notes
        )
        
        if not approval:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Approval request not found"
            )
        
        return ApprovalService.to_response(approval)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/approvals/{approval_id}/reject", response_model=PendingApprovalResponse)
async def reject_case(
    approval_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    data: RejectionAction,
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Reject a pending case"""
    try:
        approval = await ApprovalService.reject_case(
            db, approval_id, current_user.id, data.reason
        )
        
        if not approval:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Approval request not found"
            )
        
        return ApprovalService.to_response(approval)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/approvals/process-escalations", response_model=dict)
async def process_escalations(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Manually trigger escalation processing (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can trigger escalation processing"
        )
    
    escalated = await ApprovalService.process_overdue_escalations(db)
    return {"message": f"Processed {escalated} escalations"}


@router.post("/approvals/send-reminders", response_model=dict)
async def send_reminders(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Manually trigger reminder sending (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can trigger reminders"
        )
    
    sent = await ApprovalService.send_reminders(db)
    return {"message": f"Sent {sent} reminders"}


# ============ Notification Channel Endpoints ============

@router.get("/notifications/status", response_model=dict)
async def get_notification_channels_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get status of all notification channels (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view notification status"
        )
    
    from app.services.notification_delivery_service import NotificationDeliveryService
    service = NotificationDeliveryService(db)
    channels_status = await service.get_channels_status()
    
    return {
        "channels": channels_status,
        "summary": {
            "total_enabled": sum(1 for v in channels_status.values() if v),
            "channels_count": len(channels_status)
        }
    }


@router.post("/notifications/test/{channel_name}", response_model=dict)
async def test_notification_channel(
    channel_name: str,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Test a specific notification channel (Admin only)
    
    Args:
        channel_name: 'email', 'teams', or 'system'
    """
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can test notification channels"
        )
    
    if channel_name not in ("email", "teams", "system"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid channel name. Use: email, teams, or system"
        )
    
    from app.services.notification_delivery_service import NotificationDeliveryService
    service = NotificationDeliveryService(db)
    result = await service.test_channel(channel_name)
    
    return {
        "channel": result.channel,
        "success": result.success,
        "message": result.message or result.error,
        "details": result.details
    }


@router.post("/notifications/test-send", response_model=dict)
async def send_test_notification(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
    channel: Optional[str] = Query(None, description="Specific channel to test: email, teams, system, or all"),
):
    """Send a test notification through specified or all enabled channels (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can send test notifications"
        )
    
    from app.services.notification_delivery_service import NotificationDeliveryService
    from app.services.channels.base_channel import NotificationPriority
    
    service = NotificationDeliveryService(db)
    
    channels = [channel] if channel and channel != "all" else None
    
    results = await service.deliver(
        title="🔔 Teste de Notificação",
        message="Esta é uma mensagem de teste enviada pela página de administração. Se você está vendo esta mensagem, o canal de notificação está funcionando corretamente!",
        user_id=current_user.id,
        recipient_email=current_user.email,
        recipient_name=current_user.name,
        priority=NotificationPriority.MEDIUM,
        action_url="/admin",
        action_label="Voltar para Administração",
        channels=channels
    )
    
    return {
        "results": {
            name: {
                "success": r.success,
                "message": r.message or r.error,
                "details": r.details
            }
            for name, r in results.items()
        },
        "summary": {
            "total": len(results),
            "successful": sum(1 for r in results.values() if r.success),
            "failed": sum(1 for r in results.values() if not r.success)
        }
    }

