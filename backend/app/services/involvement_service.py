"""
Involvement Service

Business logic for managing involvement requests (data creation requests).
Handles the workflow from creation to completion, including reminder notifications.
"""

from datetime import datetime, date
from typing import List, Optional, Tuple
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.involvement import Involvement, InvolvementStatus
from app.models.case import Case, CaseVariable
from app.models.collaborator import Collaborator
from app.models.data_catalog import VariableSearchStatus
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.schemas.involvement import (
    InvolvementCreate,
    InvolvementSetDate,
    InvolvementComplete,
    InvolvementResponse,
    InvolvementStats,
)


class InvolvementError(Exception):
    """Custom exception for involvement operations"""
    pass


class InvolvementService:
    """Service for managing involvement requests"""
    
    @classmethod
    async def create_involvement(
        cls,
        db: AsyncSession,
        data: InvolvementCreate,
        requester_id: int,
        owner_id: int
    ) -> Involvement:
        """
        Create a new involvement request.
        Called when owner rejects a match saying data doesn't exist.
        """
        # Verify variable exists
        result = await db.execute(
            select(CaseVariable)
            .options(selectinload(CaseVariable.case))
            .where(CaseVariable.id == data.case_variable_id)
        )
        variable = result.scalars().first()
        
        if not variable:
            raise InvolvementError(f"Variable {data.case_variable_id} not found")
        
        # Check if involvement already exists for this variable
        existing = await db.execute(
            select(Involvement).where(
                Involvement.case_variable_id == data.case_variable_id,
                Involvement.status != InvolvementStatus.COMPLETED
            )
        )
        if existing.scalars().first():
            raise InvolvementError("An active involvement already exists for this variable")
        
        # Create involvement
        involvement = Involvement(
            case_variable_id=data.case_variable_id,
            external_request_number=data.external_request_number,
            external_system=data.external_system,
            requester_id=requester_id,
            owner_id=owner_id,
            notes=data.notes,
            status=InvolvementStatus.PENDING
        )
        db.add(involvement)
        
        # Update variable status
        variable.search_status = VariableSearchStatus.PENDING_INVOLVEMENT.value
        
        # Notify owner about new involvement
        notification = Notification(
            user_id=owner_id,
            type=NotificationType.INVOLVEMENT_CREATED,
            priority=NotificationPriority.HIGH,
            title="Novo Envolvimento de Criação de Dados",
            message=f"Um envolvimento foi criado para a variável '{variable.variable_name}'. "
                    f"Número da requisição externa: {data.external_request_number}. "
                    "Por favor, defina uma data esperada para conclusão.",
            case_id=variable.case_id,
            variable_id=variable.id,
            action_url=f"/cases/{variable.case_id}?tab=variables&variable={variable.id}",
            action_label="Ver Envolvimento"
        )
        db.add(notification)
        
        await db.commit()
        await db.refresh(involvement)
        
        return involvement
    
    @classmethod
    async def set_expected_date(
        cls,
        db: AsyncSession,
        involvement_id: int,
        data: InvolvementSetDate,
        owner_id: int
    ) -> Involvement:
        """
        Owner sets the expected completion date.
        """
        result = await db.execute(
            select(Involvement)
            .options(
                selectinload(Involvement.case_variable).selectinload(CaseVariable.case),
                selectinload(Involvement.requester)
            )
            .where(Involvement.id == involvement_id)
        )
        involvement = result.scalars().first()
        
        if not involvement:
            raise InvolvementError("Involvement not found")
        
        if involvement.owner_id != owner_id:
            raise InvolvementError("Only the owner can set the expected date")
        
        if involvement.status == InvolvementStatus.COMPLETED:
            raise InvolvementError("Involvement is already completed")
        
        # Update involvement
        involvement.set_expected_date(data.expected_completion_date)
        if data.notes:
            involvement.notes = (involvement.notes or "") + f"\n[{datetime.now().strftime('%Y-%m-%d')}] {data.notes}"
        
        # Notify requester
        variable = involvement.case_variable
        notification = Notification(
            user_id=involvement.requester_id,
            type=NotificationType.INVOLVEMENT_DATE_SET,
            priority=NotificationPriority.NORMAL,
            title="Data de Conclusão Definida",
            message=f"O responsável definiu a data esperada para {data.expected_completion_date.strftime('%d/%m/%Y')} "
                    f"para a criação de dados da variável '{variable.variable_name}'.",
            case_id=variable.case_id,
            variable_id=variable.id,
            action_url=f"/cases/{variable.case_id}?tab=variables",
            action_label="Ver Case"
        )
        db.add(notification)
        
        await db.commit()
        await db.refresh(involvement)
        
        return involvement
    
    @classmethod
    async def complete_involvement(
        cls,
        db: AsyncSession,
        involvement_id: int,
        data: InvolvementComplete,
        owner_id: int
    ) -> Involvement:
        """
        Owner completes the involvement by informing created table/concept.
        """
        result = await db.execute(
            select(Involvement)
            .options(
                selectinload(Involvement.case_variable).selectinload(CaseVariable.case),
                selectinload(Involvement.requester)
            )
            .where(Involvement.id == involvement_id)
        )
        involvement = result.scalars().first()
        
        if not involvement:
            raise InvolvementError("Involvement not found")
        
        if involvement.owner_id != owner_id:
            raise InvolvementError("Only the owner can complete the involvement")
        
        if involvement.status == InvolvementStatus.COMPLETED:
            raise InvolvementError("Involvement is already completed")
        
        # Complete the involvement
        involvement.complete(data.created_table_name, data.created_concept)
        if data.notes:
            involvement.notes = (involvement.notes or "") + f"\n[{datetime.now().strftime('%Y-%m-%d')}] Conclusão: {data.notes}"
        
        # Update variable status back to MATCHED so requester can continue the flow
        variable = involvement.case_variable
        variable.search_status = VariableSearchStatus.MATCHED.value
        
        # Notify requester
        notification = Notification(
            user_id=involvement.requester_id,
            type=NotificationType.INVOLVEMENT_COMPLETED,
            priority=NotificationPriority.HIGH,
            title="Envolvimento Concluído - Dados Criados!",
            message=f"A criação de dados para a variável '{variable.variable_name}' foi concluída. "
                    f"Tabela criada: {data.created_table_name}. "
                    "Você pode agora prosseguir com a seleção de match.",
            case_id=variable.case_id,
            variable_id=variable.id,
            action_url=f"/cases/{variable.case_id}?tab=variables",
            action_label="Ver Variável"
        )
        db.add(notification)
        
        await db.commit()
        await db.refresh(involvement)
        
        return involvement
    
    @classmethod
    async def get_involvement(
        cls,
        db: AsyncSession,
        involvement_id: int
    ) -> Optional[Involvement]:
        """Get involvement by ID with related data"""
        result = await db.execute(
            select(Involvement)
            .options(
                selectinload(Involvement.case_variable).selectinload(CaseVariable.case),
                selectinload(Involvement.requester),
                selectinload(Involvement.owner)
            )
            .where(Involvement.id == involvement_id)
        )
        return result.scalars().first()
    
    @classmethod
    async def get_involvement_for_variable(
        cls,
        db: AsyncSession,
        variable_id: int
    ) -> Optional[Involvement]:
        """Get active involvement for a variable"""
        result = await db.execute(
            select(Involvement)
            .options(
                selectinload(Involvement.requester),
                selectinload(Involvement.owner)
            )
            .where(
                Involvement.case_variable_id == variable_id,
                Involvement.status != InvolvementStatus.COMPLETED
            )
        )
        return result.scalars().first()
    
    @classmethod
    async def list_involvements(
        cls,
        db: AsyncSession,
        owner_id: Optional[int] = None,
        requester_id: Optional[int] = None,
        status: Optional[InvolvementStatus] = None,
        include_completed: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[Involvement], int]:
        """List involvements with filters"""
        query = select(Involvement).options(
            selectinload(Involvement.case_variable).selectinload(CaseVariable.case),
            selectinload(Involvement.requester),
            selectinload(Involvement.owner)
        )
        
        filters = []
        if owner_id:
            filters.append(Involvement.owner_id == owner_id)
        if requester_id:
            filters.append(Involvement.requester_id == requester_id)
        if status:
            filters.append(Involvement.status == status)
        if not include_completed:
            filters.append(Involvement.status != InvolvementStatus.COMPLETED)
        
        if filters:
            query = query.where(and_(*filters))
        
        # Count total
        count_query = select(func.count(Involvement.id))
        if filters:
            count_query = count_query.where(and_(*filters))
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Get paginated results
        query = query.order_by(Involvement.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        
        return result.scalars().all(), total
    
    @classmethod
    async def get_pending_for_owner(
        cls,
        db: AsyncSession,
        owner_id: int
    ) -> List[Involvement]:
        """Get all pending involvements for an owner"""
        result = await db.execute(
            select(Involvement)
            .options(
                selectinload(Involvement.case_variable).selectinload(CaseVariable.case),
                selectinload(Involvement.requester)
            )
            .where(
                Involvement.owner_id == owner_id,
                Involvement.status.in_([
                    InvolvementStatus.PENDING,
                    InvolvementStatus.IN_PROGRESS,
                    InvolvementStatus.OVERDUE
                ])
            )
            .order_by(Involvement.expected_completion_date.asc().nullsfirst())
        )
        return result.scalars().all()
    
    @classmethod
    async def get_overdue_involvements(
        cls,
        db: AsyncSession
    ) -> List[Involvement]:
        """Get all overdue involvements that need reminders"""
        today = date.today()
        result = await db.execute(
            select(Involvement)
            .options(
                selectinload(Involvement.case_variable).selectinload(CaseVariable.case),
                selectinload(Involvement.owner),
                selectinload(Involvement.requester)
            )
            .where(
                Involvement.status.in_([InvolvementStatus.IN_PROGRESS, InvolvementStatus.OVERDUE]),
                Involvement.expected_completion_date < today
            )
        )
        return result.scalars().all()
    
    @classmethod
    async def send_overdue_reminders(
        cls,
        db: AsyncSession
    ) -> int:
        """
        Send reminder notifications for overdue involvements.
        Returns count of reminders sent.
        """
        overdue = await cls.get_overdue_involvements(db)
        reminders_sent = 0
        
        for involvement in overdue:
            # Update status to OVERDUE if not already
            if involvement.status != InvolvementStatus.OVERDUE:
                involvement.mark_overdue()
            
            variable = involvement.case_variable
            days_overdue = involvement.days_overdue
            
            # Create reminder notification
            notification = Notification(
                user_id=involvement.owner_id,
                type=NotificationType.INVOLVEMENT_OVERDUE,
                priority=NotificationPriority.URGENT,
                title=f"⚠️ Envolvimento Vencido - {days_overdue} dia(s) de atraso",
                message=f"O envolvimento para a variável '{variable.variable_name}' está vencido há {days_overdue} dia(s). "
                        f"Data prevista: {involvement.expected_completion_date.strftime('%d/%m/%Y')}. "
                        f"Número da requisição: {involvement.external_request_number}. "
                        "Por favor, conclua a criação do dado ou atualize a data prevista.",
                case_id=variable.case_id,
                variable_id=variable.id,
                action_url=f"/cases/{variable.case_id}?tab=variables&involvement={involvement.id}",
                action_label="Concluir Envolvimento"
            )
            db.add(notification)
            
            # Record reminder
            involvement.record_reminder()
            reminders_sent += 1
        
        await db.commit()
        return reminders_sent
    
    @classmethod
    async def get_stats(
        cls,
        db: AsyncSession,
        owner_id: Optional[int] = None
    ) -> InvolvementStats:
        """Get involvement statistics"""
        base_query = select(
            func.count(Involvement.id).label("count"),
            Involvement.status
        ).group_by(Involvement.status)
        
        if owner_id:
            base_query = base_query.where(Involvement.owner_id == owner_id)
        
        result = await db.execute(base_query)
        status_counts = {row.status: row.count for row in result.all()}
        
        # Calculate average completion days for completed involvements
        avg_query = select(
            func.avg(
                func.extract('day', Involvement.actual_completion_date) - 
                func.extract('day', Involvement.expected_completion_date)
            )
        ).where(
            Involvement.status == InvolvementStatus.COMPLETED,
            Involvement.actual_completion_date.isnot(None),
            Involvement.expected_completion_date.isnot(None)
        )
        
        if owner_id:
            avg_query = avg_query.where(Involvement.owner_id == owner_id)
        
        avg_result = await db.execute(avg_query)
        avg_days = avg_result.scalar()
        
        return InvolvementStats(
            total=sum(status_counts.values()),
            pending=status_counts.get(InvolvementStatus.PENDING, 0),
            in_progress=status_counts.get(InvolvementStatus.IN_PROGRESS, 0),
            overdue=status_counts.get(InvolvementStatus.OVERDUE, 0),
            completed=status_counts.get(InvolvementStatus.COMPLETED, 0),
            avg_completion_days=float(avg_days) if avg_days else None
        )
    
    @classmethod
    def to_response(cls, involvement: Involvement) -> InvolvementResponse:
        """Convert Involvement model to response schema"""
        variable = involvement.case_variable
        case = variable.case if variable else None
        
        return InvolvementResponse(
            id=involvement.id,
            case_variable_id=involvement.case_variable_id,
            external_request_number=involvement.external_request_number,
            external_system=involvement.external_system,
            requester_id=involvement.requester_id,
            requester_name=involvement.requester.name if involvement.requester else None,
            owner_id=involvement.owner_id,
            owner_name=involvement.owner.name if involvement.owner else None,
            status=involvement.status,
            expected_completion_date=involvement.expected_completion_date,
            actual_completion_date=involvement.actual_completion_date,
            created_table_name=involvement.created_table_name,
            created_concept=involvement.created_concept,
            is_overdue=involvement.is_overdue,
            days_overdue=involvement.days_overdue,
            days_until_due=involvement.days_until_due,
            notes=involvement.notes,
            reminder_count=involvement.reminder_count,
            last_reminder_at=involvement.last_reminder_at,
            created_at=involvement.created_at,
            updated_at=involvement.updated_at,
            variable_name=variable.variable_name if variable else None,
            case_id=case.id if case else None,
            case_title=case.title if case else None
        )


# Singleton instance
involvement_service = InvolvementService()
