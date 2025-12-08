from typing import List, Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from loguru import logger

from app.models.case import Case, CaseVariable
from app.models.collaborator import Collaborator
from app.schemas.case import CaseCreate, CaseUpdate, CaseStatus
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
            budget=case_in.budget,
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

case_service = CaseService()
