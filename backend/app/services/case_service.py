from typing import List, Optional, Any, Dict
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from loguru import logger

from app.models.case import Case, CaseVariable
from app.models.collaborator import Collaborator
from app.schemas.case import CaseCreate, CaseUpdate, CaseStatus, CaseVariableCreate, CaseVariableCancel
from app.services.workflow import workflow_service
from app.services.validation import validate_case_variables
from app.services.audit_service import audit_service
from app.schemas.common import PaginatedResponse
from app.services.notification_service import notification_service

class CaseService:
    async def create(
        self,
        db: AsyncSession,
        case_in: CaseCreate,
        current_user: Collaborator
    ) -> Case:
        logger.info(f"Creating new case: {case_in.title} by user {current_user.id}")
        
        # Create Case instance
        db_case = Case(
            title=case_in.title,
            description=case_in.description,
            client_name=case_in.client_name,
            requester_email=case_in.requester_email,
            macro_case=case_in.macro_case,
            context=case_in.context,
            impact=case_in.impact,
            necessity=case_in.necessity,
            impacted_journey=case_in.impacted_journey,
            impacted_segment=case_in.impacted_segment,
            impacted_customers=case_in.impacted_customers,
            start_date=case_in.start_date,
            end_date=case_in.end_date,
            created_by=current_user.id,
            status=CaseStatus.DRAFT
        )
        db.add(db_case)
        await db.flush() # Get ID

        # Create Variables
        if case_in.variables:
            try:
                # Validate all variables first
                validate_case_variables(case_in.variables)
            except Exception as e:
                logger.error(f"Variable validation failed for case {case_in.title}: {str(e)}")
                raise e
            
            for var in case_in.variables:
                db_var = CaseVariable(
                    case_id=db_case.id,
                    variable_name=var.variable_name,
                    variable_value=var.variable_value,
                    variable_type=var.variable_type,
                    is_required=var.is_required,
                    product=var.product,
                    concept=var.concept,
                    min_history=var.min_history,
                    priority=var.priority,
                    desired_lag=var.desired_lag,
                    options=var.options
                )
                db.add(db_var)
        
        await db.commit()
        await db.refresh(db_case)
        
        # Log case creation
        await audit_service.log_action(
            db=db,
            entity_type="CASE",
            entity_id=db_case.id,
            actor_id=current_user.id,
            action_type="CREATE",
            changes={
                "action": "Case criado",
                "title": db_case.title,
                "variables_count": len(case_in.variables) if case_in.variables else 0
            }
        )
        await db.commit()
        
        logger.info(f"Case created successfully: {db_case.id}")
        return await self.get(db, db_case.id)

    async def get(self, db: AsyncSession, case_id: int) -> Optional[Case]:
        result = await db.execute(
            select(Case)
            .options(selectinload(Case.variables))
            .where(Case.id == case_id)
        )
        return result.scalars().first()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        status: Optional[CaseStatus] = None,
        created_by: Optional[int] = None
    ) -> PaginatedResponse:
        # Build query
        query = select(Case).options(selectinload(Case.variables))
        
        if status:
            query = query.where(Case.status == status)
        if created_by:
            query = query.where(Case.created_by == created_by)
        
        # Get total count
        count_query = select(func.count()).select_from(Case)
        if status:
            count_query = count_query.where(Case.status == status)
        if created_by:
            count_query = count_query.where(Case.created_by == created_by)
        
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Get paginated results
        query = query.offset(skip).limit(limit).order_by(desc(Case.created_at))
        result = await db.execute(query)
        items = result.scalars().all()
        
        # Calculate page number
        page = (skip // limit) + 1 if limit > 0 else 1
        
        return PaginatedResponse.create(
            items=items,
            total=total,
            page=page,
            size=limit
        )

    async def update(
        self,
        db: AsyncSession,
        case_id: int,
        case_in: CaseUpdate,
        current_user: Collaborator
    ) -> Case:
        logger.info(f"Updating case {case_id} by user {current_user.id}")
        case = await self.get(db, case_id)
        if not case:
            logger.warning(f"Case {case_id} not found for update")
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Update fields and track changes
        update_data = case_in.dict(exclude_unset=True)
        changes = {}
        
        for field, value in update_data.items():
            if hasattr(case, field):
                old_value = getattr(case, field)
                if old_value != value:
                    setattr(case, field, value)
                    changes[field] = {"old": str(old_value), "new": str(value)}
        
        if changes:
            await audit_service.log_action(
                db=db,
                entity_type="CASE",
                entity_id=case.id,
                actor_id=current_user.id,
                action_type="UPDATE",
                changes=changes
            )
            logger.info(f"Case {case_id} updated. Changes: {changes}")
        else:
            logger.info(f"No changes detected for case {case_id}")
        
        await db.commit()
        await db.refresh(case)
        
        return await self.get(db, case_id)

    async def transition(
        self,
        db: AsyncSession,
        case_id: int,
        target_status: CaseStatus,
        current_user: Collaborator
    ) -> Case:
        logger.info(f"Transitioning case {case_id} to {target_status} by user {current_user.id}")
        case = await self.get(db, case_id)
        if not case:
            logger.warning(f"Case {case_id} not found for transition")
            raise HTTPException(status_code=404, detail="Case not found")
        
        try:
            # Validate Transition
            workflow_service.validate_transition(case.status, target_status, current_user)
        except Exception as e:
            logger.error(f"Transition validation failed for case {case_id}: {str(e)}")
            raise e
        
        # Special validation for closing case - all variables must be approved
        if target_status == CaseStatus.CLOSED:
            can_close, message = workflow_service.validate_can_close(case.variables)
            if not can_close:
                logger.warning(f"Cannot close case {case_id}: {message}")
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=message
                )
        
        # Capture old status for audit
        old_status = case.status
        
        # Update Status
        case.status = target_status
        
        # Create Audit Log
        await audit_service.log_action(
            db=db,
            entity_type="CASE",
            entity_id=case.id,
            actor_id=current_user.id,
            action_type="TRANSITION",
            changes={"status": {"old": old_status, "new": target_status}}
        )
        
        await db.commit()
        await db.refresh(case)
        
        # Send Notification
        if case.requester_email:
            await notification_service.notify_status_change(case.id, old_status, target_status, case.requester_email)

        logger.info(f"Case {case_id} transitioned successfully to {target_status}")
        return await self.get(db, case_id)

    async def cancel(
        self,
        db: AsyncSession,
        case_id: int,
        current_user: Collaborator,
        reason: Optional[str] = None
    ) -> Case:
        """Cancel a case and all its active variables."""
        logger.info(f"Cancelling case {case_id} by user {current_user.id}")
        case = await self.get(db, case_id)
        if not case:
            logger.warning(f"Case {case_id} not found for cancellation")
            raise HTTPException(status_code=404, detail="Case not found")
        
        if case.status == CaseStatus.CLOSED:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Não é possível cancelar um case já fechado"
            )
        
        # Validate transition
        workflow_service.validate_transition(case.status, CaseStatus.CANCELLED, current_user)
        
        old_status = case.status
        case.status = CaseStatus.CANCELLED
        
        # Cancel all active variables
        cancelled_count = 0
        for variable in case.variables:
            if not variable.is_cancelled:
                variable.is_cancelled = True
                variable.cancelled_at = datetime.utcnow()
                variable.cancelled_by = current_user.id
                variable.cancellation_reason = reason or "Case cancelado"
                cancelled_count += 1
        
        # Create Audit Log
        await audit_service.log_action(
            db=db,
            entity_type="CASE",
            entity_id=case.id,
            actor_id=current_user.id,
            action_type="CANCEL",
            changes={
                "status": {"old": old_status, "new": CaseStatus.CANCELLED},
                "reason": reason or "Não informado",
                "variables_cancelled": cancelled_count
            }
        )
        
        await db.commit()
        await db.refresh(case)
        
        # Send Notification
        if case.requester_email:
            await notification_service.notify_status_change(case.id, old_status, CaseStatus.CANCELLED, case.requester_email)
        
        logger.info(f"Case {case_id} cancelled successfully. {cancelled_count} variables cancelled.")
        return await self.get(db, case_id)

    async def add_variable(
        self,
        db: AsyncSession,
        case_id: int,
        variable_in: CaseVariableCreate,
        current_user: Collaborator
    ) -> CaseVariable:
        logger.info(f"Adding variable {variable_in.variable_name} to case {case_id} by {current_user.id}")
        
        # Verify case exists
        case = await self.get(db, case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        # Check case status
        if case.status not in ["DRAFT", "REVIEW", "SUBMITTED", "APPROVED"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot add variables to case in status {case.status}"
            )
        
        # Check if variable exists
        existing = await db.execute(
            select(CaseVariable).where(
                CaseVariable.case_id == case_id,
                CaseVariable.variable_name == variable_in.variable_name,
                CaseVariable.is_cancelled == False
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Variable '{variable_in.variable_name}' already exists in this case"
            )
        
        # Create variable
        db_variable = CaseVariable(
            case_id=case_id,
            variable_name=variable_in.variable_name,
            variable_value=variable_in.variable_value,
            variable_type=variable_in.variable_type,
            is_required=variable_in.is_required,
            product=variable_in.product,
            concept=variable_in.concept,
            min_history=variable_in.min_history,
            priority=variable_in.priority,
            desired_lag=variable_in.desired_lag,
            options=variable_in.options,
        )
        db.add(db_variable)
        await db.flush()
        
        # Notify approvers
        approvers_result = await db.execute(
            select(Collaborator).where(Collaborator.role.in_(["MANAGER", "ADMIN"]))
        )
        approvers = approvers_result.scalars().all()
        
        for approver in approvers:
            if approver.id != current_user.id:
                await notification_service.notify_variable_added(
                    db=db,
                    approver_id=approver.id,
                    case_id=case_id,
                    case_title=case.title,
                    variable_id=db_variable.id,
                    variable_name=variable_in.variable_name,
                    added_by_name=current_user.name or current_user.email
                )
        
        if case.assigned_to_id and case.assigned_to_id != current_user.id:
            await notification_service.notify_variable_added(
                db=db,
                approver_id=case.assigned_to_id,
                case_id=case_id,
                case_title=case.title,
                variable_id=db_variable.id,
                variable_name=variable_in.variable_name,
                added_by_name=current_user.name or current_user.email
            )
        
        # Audit
        await audit_service.log_action(
            db=db,
            entity_type="CASE",
            entity_id=case_id,
            actor_id=current_user.id,
            action_type="ADD_VARIABLE",
            changes={
                "action": "Variável adicionada",
                "variable_name": variable_in.variable_name,
                "variable_type": variable_in.variable_type,
                "product": variable_in.product or "N/A",
                "priority": variable_in.priority or "N/A"
            }
        )
        
        await db.commit()
        await db.refresh(db_variable)
        return db_variable

    async def cancel_variable(
        self,
        db: AsyncSession,
        case_id: int,
        variable_id: int,
        cancel_in: CaseVariableCancel,
        current_user: Collaborator
    ) -> CaseVariable:
        logger.info(f"Cancelling variable {variable_id} in case {case_id} by {current_user.id}")
        
        case = await self.get(db, case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        if case.status not in ["DRAFT", "REVIEW", "SUBMITTED", "APPROVED"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot cancel variables in case with status {case.status}"
            )
        
        variable_result = await db.execute(
            select(CaseVariable).where(
                CaseVariable.id == variable_id,
                CaseVariable.case_id == case_id
            )
        )
        variable = variable_result.scalars().first()
        
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        if variable.is_cancelled:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Variable is already cancelled"
            )
        
        variable.is_cancelled = True
        variable.cancelled_at = datetime.utcnow()
        variable.cancelled_by = current_user.id
        variable.cancellation_reason = cancel_in.reason
        
        # Notifications logic
        recipients_to_notify = set()
        if case.created_by and case.created_by != current_user.id:
            recipients_to_notify.add(case.created_by)
        if case.assigned_to_id and case.assigned_to_id != current_user.id:
            recipients_to_notify.add(case.assigned_to_id)
            
        # Try to notify table owner if matched
        if variable.selected_match_id:
            try:
                from app.models.matching import VariableMatch
                match_result = await db.execute(
                    select(VariableMatch).where(VariableMatch.id == variable.selected_match_id)
                )
                match = match_result.scalars().first()
                if match and hasattr(match, 'approved_by') and match.approved_by:
                    if match.approved_by != current_user.id:
                        recipients_to_notify.add(match.approved_by)
            except Exception:
                pass

        # Notify admins/managers
        approvers_result = await db.execute(
            select(Collaborator).where(Collaborator.role.in_(["MANAGER", "ADMIN"]))
        )
        approvers = approvers_result.scalars().all()
        for approver in approvers:
            if approver.id != current_user.id:
                recipients_to_notify.add(approver.id)
        
        for recipient_id in recipients_to_notify:
            await notification_service.notify_variable_cancelled(
                db=db,
                recipient_id=recipient_id,
                case_id=case_id,
                case_title=case.title,
                variable_id=variable_id,
                variable_name=variable.variable_name,
                cancelled_by_name=current_user.name or current_user.email,
                reason=cancel_in.reason
            )
            
        await audit_service.log_action(
            db=db,
            entity_type="CASE",
            entity_id=case_id,
            actor_id=current_user.id,
            action_type="CANCEL_VARIABLE",
            changes={
                "action": "Variável cancelada",
                "variable_name": variable.variable_name,
                "reason": cancel_in.reason or "Não informado"
            }
        )
        
        await db.commit()
        await db.refresh(variable)
        return variable

    async def delete_variable(
        self,
        db: AsyncSession,
        case_id: int,
        variable_id: int,
        current_user: Collaborator
    ) -> None:
        from sqlalchemy import delete
        
        logger.info(f"Deleting variable {variable_id} in case {case_id} by {current_user.id}")
        
        case = await self.get(db, case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        
        if case.status in ["CLOSED", "CANCELLED"]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Não é possível excluir variáveis de um case com status {case.status}"
            )
        
        variable_result = await db.execute(
            select(CaseVariable).where(
                CaseVariable.id == variable_id,
                CaseVariable.case_id == case_id
            )
        )
        variable = variable_result.scalars().first()
        
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        variable_name = variable.variable_name
        variable_type = variable.variable_type
        
        await db.execute(
            delete(CaseVariable).where(CaseVariable.id == variable_id)
        )
        
        await audit_service.log_action(
            db=db,
            entity_type="CASE",
            entity_id=case_id,
            actor_id=current_user.id,
            action_type="DELETE_VARIABLE",
            changes={
                "action": "Variável excluída permanentemente",
                "variable_name": variable_name,
                "variable_type": variable_type
            }
        )
        
        await db.commit()
        return None

case_service = CaseService()
