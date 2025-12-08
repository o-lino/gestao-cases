"""
Moderation Service

Business logic for managing moderator-user associations:
- Request creation and approval/rejection
- Association management
- Expiration handling
- Notifications
"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from loguru import logger

from app.models.moderation import (
    ModerationRequest,
    ModerationAssociation,
    ModerationRequestStatus,
    ModerationDuration,
    ModerationAssociationStatus,
    REQUEST_EXPIRATION_DAYS,
    EXPIRATION_WARNING_DAYS,
    DEFAULT_DURATION,
)
from app.models.notification import NotificationType, NotificationPriority
from app.models.collaborator import Collaborator
from app.services.notification_service import NotificationService


class ModerationError(Exception):
    """Custom exception for moderation errors"""
    pass


class ModerationService:
    """Service for managing moderator-user associations"""
    
    @staticmethod
    async def create_request(
        db: AsyncSession,
        moderator_id: int,
        user_id: int,
        duration: ModerationDuration = None,
        message: str = None,
        is_renewal: bool = False,
        previous_association_id: int = None
    ) -> ModerationRequest:
        """
        Create a moderation request from moderator to user.
        User must approve for association to be created.
        """
        if duration is None:
            duration = DEFAULT_DURATION
        
        # Validate moderator and user exist
        result = await db.execute(select(Collaborator).where(Collaborator.id == moderator_id))
        moderator = result.scalars().first()
        
        result = await db.execute(select(Collaborator).where(Collaborator.id == user_id))
        user = result.scalars().first()
        
        if not moderator:
            raise ModerationError("Moderador não encontrado")
        if not user:
            raise ModerationError("Usuário não encontrado")
        if moderator_id == user_id:
            raise ModerationError("Não é possível solicitar moderação de si mesmo")
        
        # Check if moderator has the right role
        if moderator.role not in ["MODERATOR", "ADMIN"]:
            raise ModerationError("Apenas moderadores podem solicitar moderação")
        
        # Check for existing pending request
        result = await db.execute(
            select(ModerationRequest).where(
                ModerationRequest.moderator_id == moderator_id,
                ModerationRequest.user_id == user_id,
                ModerationRequest.status == ModerationRequestStatus.PENDING
            )
        )
        existing_request = result.scalars().first()
        
        if existing_request and existing_request.is_pending:
            raise ModerationError("Já existe uma solicitação pendente para este usuário")
        
        # Check for existing active association (unless it's a renewal)
        if not is_renewal:
            result = await db.execute(
                select(ModerationAssociation).where(
                    ModerationAssociation.moderator_id == moderator_id,
                    ModerationAssociation.user_id == user_id,
                    ModerationAssociation.status == ModerationAssociationStatus.ACTIVE
                )
            )
            existing_association = result.scalars().first()
            
            if existing_association and existing_association.is_active:
                raise ModerationError("Já existe uma associação ativa com este usuário")
        
        # Create the request
        request = ModerationRequest(
            moderator_id=moderator_id,
            user_id=user_id,
            duration=duration,
            message=message,
            is_renewal=is_renewal,
            previous_association_id=previous_association_id,
            expires_at=datetime.utcnow() + timedelta(days=REQUEST_EXPIRATION_DAYS)
        )
        
        db.add(request)
        await db.commit()
        await db.refresh(request)
        
        # Notify the user
        action_type = "renovar" if is_renewal else "moderar"
        await NotificationService.create_notification(
            db=db,
            user_id=user_id,
            type=NotificationType.MODERATION_REQUEST,
            title=f"Solicitação de moderação",
            message=f"{moderator.name} solicita {action_type} você por {duration.label}",
            priority=NotificationPriority.HIGH,
            action_url="/moderation?tab=received",
            action_label="Responder",
            expires_days=REQUEST_EXPIRATION_DAYS
        )
        
        logger.info(f"Created moderation request {request.id}: {moderator_id} -> {user_id}")
        return request
    
    @staticmethod
    async def approve_request(
        db: AsyncSession,
        request_id: int,
        user_id: int
    ) -> ModerationAssociation:
        """
        User approves a moderation request.
        Creates the association.
        """
        result = await db.execute(
            select(ModerationRequest).where(ModerationRequest.id == request_id)
        )
        request = result.scalars().first()
        
        if not request:
            raise ModerationError("Solicitação não encontrada")
        if request.user_id != user_id:
            raise ModerationError("Apenas o usuário destinatário pode aprovar")
        if request.status != ModerationRequestStatus.PENDING:
            raise ModerationError(f"Solicitação já foi {request.status.value.lower()}")
        if request.is_expired:
            raise ModerationError("Solicitação expirada")
        
        # Approve the request
        request.approve()
        
        # Calculate expiration date
        expires_at = datetime.utcnow() + timedelta(days=request.duration.days)
        
        # Create the association
        association = ModerationAssociation(
            moderator_id=request.moderator_id,
            user_id=request.user_id,
            request_id=request.id,
            started_at=datetime.utcnow(),
            expires_at=expires_at
        )
        
        db.add(association)
        await db.commit()
        await db.refresh(association)
        
        # Get user info for notifications
        result = await db.execute(select(Collaborator).where(Collaborator.id == user_id))
        user = result.scalars().first()
        result = await db.execute(select(Collaborator).where(Collaborator.id == request.moderator_id))
        moderator = result.scalars().first()
        
        # Notify moderator of approval
        await NotificationService.create_notification(
            db=db,
            user_id=request.moderator_id,
            type=NotificationType.MODERATION_APPROVED,
            title="Solicitação aprovada",
            message=f"{user.name} aprovou sua solicitação de moderação",
            priority=NotificationPriority.MEDIUM,
            action_url="/moderation?tab=users",
            action_label="Ver usuários"
        )
        
        # Notify user that association started
        await NotificationService.create_notification(
            db=db,
            user_id=user_id,
            type=NotificationType.MODERATION_STARTED,
            title="Moderação iniciada",
            message=f"{moderator.name} agora é seu moderador por {request.duration.label}",
            priority=NotificationPriority.LOW,
            action_url="/moderation",
            action_label="Ver detalhes"
        )
        
        logger.info(f"Request {request_id} approved, created association {association.id}")
        return association
    
    @staticmethod
    async def reject_request(
        db: AsyncSession,
        request_id: int,
        user_id: int,
        reason: str = None
    ) -> ModerationRequest:
        """User rejects a moderation request"""
        result = await db.execute(
            select(ModerationRequest).where(ModerationRequest.id == request_id)
        )
        request = result.scalars().first()
        
        if not request:
            raise ModerationError("Solicitação não encontrada")
        if request.user_id != user_id:
            raise ModerationError("Apenas o usuário destinatário pode rejeitar")
        if request.status != ModerationRequestStatus.PENDING:
            raise ModerationError(f"Solicitação já foi {request.status.value.lower()}")
        
        # Reject the request
        request.reject(reason)
        await db.commit()
        
        # Get user info for notification
        result = await db.execute(select(Collaborator).where(Collaborator.id == user_id))
        user = result.scalars().first()
        
        # Notify moderator
        message = f"{user.name} recusou sua solicitação de moderação"
        if reason:
            message += f": {reason}"
        
        await NotificationService.create_notification(
            db=db,
            user_id=request.moderator_id,
            type=NotificationType.MODERATION_REJECTED,
            title="Solicitação recusada",
            message=message,
            priority=NotificationPriority.MEDIUM
        )
        
        logger.info(f"Request {request_id} rejected by user {user_id}")
        return request
    
    @staticmethod
    async def cancel_request(
        db: AsyncSession,
        request_id: int,
        moderator_id: int
    ) -> ModerationRequest:
        """Moderator cancels their own request"""
        result = await db.execute(
            select(ModerationRequest).where(ModerationRequest.id == request_id)
        )
        request = result.scalars().first()
        
        if not request:
            raise ModerationError("Solicitação não encontrada")
        if request.moderator_id != moderator_id:
            raise ModerationError("Apenas o moderador pode cancelar sua solicitação")
        if request.status != ModerationRequestStatus.PENDING:
            raise ModerationError(f"Solicitação já foi {request.status.value.lower()}")
        
        # Cancel the request
        request.cancel()
        await db.commit()
        
        # Notify user that request was cancelled
        result = await db.execute(select(Collaborator).where(Collaborator.id == moderator_id))
        moderator = result.scalars().first()
        
        await NotificationService.create_notification(
            db=db,
            user_id=request.user_id,
            type=NotificationType.MODERATION_CANCELLED,
            title="Solicitação cancelada",
            message=f"{moderator.name} cancelou a solicitação de moderação",
            priority=NotificationPriority.LOW
        )
        
        logger.info(f"Request {request_id} cancelled by moderator {moderator_id}")
        return request
    
    @staticmethod
    async def revoke_association(
        db: AsyncSession,
        association_id: int,
        user_id: int
    ) -> ModerationAssociation:
        """Revoke an active association (by user or moderator)"""
        result = await db.execute(
            select(ModerationAssociation).where(ModerationAssociation.id == association_id)
        )
        association = result.scalars().first()
        
        if not association:
            raise ModerationError("Associação não encontrada")
        if association.user_id != user_id and association.moderator_id != user_id:
            raise ModerationError("Apenas o usuário ou moderador podem revogar a associação")
        if association.status != ModerationAssociationStatus.ACTIVE:
            raise ModerationError(f"Associação já está {association.status.value.lower()}")
        
        # Revoke the association
        association.revoke(user_id)
        await db.commit()
        
        # Determine who revoked
        result = await db.execute(select(Collaborator).where(Collaborator.id == user_id))
        revoker = result.scalars().first()
        is_moderator = user_id == association.moderator_id
        
        # Notify the other party
        other_user_id = association.user_id if is_moderator else association.moderator_id
        
        await NotificationService.create_notification(
            db=db,
            user_id=other_user_id,
            type=NotificationType.MODERATION_REVOKED,
            title="Moderação encerrada",
            message=f"{revoker.name} encerrou a associação de moderação",
            priority=NotificationPriority.MEDIUM,
            action_url="/moderation",
            action_label="Ver detalhes"
        )
        
        logger.info(f"Association {association_id} revoked by user {user_id}")
        return association
    
    @staticmethod
    async def get_user_moderator(db: AsyncSession, user_id: int) -> Optional[Collaborator]:
        """Get the active moderator for a user"""
        result = await db.execute(
            select(ModerationAssociation).where(
                ModerationAssociation.user_id == user_id,
                ModerationAssociation.status == ModerationAssociationStatus.ACTIVE,
                ModerationAssociation.expires_at > datetime.utcnow()
            )
        )
        association = result.scalars().first()
        
        if association:
            result = await db.execute(
                select(Collaborator).where(Collaborator.id == association.moderator_id)
            )
            return result.scalars().first()
        return None
    
    @staticmethod
    async def get_moderated_users(db: AsyncSession, moderator_id: int) -> List[Tuple[Collaborator, ModerationAssociation]]:
        """Get all users being moderated by a moderator"""
        result = await db.execute(
            select(ModerationAssociation).where(
                ModerationAssociation.moderator_id == moderator_id,
                ModerationAssociation.status == ModerationAssociationStatus.ACTIVE,
                ModerationAssociation.expires_at > datetime.utcnow()
            )
        )
        associations = result.scalars().all()
        
        results = []
        for assoc in associations:
            user_result = await db.execute(
                select(Collaborator).where(Collaborator.id == assoc.user_id)
            )
            user = user_result.scalars().first()
            if user:
                results.append((user, assoc))
        
        return results
    
    @staticmethod
    async def get_pending_requests_for_user(db: AsyncSession, user_id: int) -> List[ModerationRequest]:
        """Get pending moderation requests for a user"""
        result = await db.execute(
            select(ModerationRequest).where(
                ModerationRequest.user_id == user_id,
                ModerationRequest.status == ModerationRequestStatus.PENDING,
                ModerationRequest.expires_at > datetime.utcnow()
            ).order_by(ModerationRequest.requested_at.desc())
        )
        return result.scalars().all()
    
    @staticmethod
    async def get_sent_requests(db: AsyncSession, moderator_id: int) -> List[ModerationRequest]:
        """Get moderation requests sent by a moderator"""
        result = await db.execute(
            select(ModerationRequest).where(
                ModerationRequest.moderator_id == moderator_id
            ).order_by(ModerationRequest.requested_at.desc())
        )
        return result.scalars().all()
    
    @staticmethod
    async def check_expiring_associations(db: AsyncSession) -> int:
        """
        Check for associations expiring in 15 days and send warnings.
        Returns number of notifications sent.
        Called by scheduled task.
        """
        warning_date = datetime.utcnow() + timedelta(days=EXPIRATION_WARNING_DAYS)
        
        result = await db.execute(
            select(ModerationAssociation).where(
                ModerationAssociation.status == ModerationAssociationStatus.ACTIVE,
                ModerationAssociation.expires_at <= warning_date,
                ModerationAssociation.expires_at > datetime.utcnow(),
                ModerationAssociation.expiration_warning_sent == False
            )
        )
        associations = result.scalars().all()
        
        count = 0
        for assoc in associations:
            mod_result = await db.execute(select(Collaborator).where(Collaborator.id == assoc.moderator_id))
            moderator = mod_result.scalars().first()
            user_result = await db.execute(select(Collaborator).where(Collaborator.id == assoc.user_id))
            user = user_result.scalars().first()
            
            days_remaining = assoc.days_remaining
            
            # Notify moderator
            await NotificationService.create_notification(
                db=db,
                user_id=assoc.moderator_id,
                type=NotificationType.MODERATION_EXPIRING,
                title="Moderação expirando",
                message=f"Sua moderação de {user.name} expira em {days_remaining} dias",
                priority=NotificationPriority.HIGH,
                action_url="/moderation?tab=users",
                action_label="Renovar"
            )
            
            # Notify user
            await NotificationService.create_notification(
                db=db,
                user_id=assoc.user_id,
                type=NotificationType.MODERATION_EXPIRING,
                title="Moderação expirando",
                message=f"A moderação de {moderator.name} expira em {days_remaining} dias",
                priority=NotificationPriority.MEDIUM,
                action_url="/moderation",
                action_label="Ver detalhes"
            )
            
            assoc.expiration_warning_sent = True
            count += 2
        
        await db.commit()
        logger.info(f"Sent {count} expiration warnings")
        return count
    
    @staticmethod
    async def expire_associations(db: AsyncSession) -> int:
        """
        Mark expired associations as EXPIRED.
        Returns number of associations expired.
        Called by scheduled task.
        """
        now = datetime.utcnow()
        
        result = await db.execute(
            select(ModerationAssociation).where(
                ModerationAssociation.status == ModerationAssociationStatus.ACTIVE,
                ModerationAssociation.expires_at <= now
            )
        )
        associations = result.scalars().all()
        
        count = 0
        for assoc in associations:
            assoc.expire()
            
            mod_result = await db.execute(select(Collaborator).where(Collaborator.id == assoc.moderator_id))
            moderator = mod_result.scalars().first()
            user_result = await db.execute(select(Collaborator).where(Collaborator.id == assoc.user_id))
            user = user_result.scalars().first()
            
            # Notify both
            if not assoc.expiration_notification_sent:
                await NotificationService.create_notification(
                    db=db,
                    user_id=assoc.moderator_id,
                    type=NotificationType.MODERATION_EXPIRED,
                    title="Moderação expirada",
                    message=f"Sua moderação de {user.name} expirou",
                    priority=NotificationPriority.MEDIUM,
                    action_url="/moderation",
                    action_label="Renovar"
                )
                
                await NotificationService.create_notification(
                    db=db,
                    user_id=assoc.user_id,
                    type=NotificationType.MODERATION_EXPIRED,
                    title="Moderação expirada",
                    message=f"A moderação de {moderator.name} expirou",
                    priority=NotificationPriority.LOW
                )
                
                assoc.expiration_notification_sent = True
            
            count += 1
        
        await db.commit()
        logger.info(f"Expired {count} associations")
        return count
    
    @staticmethod
    async def expire_pending_requests(db: AsyncSession) -> int:
        """
        Mark pending requests that passed their deadline as EXPIRED.
        Returns number of requests expired.
        Called by scheduled task.
        """
        now = datetime.utcnow()
        
        result = await db.execute(
            update(ModerationRequest)
            .where(
                ModerationRequest.status == ModerationRequestStatus.PENDING,
                ModerationRequest.expires_at <= now
            )
            .values(status=ModerationRequestStatus.EXPIRED)
        )
        
        await db.commit()
        count = result.rowcount
        logger.info(f"Expired {count} pending requests")
        return count


moderation_service = ModerationService()
