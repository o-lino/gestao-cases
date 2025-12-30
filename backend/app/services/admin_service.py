"""
Admin Service

Provides superuser/administrator operations for cases and variables.
All operations are logged to AdminAction audit trail.
"""

import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.case import Case, CaseVariable
from app.models.collaborator import Collaborator
from app.models.approval_delegation import AdminAction, ApprovalDelegation, DelegationScope, DelegationStatus
from app.models.data_catalog import DataTable, VariableMatch, MatchStatus
from app.schemas.case import CaseStatus
from app.services.notification_service import notification_service
from app.core.permissions import UserRole


class AdminService:
    """Service for superuser/administrator operations"""
    
    # =========================================================================
    # AUDIT LOGGING
    # =========================================================================
    
    async def _log_admin_action(
        self,
        db: AsyncSession,
        admin: Collaborator,
        action_type: str,
        entity_type: str,
        entity_id: int,
        previous_value: dict = None,
        new_value: dict = None,
        reason: str = None,
        on_behalf_of_id: int = None
    ) -> AdminAction:
        """Log an administrative action for audit trail"""
        action = AdminAction(
            admin_id=admin.id,
            action_type=action_type,
            entity_type=entity_type,
            entity_id=entity_id,
            previous_value=json.dumps(previous_value) if previous_value else None,
            new_value=json.dumps(new_value) if new_value else None,
            reason=reason,
            on_behalf_of_id=on_behalf_of_id
        )
        db.add(action)
        return action
    
    # =========================================================================
    # CASE OPERATIONS
    # =========================================================================
    
    async def admin_update_case(
        self,
        db: AsyncSession,
        case_id: int,
        update_data: Dict[str, Any],
        admin_user: Collaborator,
        reason: str = None
    ) -> Case:
        """
        Update any field of a case as admin, bypassing ownership checks.
        """
        # Verify admin role
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required"
            )
        
        # Get case
        result = await db.execute(
            select(Case).where(Case.id == case_id).options(selectinload(Case.variables))
        )
        case = result.scalar_one_or_none()
        
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Store previous values for audit
        previous_values = {
            field: getattr(case, field) 
            for field in update_data.keys() 
            if hasattr(case, field)
        }
        
        # Apply updates
        for field, value in update_data.items():
            if hasattr(case, field):
                setattr(case, field, value)
        
        case.updated_at = datetime.utcnow()
        case.version += 1
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "UPDATE_CASE", "CASE", case_id,
            previous_value=previous_values,
            new_value=update_data,
            reason=reason
        )
        
        await db.commit()
        await db.refresh(case)
        
        return case
    
    async def admin_assign_case_owner(
        self,
        db: AsyncSession,
        case_id: int,
        new_owner_id: int,
        admin_user: Collaborator,
        reason: str = None
    ) -> Case:
        """
        Assign or reassign the owner of a case.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        # Verify case exists
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Verify new owner exists
        result = await db.execute(select(Collaborator).where(Collaborator.id == new_owner_id))
        new_owner = result.scalar_one_or_none()
        if not new_owner:
            raise HTTPException(status_code=404, detail="New owner not found")
        
        previous_owner_id = case.created_by
        case.created_by = new_owner_id
        case.updated_at = datetime.utcnow()
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "ASSIGN_OWNER", "CASE", case_id,
            previous_value={"created_by": previous_owner_id},
            new_value={"created_by": new_owner_id},
            reason=reason
        )
        
        # Notify new owner
        await notification_service.create_notification(
            db=db,
            user_id=new_owner_id,
            notification_type="CASE_ASSIGNED",
            title="Case atribuído a você",
            message=f"O case '{case.title}' foi atribuído a você pelo administrador.",
            related_entity_type="CASE",
            related_entity_id=case_id,
            priority="HIGH"
        )
        
        await db.commit()
        await db.refresh(case)
        
        return case
    
    async def admin_force_status(
        self,
        db: AsyncSession,
        case_id: int,
        target_status: CaseStatus,
        admin_user: Collaborator,
        reason: str
    ) -> Case:
        """
        Force a status change on a case, bypassing normal workflow rules.
        Requires a reason for audit purposes.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        if not reason:
            raise HTTPException(status_code=400, detail="Reason is required for forced status change")
        
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        previous_status = case.status
        case.status = target_status.value if isinstance(target_status, CaseStatus) else target_status
        case.updated_at = datetime.utcnow()
        case.version += 1
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "FORCE_STATUS", "CASE", case_id,
            previous_value={"status": previous_status},
            new_value={"status": case.status},
            reason=reason
        )
        
        # Notify case owner
        await notification_service.create_notification(
            db=db,
            user_id=case.created_by,
            notification_type="CASE_STATUS_CHANGED",
            title="Status do case alterado pelo administrador",
            message=f"O status do case '{case.title}' foi alterado de {previous_status} para {case.status} pelo administrador. Motivo: {reason}",
            related_entity_type="CASE",
            related_entity_id=case_id,
            priority="HIGH"
        )
        
        await db.commit()
        await db.refresh(case)
        
        return case
    
    async def admin_force_approve_case(
        self,
        db: AsyncSession,
        case_id: int,
        admin_user: Collaborator,
        on_behalf_of_id: int = None,
        reason: str = None
    ) -> Case:
        """
        Force approval of a case, optionally on behalf of another user.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        result = await db.execute(select(Case).where(Case.id == case_id))
        case = result.scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        previous_status = case.status
        case.status = CaseStatus.APPROVED.value
        case.updated_at = datetime.utcnow()
        case.version += 1
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "FORCE_APPROVE", "CASE", case_id,
            previous_value={"status": previous_status},
            new_value={"status": case.status},
            reason=reason or "Aprovação forçada pelo administrador",
            on_behalf_of_id=on_behalf_of_id
        )
        
        # Notify case owner
        on_behalf_text = ""
        if on_behalf_of_id:
            result = await db.execute(select(Collaborator).where(Collaborator.id == on_behalf_of_id))
            on_behalf_user = result.scalar_one_or_none()
            if on_behalf_user:
                on_behalf_text = f" em nome de {on_behalf_user.name}"
        
        await notification_service.create_notification(
            db=db,
            user_id=case.created_by,
            notification_type="CASE_APPROVED",
            title="Case aprovado",
            message=f"O case '{case.title}' foi aprovado pelo administrador{on_behalf_text}.",
            related_entity_type="CASE",
            related_entity_id=case_id,
            priority="HIGH"
        )
        
        await db.commit()
        await db.refresh(case)
        
        return case
    
    # =========================================================================
    # VARIABLE OPERATIONS
    # =========================================================================
    
    async def admin_update_variable(
        self,
        db: AsyncSession,
        variable_id: int,
        update_data: Dict[str, Any],
        admin_user: Collaborator,
        reason: str = None
    ) -> CaseVariable:
        """
        Update any field of a variable as admin.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        result = await db.execute(select(CaseVariable).where(CaseVariable.id == variable_id))
        variable = result.scalar_one_or_none()
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        # Store previous values
        previous_values = {
            field: getattr(variable, field) 
            for field in update_data.keys() 
            if hasattr(variable, field)
        }
        
        # Apply updates
        for field, value in update_data.items():
            if hasattr(variable, field):
                setattr(variable, field, value)
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "UPDATE_VARIABLE", "VARIABLE", variable_id,
            previous_value=previous_values,
            new_value=update_data,
            reason=reason
        )
        
        await db.commit()
        await db.refresh(variable)
        
        return variable
    
    async def admin_assign_table(
        self,
        db: AsyncSession,
        variable_id: int,
        table_id: int,
        admin_user: Collaborator,
        reason: str = None
    ) -> CaseVariable:
        """
        Assign a data table to a variable, creating a match if needed.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        # Get variable
        result = await db.execute(select(CaseVariable).where(CaseVariable.id == variable_id))
        variable = result.scalar_one_or_none()
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        # Get table
        result = await db.execute(select(DataTable).where(DataTable.id == table_id))
        table = result.scalar_one_or_none()
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        
        # Check for existing match
        result = await db.execute(
            select(VariableMatch).where(
                VariableMatch.case_variable_id == variable_id,
                VariableMatch.table_id == table_id
            )
        )
        existing_match = result.scalar_one_or_none()
        
        if existing_match:
            # Update existing match
            match = existing_match
            match.status = MatchStatus.ADMIN_ASSIGNED
            match.confidence_score = 1.0
        else:
            # Create new match
            match = VariableMatch(
                case_variable_id=variable_id,
                table_id=table_id,
                confidence_score=1.0,
                status=MatchStatus.ADMIN_ASSIGNED,
                matched_by="admin"
            )
            db.add(match)
            await db.flush()
        
        # Update variable
        previous_match_id = variable.selected_match_id
        variable.selected_match_id = match.id
        variable.search_status = "OWNER_REVIEW"
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "ASSIGN_TABLE", "VARIABLE", variable_id,
            previous_value={"selected_match_id": previous_match_id},
            new_value={"selected_match_id": match.id, "table_id": table_id},
            reason=reason
        )
        
        # Notify table owner
        if table.owner_id:
            await notification_service.create_notification(
                db=db,
                user_id=table.owner_id,
                notification_type="TABLE_ASSIGNED",
                title="Tabela atribuída a variável",
                message=f"A tabela '{table.display_name or table.name}' foi atribuída à variável '{variable.variable_name}' pelo administrador. Por favor, revise e aprove.",
                related_entity_type="VARIABLE",
                related_entity_id=variable_id,
                priority="HIGH"
            )
        
        await db.commit()
        await db.refresh(variable)
        
        return variable
    
    async def admin_assign_table_owner(
        self,
        db: AsyncSession,
        variable_id: int,
        owner_id: int,
        admin_user: Collaborator,
        reason: str = None
    ) -> CaseVariable:
        """
        Assign or reassign the owner of the table associated with a variable.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        # Get variable with match
        result = await db.execute(select(CaseVariable).where(CaseVariable.id == variable_id))
        variable = result.scalar_one_or_none()
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        if not variable.selected_match_id:
            raise HTTPException(status_code=400, detail="Variable has no assigned table")
        
        # Get match and table
        result = await db.execute(
            select(VariableMatch).where(VariableMatch.id == variable.selected_match_id)
        )
        match = result.scalar_one_or_none()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        
        result = await db.execute(select(DataTable).where(DataTable.id == match.table_id))
        table = result.scalar_one_or_none()
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        
        # Verify new owner exists
        result = await db.execute(select(Collaborator).where(Collaborator.id == owner_id))
        new_owner = result.scalar_one_or_none()
        if not new_owner:
            raise HTTPException(status_code=404, detail="New owner not found")
        
        previous_owner_id = table.owner_id
        table.owner_id = owner_id
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "ASSIGN_OWNER", "VARIABLE", variable_id,
            previous_value={"table_owner_id": previous_owner_id},
            new_value={"table_owner_id": owner_id},
            reason=reason
        )
        
        # Notify new owner
        await notification_service.create_notification(
            db=db,
            user_id=owner_id,
            notification_type="TABLE_OWNER_ASSIGNED",
            title="Você agora é responsável por uma tabela",
            message=f"Você foi designado como responsável pela tabela '{table.display_name or table.name}' pelo administrador.",
            related_entity_type="VARIABLE",
            related_entity_id=variable_id,
            priority="HIGH"
        )
        
        await db.commit()
        await db.refresh(variable)
        
        return variable
    
    async def admin_force_approve_variable(
        self,
        db: AsyncSession,
        variable_id: int,
        admin_user: Collaborator,
        on_behalf_of_id: int = None,
        reason: str = None
    ) -> CaseVariable:
        """
        Force approval of a variable, optionally on behalf of another user.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        result = await db.execute(select(CaseVariable).where(CaseVariable.id == variable_id))
        variable = result.scalar_one_or_none()
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        previous_status = variable.search_status
        variable.search_status = "APPROVED"
        
        # Update match status if exists
        if variable.selected_match_id:
            result = await db.execute(
                select(VariableMatch).where(VariableMatch.id == variable.selected_match_id)
            )
            match = result.scalar_one_or_none()
            if match:
                match.status = MatchStatus.APPROVED
                match.approved_at = datetime.utcnow()
                match.approved_by = on_behalf_of_id or admin_user.id
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "FORCE_APPROVE", "VARIABLE", variable_id,
            previous_value={"search_status": previous_status},
            new_value={"search_status": "APPROVED"},
            reason=reason or "Aprovação forçada pelo administrador",
            on_behalf_of_id=on_behalf_of_id
        )
        
        # Get case to notify owner
        result = await db.execute(select(Case).where(Case.id == variable.case_id))
        case = result.scalar_one_or_none()
        
        if case:
            on_behalf_text = ""
            if on_behalf_of_id:
                result = await db.execute(select(Collaborator).where(Collaborator.id == on_behalf_of_id))
                on_behalf_user = result.scalar_one_or_none()
                if on_behalf_user:
                    on_behalf_text = f" em nome de {on_behalf_user.name}"
            
            await notification_service.create_notification(
                db=db,
                user_id=case.created_by,
                notification_type="VARIABLE_APPROVED",
                title="Variável aprovada",
                message=f"A variável '{variable.variable_name}' foi aprovada pelo administrador{on_behalf_text}.",
                related_entity_type="CASE",
                related_entity_id=case.id,
                priority="MEDIUM"
            )
        
        await db.commit()
        await db.refresh(variable)
        
        return variable
    
    async def admin_force_variable_status(
        self,
        db: AsyncSession,
        variable_id: int,
        target_status: str,
        admin_user: Collaborator,
        reason: str
    ) -> CaseVariable:
        """
        Force a status change on a variable.
        """
        if admin_user.role != UserRole.ADMIN.value:
            raise HTTPException(status_code=403, detail="Admin role required")
        
        if not reason:
            raise HTTPException(status_code=400, detail="Reason is required for forced status change")
        
        valid_statuses = ["PENDING", "SEARCHING", "MATCHED", "NO_MATCH", "OWNER_REVIEW", "APPROVED", "REJECTED"]
        if target_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        result = await db.execute(select(CaseVariable).where(CaseVariable.id == variable_id))
        variable = result.scalar_one_or_none()
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        previous_status = variable.search_status
        variable.search_status = target_status
        
        # Log admin action
        await self._log_admin_action(
            db, admin_user, "FORCE_STATUS", "VARIABLE", variable_id,
            previous_value={"search_status": previous_status},
            new_value={"search_status": target_status},
            reason=reason
        )
        
        await db.commit()
        await db.refresh(variable)
        
        return variable
    
    # =========================================================================
    # QUERIES
    # =========================================================================
    
    async def get_admin_actions(
        self,
        db: AsyncSession,
        entity_type: str = None,
        entity_id: int = None,
        admin_id: int = None,
        action_type: str = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[AdminAction]:
        """
        Query admin actions with filters.
        """
        query = select(AdminAction).options(
            selectinload(AdminAction.admin),
            selectinload(AdminAction.on_behalf_of)
        )
        
        if entity_type:
            query = query.where(AdminAction.entity_type == entity_type)
        if entity_id:
            query = query.where(AdminAction.entity_id == entity_id)
        if admin_id:
            query = query.where(AdminAction.admin_id == admin_id)
        if action_type:
            query = query.where(AdminAction.action_type == action_type)
        
        query = query.order_by(AdminAction.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()


admin_service = AdminService()
