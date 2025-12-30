"""
Approval Service
Business logic for case approval workflow and automatic escalation
"""

from typing import Optional, List, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.models.pending_approval import PendingApproval, ApprovalStatus
from app.models.case import Case
from app.models.collaborator import Collaborator
from app.models.notification import Notification, NotificationType
from app.services.hierarchy_service import HierarchyService
from app.services.config_service import ConfigService
from app.schemas.pending_approval import (
    PendingApprovalResponse,
    ApprovalStats,
    CaseBrief
)
from app.schemas.hierarchy import CollaboratorBrief


class ApprovalService:
    """Service for managing case approvals and escalation"""

    @staticmethod
    async def create_approval_request(
        db: AsyncSession,
        case_id: int,
        requester_id: int
    ) -> Optional[PendingApproval]:
        """
        Create an approval request for a case.
        Automatically finds the requester's supervisor and creates the request.
        """
        # Get approval configuration
        approval_config = await ConfigService.get_approval_config(db)
        
        if not approval_config.case_approval_required:
            return None  # Approval not required
        
        # Get requester's supervisor
        supervisor = await HierarchyService.get_supervisor(db, requester_id)
        
        if not supervisor:
            # No supervisor found - auto-approve or handle differently
            return None
        
        # Calculate SLA deadline
        sla_hours = approval_config.approval_sla_hours
        sla_deadline = datetime.now(timezone.utc) + timedelta(hours=sla_hours)
        
        # Create the approval request
        approval = PendingApproval(
            case_id=case_id,
            approver_id=supervisor.id,
            requester_id=requester_id,
            escalation_level=0,
            status=ApprovalStatus.PENDING,
            sla_deadline=sla_deadline
        )
        
        db.add(approval)
        await db.commit()
        await db.refresh(approval)
        
        # Create notification for approver
        await ApprovalService._notify_approver(db, approval, supervisor)
        
        return approval

    @staticmethod
    async def approve_case(
        db: AsyncSession,
        approval_id: int,
        approver_id: int,
        notes: str = None
    ) -> Optional[PendingApproval]:
        """Approve a pending case"""
        approval = await ApprovalService.get_approval(db, approval_id)
        
        if not approval:
            return None
        
        if approval.approver_id != approver_id:
            raise ValueError("Only the assigned approver can approve this request")
        
        if approval.status != ApprovalStatus.PENDING:
            raise ValueError(f"Cannot approve request with status {approval.status}")
        
        approval.approve(notes)
        
        # Update case status
        case_result = await db.execute(
            select(Case).where(Case.id == approval.case_id)
        )
        case = case_result.scalar_one_or_none()
        if case:
            case.status = "REVIEW"  # Move to next stage after approval
        
        await db.commit()
        
        # Notify requester
        await ApprovalService._notify_requester(db, approval, "approved")
        
        return approval

    @staticmethod
    async def reject_case(
        db: AsyncSession,
        approval_id: int,
        approver_id: int,
        reason: str
    ) -> Optional[PendingApproval]:
        """Reject a pending case"""
        approval = await ApprovalService.get_approval(db, approval_id)
        
        if not approval:
            return None
        
        if approval.approver_id != approver_id:
            raise ValueError("Only the assigned approver can reject this request")
        
        if approval.status != ApprovalStatus.PENDING:
            raise ValueError(f"Cannot reject request with status {approval.status}")
        
        approval.reject(reason)
        
        # Update case status
        case_result = await db.execute(
            select(Case).where(Case.id == approval.case_id)
        )
        case = case_result.scalar_one_or_none()
        if case:
            case.status = "REJECTED"
        
        await db.commit()
        
        # Notify requester
        await ApprovalService._notify_requester(db, approval, "rejected")
        
        return approval

    @staticmethod
    async def escalate_approval(
        db: AsyncSession,
        approval_id: int
    ) -> Optional[PendingApproval]:
        """Escalate an approval to the next level in hierarchy"""
        approval = await ApprovalService.get_approval(db, approval_id)
        
        if not approval:
            return None
        
        if approval.status != ApprovalStatus.PENDING:
            return None
        
        # Get escalation config
        escalation_config = await ConfigService.get_escalation_config(db)
        
        if not escalation_config.escalation_enabled:
            return None
        
        # Find next escalation target
        next_approver = await HierarchyService.get_next_escalation_target(
            db,
            approval.approver_id,
            max_level=escalation_config.escalation_max_level
        )
        
        if not next_approver:
            # Cannot escalate further
            return None
        
        # Mark current approval as escalated
        approval.escalate()
        
        # Create new approval at next level
        sla_deadline = datetime.now(timezone.utc) + timedelta(
            hours=escalation_config.escalation_sla_hours
        )
        
        new_approval = PendingApproval(
            case_id=approval.case_id,
            approver_id=next_approver.id,
            requester_id=approval.requester_id,
            escalation_level=approval.escalation_level + 1,
            previous_approval_id=approval.id,
            status=ApprovalStatus.PENDING,
            sla_deadline=sla_deadline
        )
        
        db.add(new_approval)
        await db.commit()
        await db.refresh(new_approval)
        
        # Notify new approver and original approver
        await ApprovalService._notify_approver(db, new_approval, next_approver, escalated=True)
        
        return new_approval

    @staticmethod
    async def get_approval(
        db: AsyncSession,
        approval_id: int
    ) -> Optional[PendingApproval]:
        """Get a pending approval by ID"""
        result = await db.execute(
            select(PendingApproval)
            .options(
                selectinload(PendingApproval.case),
                selectinload(PendingApproval.approver),
                selectinload(PendingApproval.requester)
            )
            .where(PendingApproval.id == approval_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_pending_for_approver(
        db: AsyncSession,
        approver_id: int
    ) -> List[PendingApproval]:
        """Get all pending approvals for an approver"""
        result = await db.execute(
            select(PendingApproval)
            .options(
                selectinload(PendingApproval.case),
                selectinload(PendingApproval.requester)
            )
            .where(
                and_(
                    PendingApproval.approver_id == approver_id,
                    PendingApproval.status == ApprovalStatus.PENDING
                )
            )
            .order_by(PendingApproval.requested_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_approvals_for_case(
        db: AsyncSession,
        case_id: int
    ) -> List[PendingApproval]:
        """Get all approval history for a case"""
        result = await db.execute(
            select(PendingApproval)
            .options(
                selectinload(PendingApproval.approver),
                selectinload(PendingApproval.requester)
            )
            .where(PendingApproval.case_id == case_id)
            .order_by(PendingApproval.requested_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_overdue_approvals(db: AsyncSession) -> List[PendingApproval]:
        """Get all overdue pending approvals"""
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(PendingApproval)
            .options(
                selectinload(PendingApproval.case),
                selectinload(PendingApproval.approver),
                selectinload(PendingApproval.requester)
            )
            .where(
                and_(
                    PendingApproval.status == ApprovalStatus.PENDING,
                    PendingApproval.sla_deadline < now
                )
            )
        )
        return list(result.scalars().all())

    @staticmethod
    async def process_overdue_escalations(db: AsyncSession) -> int:
        """Process all overdue approvals and escalate them"""
        overdue = await ApprovalService.get_overdue_approvals(db)
        escalated = 0
        
        for approval in overdue:
            result = await ApprovalService.escalate_approval(db, approval.id)
            if result:
                escalated += 1
        
        return escalated

    @staticmethod
    async def send_reminders(db: AsyncSession) -> int:
        """Send reminders for approvals approaching deadline"""
        escalation_config = await ConfigService.get_escalation_config(db)
        reminder_threshold = datetime.now(timezone.utc) + timedelta(
            hours=escalation_config.escalation_reminder_hours
        )
        
        result = await db.execute(
            select(PendingApproval)
            .options(selectinload(PendingApproval.approver))
            .where(
                and_(
                    PendingApproval.status == ApprovalStatus.PENDING,
                    PendingApproval.sla_deadline <= reminder_threshold,
                    PendingApproval.sla_deadline > datetime.now(timezone.utc),
                    or_(
                        PendingApproval.reminder_sent_at == None,
                        PendingApproval.reminder_sent_at < datetime.now(timezone.utc) - timedelta(hours=24)
                    )
                )
            )
        )
        
        approvals = result.scalars().all()
        sent = 0
        
        for approval in approvals:
            # Create reminder notification
            notification = Notification(
                user_id=approval.approver_id,
                notification_type=NotificationType.CASE_ACTION_REQUIRED,
                title="Lembrete: Aprovação Pendente",
                message=f"A aprovação do case #{approval.case_id} vence em {approval.hours_until_deadline:.0f} horas",
                related_case_id=approval.case_id
            )
            db.add(notification)
            
            approval.reminder_sent_at = datetime.now(timezone.utc)
            approval.reminder_count += 1
            sent += 1
        
        await db.commit()
        return sent

    @staticmethod
    async def get_stats(db: AsyncSession) -> ApprovalStats:
        """Get approval statistics"""
        from sqlalchemy import func
        
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Total pending
        pending_result = await db.execute(
            select(func.count(PendingApproval.id)).where(
                PendingApproval.status == ApprovalStatus.PENDING
            )
        )
        total_pending = pending_result.scalar() or 0
        
        # Total overdue
        overdue_result = await db.execute(
            select(func.count(PendingApproval.id)).where(
                and_(
                    PendingApproval.status == ApprovalStatus.PENDING,
                    PendingApproval.sla_deadline < datetime.now(timezone.utc)
                )
            )
        )
        total_overdue = overdue_result.scalar() or 0
        
        # Approved today
        approved_result = await db.execute(
            select(func.count(PendingApproval.id)).where(
                and_(
                    PendingApproval.status == ApprovalStatus.APPROVED,
                    PendingApproval.responded_at >= today_start
                )
            )
        )
        approved_today = approved_result.scalar() or 0
        
        # Rejected today
        rejected_result = await db.execute(
            select(func.count(PendingApproval.id)).where(
                and_(
                    PendingApproval.status == ApprovalStatus.REJECTED,
                    PendingApproval.responded_at >= today_start
                )
            )
        )
        rejected_today = rejected_result.scalar() or 0
        
        # Escalated count
        escalated_result = await db.execute(
            select(func.count(PendingApproval.id)).where(
                PendingApproval.status == ApprovalStatus.ESCALATED
            )
        )
        escalated_count = escalated_result.scalar() or 0
        
        # Average response time (simplified)
        avg_response_hours = 24.0  # Placeholder
        
        return ApprovalStats(
            total_pending=total_pending,
            total_overdue=total_overdue,
            approved_today=approved_today,
            rejected_today=rejected_today,
            average_response_hours=avg_response_hours,
            escalated_count=escalated_count
        )

    @staticmethod
    async def _notify_approver(
        db: AsyncSession,
        approval: PendingApproval,
        approver: Collaborator,
        escalated: bool = False
    ):
        """Send notification to approver"""
        title = "Nova Aprovação Pendente" if not escalated else "Aprovação Escalada"
        message = f"Case #{approval.case_id} aguarda sua aprovação"
        if escalated:
            message += f" (escalado do nível {approval.escalation_level - 1})"
        
        notification = Notification(
            user_id=approver.id,
            notification_type=NotificationType.CASE_ACTION_REQUIRED,
            title=title,
            message=message,
            related_case_id=approval.case_id
        )
        db.add(notification)
        await db.commit()

    @staticmethod
    async def _notify_requester(
        db: AsyncSession,
        approval: PendingApproval,
        action: str
    ):
        """Send notification to requester about approval result"""
        status_text = "aprovado" if action == "approved" else "rejeitado"
        
        notification = Notification(
            user_id=approval.requester_id,
            notification_type=NotificationType.CASE_STATUS_CHANGED,
            title=f"Case {status_text.capitalize()}",
            message=f"Seu case #{approval.case_id} foi {status_text} pelo gestor",
            related_case_id=approval.case_id
        )
        db.add(notification)
        await db.commit()

    @staticmethod
    def to_response(approval: PendingApproval) -> PendingApprovalResponse:
        """Convert model to response schema"""
        case_brief = None
        approver_brief = None
        requester_brief = None
        
        if approval.case:
            case_brief = CaseBrief(
                id=approval.case.id,
                title=approval.case.title,
                status=approval.case.status,
                created_at=approval.case.created_at
            )
        
        if approval.approver:
            approver_brief = CollaboratorBrief(
                id=approval.approver.id,
                email=approval.approver.email,
                name=approval.approver.name
            )
        
        if approval.requester:
            requester_brief = CollaboratorBrief(
                id=approval.requester.id,
                email=approval.requester.email,
                name=approval.requester.name
            )
        
        return PendingApprovalResponse(
            id=approval.id,
            case_id=approval.case_id,
            approver_id=approval.approver_id,
            requester_id=approval.requester_id,
            escalation_level=approval.escalation_level,
            status=approval.status,
            requested_at=approval.requested_at,
            sla_deadline=approval.sla_deadline,
            responded_at=approval.responded_at,
            escalated_at=approval.escalated_at,
            response_notes=approval.response_notes,
            rejection_reason=approval.rejection_reason,
            reminder_count=approval.reminder_count,
            is_overdue=approval.is_overdue,
            hours_until_deadline=approval.hours_until_deadline,
            case=case_brief,
            approver=approver_brief,
            requester=requester_brief
        )
