"""
Delegation Service

Manages approval delegations between users:
- Create/revoke delegations
- Check delegation permissions  
- Execute approvals as delegate
"""

from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.collaborator import Collaborator
from app.models.case import Case, CaseVariable
from app.models.approval_delegation import (
    ApprovalDelegation, 
    DelegationScope, 
    DelegationStatus,
    AdminAction
)
from app.models.data_catalog import VariableMatch, MatchStatus
from app.services.notification_service import notification_service
from app.core.permissions import UserRole


class DelegationService:
    """Service for managing approval delegations"""
    
    async def create_delegation(
        self,
        db: AsyncSession,
        delegator_id: int,
        delegate_id: int,
        scope: DelegationScope,
        resource_id: int = None,
        valid_until: datetime = None,
        reason: str = None,
        created_by: Collaborator = None
    ) -> ApprovalDelegation:
        """
        Create a new approval delegation.
        
        Args:
            delegator_id: ID of the user delegating their approval rights
            delegate_id: ID of the user receiving delegation
            scope: Scope of the delegation (CASE, VARIABLE, ALL_CASES, ALL)
            resource_id: Specific resource ID if scope is CASE or VARIABLE
            valid_until: Expiration datetime (None = permanent)
            reason: Reason for the delegation
            created_by: User creating the delegation (usually admin or delegator)
        """
        # Verify delegator exists
        result = await db.execute(select(Collaborator).where(Collaborator.id == delegator_id))
        delegator = result.scalar_one_or_none()
        if not delegator:
            raise HTTPException(status_code=404, detail="Delegator not found")
        
        # Verify delegate exists
        result = await db.execute(select(Collaborator).where(Collaborator.id == delegate_id))
        delegate = result.scalar_one_or_none()
        if not delegate:
            raise HTTPException(status_code=404, detail="Delegate not found")
        
        # Cannot delegate to yourself
        if delegator_id == delegate_id:
            raise HTTPException(status_code=400, detail="Cannot delegate to yourself")
        
        # Validate resource exists if specific scope
        if scope in [DelegationScope.CASE, DelegationScope.VARIABLE]:
            if not resource_id:
                raise HTTPException(
                    status_code=400, 
                    detail=f"resource_id is required for {scope.value} scope"
                )
            
            if scope == DelegationScope.CASE:
                result = await db.execute(select(Case).where(Case.id == resource_id))
                if not result.scalar_one_or_none():
                    raise HTTPException(status_code=404, detail="Case not found")
            elif scope == DelegationScope.VARIABLE:
                result = await db.execute(select(CaseVariable).where(CaseVariable.id == resource_id))
                if not result.scalar_one_or_none():
                    raise HTTPException(status_code=404, detail="Variable not found")
        
        # Check for existing active delegation with same parameters
        query = select(ApprovalDelegation).where(
            ApprovalDelegation.delegator_id == delegator_id,
            ApprovalDelegation.delegate_id == delegate_id,
            ApprovalDelegation.scope == scope,
            ApprovalDelegation.status == DelegationStatus.ACTIVE
        )
        if resource_id:
            query = query.where(ApprovalDelegation.resource_id == resource_id)
        
        result = await db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail="Active delegation already exists for this combination"
            )
        
        # Create delegation
        delegation = ApprovalDelegation(
            delegator_id=delegator_id,
            delegate_id=delegate_id,
            scope=scope,
            resource_id=resource_id,
            valid_until=valid_until,
            reason=reason,
            created_by=created_by.id if created_by else delegator_id,
            status=DelegationStatus.ACTIVE
        )
        
        db.add(delegation)
        
        # Notify delegate
        scope_text = {
            DelegationScope.CASE: "um case específico",
            DelegationScope.VARIABLE: "uma variável específica",
            DelegationScope.ALL_CASES: "todos os cases",
            DelegationScope.ALL: "todas as aprovações"
        }
        
        await notification_service.create_notification(
            db=db,
            user_id=delegate_id,
            notification_type="DELEGATION_RECEIVED",
            title="Nova delegação de aprovação recebida",
            message=f"{delegator.name} delegou a você o poder de aprovação para {scope_text.get(scope, 'recursos')}.",
            related_entity_type="DELEGATION",
            related_entity_id=delegation.id if delegation.id else 0,
            priority="HIGH"
        )
        
        await db.commit()
        await db.refresh(delegation)
        
        return delegation
    
    async def list_delegations(
        self,
        db: AsyncSession,
        user_id: int = None,
        delegator_id: int = None,
        delegate_id: int = None,
        scope: DelegationScope = None,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 50
    ) -> List[ApprovalDelegation]:
        """
        List delegations with filters.
        """
        query = select(ApprovalDelegation).options(
            selectinload(ApprovalDelegation.delegator),
            selectinload(ApprovalDelegation.delegate),
            selectinload(ApprovalDelegation.creator)
        )
        
        if user_id:
            # Delegations where user is either delegator or delegate
            query = query.where(
                or_(
                    ApprovalDelegation.delegator_id == user_id,
                    ApprovalDelegation.delegate_id == user_id
                )
            )
        
        if delegator_id:
            query = query.where(ApprovalDelegation.delegator_id == delegator_id)
        
        if delegate_id:
            query = query.where(ApprovalDelegation.delegate_id == delegate_id)
        
        if scope:
            query = query.where(ApprovalDelegation.scope == scope)
        
        if active_only:
            query = query.where(ApprovalDelegation.status == DelegationStatus.ACTIVE)
            # Also filter out expired delegations
            query = query.where(
                or_(
                    ApprovalDelegation.valid_until.is_(None),
                    ApprovalDelegation.valid_until > datetime.utcnow()
                )
            )
        
        query = query.order_by(ApprovalDelegation.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def revoke_delegation(
        self,
        db: AsyncSession,
        delegation_id: int,
        revoked_by: Collaborator,
        reason: str = None
    ) -> ApprovalDelegation:
        """
        Revoke an existing delegation.
        """
        result = await db.execute(
            select(ApprovalDelegation).where(ApprovalDelegation.id == delegation_id)
        )
        delegation = result.scalar_one_or_none()
        
        if not delegation:
            raise HTTPException(status_code=404, detail="Delegation not found")
        
        if delegation.status != DelegationStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="Delegation is not active")
        
        # Check permission: admin, delegator, or delegate can revoke
        can_revoke = (
            revoked_by.role == UserRole.ADMIN.value or
            revoked_by.id == delegation.delegator_id or
            revoked_by.id == delegation.delegate_id
        )
        
        if not can_revoke:
            raise HTTPException(
                status_code=403, 
                detail="You don't have permission to revoke this delegation"
            )
        
        delegation.revoke(revoked_by.id, reason)
        
        # Notify both parties
        await notification_service.create_notification(
            db=db,
            user_id=delegation.delegate_id,
            notification_type="DELEGATION_REVOKED",
            title="Delegação revogada",
            message=f"A delegação de aprovação foi revogada por {revoked_by.name}.",
            related_entity_type="DELEGATION",
            related_entity_id=delegation_id,
            priority="MEDIUM"
        )
        
        if delegation.delegator_id != revoked_by.id:
            await notification_service.create_notification(
                db=db,
                user_id=delegation.delegator_id,
                notification_type="DELEGATION_REVOKED",
                title="Sua delegação foi revogada",
                message=f"A delegação de aprovação que você criou foi revogada por {revoked_by.name}.",
                related_entity_type="DELEGATION",
                related_entity_id=delegation_id,
                priority="MEDIUM"
            )
        
        await db.commit()
        await db.refresh(delegation)
        
        return delegation
    
    async def check_can_approve_for(
        self,
        db: AsyncSession,
        approver_id: int,
        on_behalf_of_id: int,
        scope: DelegationScope = None,
        resource_id: int = None
    ) -> bool:
        """
        Check if a user can approve on behalf of another user.
        
        Returns True if:
        - There's an active delegation from on_behalf_of to approver
        - The delegation scope covers the requested action
        """
        query = select(ApprovalDelegation).where(
            ApprovalDelegation.delegator_id == on_behalf_of_id,
            ApprovalDelegation.delegate_id == approver_id,
            ApprovalDelegation.status == DelegationStatus.ACTIVE
        )
        
        # Filter by validity
        query = query.where(
            or_(
                ApprovalDelegation.valid_until.is_(None),
                ApprovalDelegation.valid_until > datetime.utcnow()
            )
        )
        
        result = await db.execute(query)
        delegations = result.scalars().all()
        
        if not delegations:
            return False
        
        for delegation in delegations:
            # ALL scope covers everything
            if delegation.scope == DelegationScope.ALL:
                return True
            
            # ALL_CASES covers case and variable approvals
            if delegation.scope == DelegationScope.ALL_CASES and scope in [
                DelegationScope.CASE, DelegationScope.VARIABLE, DelegationScope.ALL_CASES
            ]:
                return True
            
            # Specific scope with matching resource
            if scope and delegation.scope == scope:
                if resource_id is None or delegation.resource_id is None:
                    return True
                if delegation.resource_id == resource_id:
                    return True
        
        return False
    
    async def approve_case_as_delegate(
        self,
        db: AsyncSession,
        approver: Collaborator,
        on_behalf_of_id: int,
        case_id: int
    ) -> Case:
        """
        Approve a case using delegation rights.
        """
        # Verify delegation exists
        can_approve = await self.check_can_approve_for(
            db, approver.id, on_behalf_of_id, DelegationScope.CASE, case_id
        )
        
        if not can_approve:
            raise HTTPException(
                status_code=403, 
                detail="No valid delegation to approve this case on behalf of the user"
            )
        
        # Get case
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Get on_behalf_of user
        result = await db.execute(select(Collaborator).where(Collaborator.id == on_behalf_of_id))
        on_behalf_of = result.scalar_one_or_none()
        if not on_behalf_of:
            raise HTTPException(status_code=404, detail="User not found")
        
        previous_status = case.status
        case.status = "APPROVED"
        case.updated_at = datetime.utcnow()
        case.version += 1
        
        # Log admin action for delegation approval
        action = AdminAction(
            admin_id=approver.id,
            action_type="APPROVE_AS_DELEGATE",
            entity_type="CASE",
            entity_id=case_id,
            on_behalf_of_id=on_behalf_of_id,
            previous_value=f'{{"status": "{previous_status}"}}',
            new_value='{"status": "APPROVED"}',
            reason=f"Aprovado como delegado de {on_behalf_of.name}"
        )
        db.add(action)
        
        # Notify case owner
        await notification_service.create_notification(
            db=db,
            user_id=case.created_by,
            notification_type="CASE_APPROVED",
            title="Case aprovado",
            message=f"O case '{case.title}' foi aprovado por {approver.name} em nome de {on_behalf_of.name}.",
            related_entity_type="CASE",
            related_entity_id=case_id,
            priority="HIGH"
        )
        
        await db.commit()
        await db.refresh(case)
        
        return case
    
    async def approve_variable_as_delegate(
        self,
        db: AsyncSession,
        approver: Collaborator,
        on_behalf_of_id: int,
        variable_id: int
    ) -> CaseVariable:
        """
        Approve a variable using delegation rights.
        """
        # Verify delegation exists
        can_approve = await self.check_can_approve_for(
            db, approver.id, on_behalf_of_id, DelegationScope.VARIABLE, variable_id
        )
        
        if not can_approve:
            raise HTTPException(
                status_code=403, 
                detail="No valid delegation to approve this variable on behalf of the user"
            )
        
        # Get variable
        result = await db.execute(select(CaseVariable).where(CaseVariable.id == variable_id))
        variable = result.scalar_one_or_none()
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        # Get on_behalf_of user
        result = await db.execute(select(Collaborator).where(Collaborator.id == on_behalf_of_id))
        on_behalf_of = result.scalar_one_or_none()
        if not on_behalf_of:
            raise HTTPException(status_code=404, detail="User not found")
        
        previous_status = variable.search_status
        variable.search_status = "APPROVED"
        
        # Update match if exists
        if variable.selected_match_id:
            result = await db.execute(
                select(VariableMatch).where(VariableMatch.id == variable.selected_match_id)
            )
            match = result.scalar_one_or_none()
            if match:
                match.status = MatchStatus.APPROVED
                match.approved_at = datetime.utcnow()
                match.approved_by = on_behalf_of_id
        
        # Log action
        action = AdminAction(
            admin_id=approver.id,
            action_type="APPROVE_AS_DELEGATE",
            entity_type="VARIABLE",
            entity_id=variable_id,
            on_behalf_of_id=on_behalf_of_id,
            previous_value=f'{{"search_status": "{previous_status}"}}',
            new_value='{"search_status": "APPROVED"}',
            reason=f"Aprovado como delegado de {on_behalf_of.name}"
        )
        db.add(action)
        
        # Notify case owner
        result = await db.execute(select(Case).where(Case.id == variable.case_id))
        case = result.scalar_one_or_none()
        
        if case:
            await notification_service.create_notification(
                db=db,
                user_id=case.created_by,
                notification_type="VARIABLE_APPROVED",
                title="Variável aprovada",
                message=f"A variável '{variable.variable_name}' foi aprovada por {approver.name} em nome de {on_behalf_of.name}.",
                related_entity_type="CASE",
                related_entity_id=case.id,
                priority="MEDIUM"
            )
        
        await db.commit()
        await db.refresh(variable)
        
        return variable
    
    async def get_delegations_for_user(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Dict:
        """
        Get all delegations given and received by a user.
        """
        # Delegations given (user is delegator)
        given = await self.list_delegations(db, delegator_id=user_id, active_only=True)
        
        # Delegations received (user is delegate)
        received = await self.list_delegations(db, delegate_id=user_id, active_only=True)
        
        return {
            "given": given,
            "received": received,
            "given_count": len(given),
            "received_count": len(received)
        }
    
    async def expire_outdated_delegations(self, db: AsyncSession) -> int:
        """
        Mark expired delegations as expired.
        Returns count of delegations expired.
        """
        result = await db.execute(
            select(ApprovalDelegation).where(
                ApprovalDelegation.status == DelegationStatus.ACTIVE,
                ApprovalDelegation.valid_until.isnot(None),
                ApprovalDelegation.valid_until <= datetime.utcnow()
            )
        )
        delegations = result.scalars().all()
        
        for delegation in delegations:
            delegation.expire()
        
        await db.commit()
        
        return len(delegations)


delegation_service = DelegationService()
