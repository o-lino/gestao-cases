"""
Matching Service

Handles the data matching workflow:
1. Search tables in catalog for a variable
2. Calculate relevance score
3. Select best match (one table per variable)
4. Coordinate owner approval workflow
"""

import hashlib
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_catalog import (
    DataTable, 
    VariableMatch, 
    ApprovalHistory, 
    MatchStatus,
    VariableSearchStatus
)
from app.models.case import CaseVariable, Case
from app.models.collaborator import Collaborator
from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.owner_response import OwnerResponse, OwnerResponseType, RequesterResponse, RequesterResponseType
from app.models.hierarchy import OrganizationalHierarchy
from app.models.decision_history import DecisionHistory, DecisionType, DecisionOutcome
from sqlalchemy.orm import selectinload

class MatchingError(Exception):
    """Custom exception for matching operations"""
    pass


class MatchingService:
    """Service for matching case variables to data tables"""
    
    # Score weights
    WEIGHT_SEMANTIC = 0.40
    WEIGHT_HISTORY = 0.30
    WEIGHT_KEYWORD = 0.20
    WEIGHT_DOMAIN = 0.10
    
    # Minimum score to consider a match
    MIN_MATCH_SCORE = 0.3
    
    @staticmethod
    def generate_concept_hash(variable_name: str, variable_type: str) -> str:
        """Generate a hash for concept-based caching"""
        normalized = f"{variable_name.lower().strip()}:{variable_type.lower()}"
        return hashlib.sha256(normalized.encode()).hexdigest()[:32]
    
    @classmethod
    async def search_matches(
        cls,
        db: AsyncSession,
        variable_id: int,
        max_results: int = 5
    ) -> List[VariableMatch]:
        """
        Search for matching tables for a variable.
        Creates VariableMatch records for found matches.
        """
        # Get the variable
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == variable_id)
        )
        variable = result.scalars().first()
        
        if not variable:
            raise MatchingError(f"Variable {variable_id} not found")
        
        # Update search status
        variable.search_status = VariableSearchStatus.SEARCHING.value
        variable.search_started_at = datetime.utcnow()
        await db.commit()
        
        # Get the case for context
        result = await db.execute(
            select(Case).where(Case.id == variable.case_id)
        )
        case = result.scalars().first()
        
        # Get all active tables
        result = await db.execute(
            select(DataTable).where(DataTable.is_active == True)
        )
        all_tables = result.scalars().all()
        
        if not all_tables:
            variable.search_status = VariableSearchStatus.NO_MATCH.value
            variable.search_completed_at = datetime.utcnow()
            await db.commit()
            return []
        
        # Calculate scores for each table
        scored_tables: List[Tuple[DataTable, float, str]] = []
        concept_hash = cls.generate_concept_hash(variable.variable_name, variable.variable_type)
        
        for table in all_tables:
            score, reason = await cls._calculate_score(
                db, variable, table, case, concept_hash
            )
            if score >= cls.MIN_MATCH_SCORE:
                scored_tables.append((table, score, reason))
        
        # Sort by score descending
        scored_tables.sort(key=lambda x: x[1], reverse=True)
        
        # Take top results
        top_matches = scored_tables[:max_results]
        
        # Create VariableMatch records
        matches = []
        for table, score, reason in top_matches:
            # Check if match already exists
            existing = await db.execute(
                select(VariableMatch).where(
                    VariableMatch.case_variable_id == variable_id,
                    VariableMatch.data_table_id == table.id
                )
            )
            if existing.scalars().first():
                continue
                
            match = VariableMatch(
                case_variable_id=variable_id,
                data_table_id=table.id,
                score=score,
                match_reason=reason,
                status=MatchStatus.SUGGESTED
            )
            db.add(match)
            matches.append(match)
        
        # Update variable status
        if matches:
            variable.search_status = VariableSearchStatus.MATCHED.value
        else:
            variable.search_status = VariableSearchStatus.NO_MATCH.value
        
        variable.search_completed_at = datetime.utcnow()
        await db.commit()
        
        return matches
    
    @classmethod
    async def _calculate_score(
        cls,
        db: AsyncSession,
        variable: CaseVariable,
        table: DataTable,
        case: Case,
        concept_hash: str
    ) -> Tuple[float, str]:
        """Calculate matching score between variable and table"""
        scores = []
        reasons = []
        
        # 1. Semantic similarity (name/description matching)
        semantic_score = cls._calculate_semantic_similarity(
            variable.variable_name,
            variable.concept or "",
            table.name,
            table.description or "",
            table.display_name
        )
        scores.append(semantic_score * cls.WEIGHT_SEMANTIC)
        if semantic_score > 0.5:
            reasons.append(f"Nome similar ({int(semantic_score*100)}%)")
        
        # 2. Historical approval rate
        history_score = await cls._get_approval_rate(db, concept_hash, table.id)
        scores.append(history_score * cls.WEIGHT_HISTORY)
        if history_score > 0.5:
            reasons.append(f"Histórico positivo ({int(history_score*100)}%)")
        
        # 3. Keyword matching
        keyword_score = cls._calculate_keyword_match(
            variable.variable_name,
            table.keywords or []
        )
        scores.append(keyword_score * cls.WEIGHT_KEYWORD)
        if keyword_score > 0.5:
            reasons.append("Keywords compatíveis")
        
        # 4. Domain matching
        domain_score = 0.5  # Neutral default
        if case and hasattr(case, 'macro_case') and case.macro_case:
            if table.domain and table.domain.lower() in case.macro_case.lower():
                domain_score = 1.0
                reasons.append("Mesmo domínio")
        scores.append(domain_score * cls.WEIGHT_DOMAIN)
        
        total_score = sum(scores)
        reason_text = "; ".join(reasons) if reasons else "Match baseado em análise geral"
        
        return total_score, reason_text
    
    @staticmethod
    def _calculate_semantic_similarity(
        var_name: str,
        var_concept: str,
        table_name: str,
        table_desc: str,
        table_display: str
    ) -> float:
        """Calculate semantic similarity using word overlap"""
        # Normalize and tokenize
        var_words = set((var_name + " " + var_concept).lower().split())
        table_words = set((table_name + " " + table_desc + " " + table_display).lower().split())
        
        # Remove common stopwords
        stopwords = {'de', 'da', 'do', 'e', 'para', 'com', 'em', 'a', 'o', 'os', 'as', 'um', 'uma'}
        var_words -= stopwords
        table_words -= stopwords
        
        if not var_words or not table_words:
            return 0.0
        
        # Jaccard similarity
        intersection = len(var_words & table_words)
        union = len(var_words | table_words)
        
        return intersection / union if union > 0 else 0.0
    
    @staticmethod
    async def _get_approval_rate(
        db: AsyncSession,
        concept_hash: str,
        table_id: int
    ) -> float:
        """Get historical approval rate for concept+table combination"""
        result = await db.execute(
            select(ApprovalHistory).where(
                ApprovalHistory.concept_hash == concept_hash,
                ApprovalHistory.data_table_id == table_id
            )
        )
        history = result.scalars().first()
        
        if not history:
            return 0.5  # Neutral if no history
        
        return history.approval_rate
    
    @staticmethod
    def _calculate_keyword_match(var_name: str, table_keywords: List[str]) -> float:
        """Calculate keyword match score"""
        if not table_keywords:
            return 0.0
        
        var_name_lower = var_name.lower()
        matches = sum(1 for kw in table_keywords if kw.lower() in var_name_lower or var_name_lower in kw.lower())
        
        return min(1.0, matches / max(1, len(table_keywords)))
    
    @classmethod
    async def select_best_match(
        cls,
        db: AsyncSession,
        variable_id: int,
        match_id: int,
        selected_by_id: int
    ) -> VariableMatch:
        """
        Select a match as the final choice for a variable.
        Notifies the table owner for validation.
        """
        # Get the match
        result = await db.execute(
            select(VariableMatch)
            .where(VariableMatch.id == match_id)
            .where(VariableMatch.case_variable_id == variable_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        # Mark as selected
        match.is_selected = True
        match.selected_at = datetime.utcnow()
        match.selected_by_id = selected_by_id
        match.status = MatchStatus.PENDING_OWNER
        
        # Deselect other matches for same variable
        await db.execute(
            select(VariableMatch)
            .where(VariableMatch.case_variable_id == variable_id)
            .where(VariableMatch.id != match_id)
        )
        
        # Update variable status
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == variable_id)
        )
        variable = result.scalars().first()
        variable.search_status = VariableSearchStatus.OWNER_REVIEW.value
        variable.selected_match_id = match_id
        
        # Get table for owner notification
        result = await db.execute(
            select(DataTable).where(DataTable.id == match.data_table_id)
        )
        table = result.scalars().first()
        
        # Create notification for owner
        if table and table.owner_id:
            notification = Notification(
                collaborator_id=table.owner_id,
                type=NotificationType.OWNER_VALIDATION_REQUEST,
                priority=NotificationPriority.HIGH,
                title="Solicitação de Validação de Dados",
                message=f"A variável '{variable.variable_name}' foi associada à tabela '{table.display_name}'. Valide se esta associação é apropriada.",
                data={
                    "match_id": match_id,
                    "variable_id": variable_id,
                    "table_id": table.id
                }
            )
            db.add(notification)
        
        await db.commit()
        return match
    
    @classmethod
    async def owner_approve(
        cls,
        db: AsyncSession,
        match_id: int,
        owner_id: int
    ) -> VariableMatch:
        """Owner approves the matched table"""
        result = await db.execute(
            select(VariableMatch).where(VariableMatch.id == match_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        if match.status != MatchStatus.PENDING_OWNER:
            raise MatchingError("Match is not pending owner approval")
        
        # Approve
        match.approve(owner_id)
        
        # Update variable status
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        variable.search_status = VariableSearchStatus.APPROVED.value
        
        # Update approval history
        await cls._update_approval_history(
            db, variable, match.data_table_id, approved=True
        )
        
        # Notify requester
        result = await db.execute(
            select(Case).where(Case.id == variable.case_id)
        )
        case = result.scalars().first()
        
        if case and case.created_by:
            result = await db.execute(
                select(DataTable).where(DataTable.id == match.data_table_id)
            )
            table = result.scalars().first()
            
            notification = Notification(
                collaborator_id=case.created_by,
                type=NotificationType.VARIABLE_APPROVED,
                priority=NotificationPriority.NORMAL,
                title="Variável Aprovada",
                message=f"A variável '{variable.variable_name}' foi aprovada e associada à tabela '{table.display_name}'.",
                data={
                    "match_id": match_id,
                    "variable_id": variable.id,
                    "case_id": case.id
                }
            )
            db.add(notification)
        
        await db.commit()
        return match
    
    @classmethod
    async def owner_reject(
        cls,
        db: AsyncSession,
        match_id: int,
        owner_id: int,
        reason: str = None,
        create_involvement: bool = False
    ) -> VariableMatch:
        """
        Owner rejects the matched table.
        
        If create_involvement=True, it means the owner confirms they are the owner
        but the data doesn't exist yet. The variable status will be set to
        PENDING_INVOLVEMENT so the requester can open an involvement request.
        """
        result = await db.execute(
            select(VariableMatch).where(VariableMatch.id == match_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        # Reject
        match.reject(owner_id, reason)
        match.is_selected = False
        
        # Update approval history
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        
        await cls._update_approval_history(
            db, variable, match.data_table_id, approved=False
        )
        
        # If owner says data doesn't exist, set status for involvement creation
        if create_involvement:
            variable.search_status = VariableSearchStatus.PENDING_INVOLVEMENT.value
            variable.selected_match_id = None
            
            # Notify requester to open involvement
            result = await db.execute(
                select(Case).where(Case.id == variable.case_id)
            )
            case = result.scalars().first()
            
            if case and case.created_by:
                notification = Notification(
                    user_id=case.created_by,
                    type=NotificationType.OWNER_REJECTED,
                    priority=NotificationPriority.HIGH,
                    title="Dados não existem - Envolvimento Necessário",
                    message=f"O responsável informou que a variável '{variable.variable_name}' "
                            f"precisa de um envolvimento para criação dos dados. "
                            f"Por favor, abra uma requisição no sistema externo e registre o número.",
                    case_id=case.id,
                    variable_id=variable.id,
                    action_url=f"/cases/{case.id}?tab=variables&action=create_involvement&variable={variable.id}",
                    action_label="Abrir Envolvimento"
                )
                db.add(notification)
        else:
            # Check if there are other matches to try
            result = await db.execute(
                select(VariableMatch).where(
                    VariableMatch.case_variable_id == match.case_variable_id,
                    VariableMatch.status == MatchStatus.SUGGESTED
                ).order_by(VariableMatch.score.desc())
            )
            next_match = result.scalars().first()
            
            if next_match:
                # Update variable to show it needs new selection
                variable.search_status = VariableSearchStatus.MATCHED.value
                variable.selected_match_id = None
            else:
                # No more options
                variable.search_status = VariableSearchStatus.NO_MATCH.value
                variable.selected_match_id = None
        
        await db.commit()
        return match
    
    @classmethod
    async def _update_approval_history(
        cls,
        db: AsyncSession,
        variable: CaseVariable,
        table_id: int,
        approved: bool
    ):
        """Update approval history for future matching"""
        concept_hash = cls.generate_concept_hash(
            variable.variable_name, 
            variable.variable_type
        )
        
        result = await db.execute(
            select(ApprovalHistory).where(
                ApprovalHistory.concept_hash == concept_hash,
                ApprovalHistory.data_table_id == table_id
            )
        )
        history = result.scalars().first()
        
        if history:
            if approved:
                history.approved_count += 1
            else:
                history.rejected_count += 1
            history.last_used_at = datetime.utcnow()
        else:
            history = ApprovalHistory(
                concept_hash=concept_hash,
                concept_name=variable.variable_name,
                concept_type=variable.variable_type,
                data_table_id=table_id,
                approved_count=1 if approved else 0,
                rejected_count=0 if approved else 1,
                last_used_at=datetime.utcnow()
            )
            db.add(history)
    
    # ============== Structured Owner Response Methods ==============
    
    @classmethod
    async def owner_respond(
        cls,
        db: AsyncSession,
        match_id: int,
        responder_id: int,
        response_type: OwnerResponseType,
        response_data: dict
    ) -> Tuple[VariableMatch, OwnerResponse]:
        """
        Handle structured owner response to a table suggestion.
        
        Args:
            match_id: ID of the VariableMatch being responded to
            responder_id: ID of the collaborator responding
            response_type: Type of response (CORRECT_TABLE, DATA_NOT_EXIST, etc.)
            response_data: Type-specific data (suggested_table_id, delegate_to_funcional, etc.)
        
        Returns:
            Tuple of (updated VariableMatch, created OwnerResponse)
        
        Raises:
            MatchingError: If validation fails or match not found
        """
        # Get the match
        result = await db.execute(
            select(VariableMatch)
            .options(selectinload(VariableMatch.data_table))
            .where(VariableMatch.id == match_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        if match.status != MatchStatus.PENDING_OWNER:
            raise MatchingError(f"Match is not pending owner approval (current: {match.status})")
        
        # Get the variable
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        
        # Validate response based on type
        validation_result, validation_error = await cls._validate_owner_response(
            db, response_type, response_data
        )
        
        # Create the owner response record
        owner_response = OwnerResponse(
            variable_match_id=match_id,
            response_type=response_type,
            responder_id=responder_id,
            suggested_table_id=response_data.get('suggested_table_id'),
            delegate_to_funcional=response_data.get('delegate_to_funcional'),
            delegate_to_id=response_data.get('delegate_to_id'),
            delegate_area_id=response_data.get('delegate_area_id'),
            delegate_area_name=response_data.get('delegate_area_name'),
            usage_criteria=response_data.get('usage_criteria'),
            attention_points=response_data.get('attention_points'),
            notes=response_data.get('notes'),
            is_validated=validation_error is None,
            validation_result=validation_result,
            validation_error=validation_error,
            validated_at=datetime.utcnow() if validation_error is None else None
        )
        db.add(owner_response)
        
        if validation_error:
            raise MatchingError(f"Validation failed: {validation_error}")
        
        # Handle each response type
        if response_type == OwnerResponseType.CONFIRM_MATCH:
            await cls._handle_confirm_match(db, match, variable, owner_response)
        elif response_type == OwnerResponseType.CORRECT_TABLE:
            await cls._handle_correct_table(db, match, variable, owner_response)
        elif response_type == OwnerResponseType.DATA_NOT_EXIST:
            await cls._handle_data_not_exist(db, match, variable, owner_response)
        elif response_type == OwnerResponseType.DELEGATE_PERSON:
            await cls._handle_delegate_person(db, match, variable, owner_response)
        elif response_type == OwnerResponseType.DELEGATE_AREA:
            await cls._handle_delegate_area(db, match, variable, owner_response)
        
        await db.commit()
        return match, owner_response
    
    @classmethod
    async def _validate_owner_response(
        cls,
        db: AsyncSession,
        response_type: OwnerResponseType,
        response_data: dict
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Validate owner response data based on type.
        
        Returns:
            Tuple of (validation_result, validation_error)
            If error is None, validation passed.
        """
        if response_type == OwnerResponseType.CORRECT_TABLE:
            table_id = response_data.get('suggested_table_id')
            if not table_id:
                return None, "Tabela sugerida é obrigatória"
            
            # Verify table exists
            result = await db.execute(
                select(DataTable).where(DataTable.id == table_id, DataTable.is_active == True)
            )
            table = result.scalars().first()
            if not table:
                return None, f"Tabela com ID {table_id} não encontrada ou inativa"
            
            return f"Tabela válida: {table.display_name}", None
        
        elif response_type == OwnerResponseType.DATA_NOT_EXIST:
            # No specific validation needed, data doesn't exist
            return "Confirmado: dados não existem", None
        
        elif response_type == OwnerResponseType.DELEGATE_PERSON:
            funcional = response_data.get('delegate_to_funcional')
            delegate_id = response_data.get('delegate_to_id')
            
            if not funcional and not delegate_id:
                return None, "Funcional ou ID do colaborador é obrigatório"
            
            # Try to find collaborator
            if delegate_id:
                result = await db.execute(
                    select(Collaborator).where(Collaborator.id == delegate_id, Collaborator.active == True)
                )
            elif funcional:
                result = await db.execute(
                    select(Collaborator).where(
                        or_(
                            Collaborator.email.ilike(f"%{funcional}%"),
                            Collaborator.name.ilike(f"%{funcional}%")
                        ),
                        Collaborator.active == True
                    )
                )
            
            collaborator = result.scalars().first()
            if not collaborator:
                return None, f"Colaborador '{funcional or delegate_id}' não encontrado"
            
            return f"Delegado para: {collaborator.name}", None
        
        elif response_type == OwnerResponseType.DELEGATE_AREA:
            area_id = response_data.get('delegate_area_id')
            area_name = response_data.get('delegate_area_name')
            
            if not area_id and not area_name:
                return None, "ID ou nome da área é obrigatório"
            
            # If area_id provided, validate it exists in hierarchy departments
            if area_id:
                result = await db.execute(
                    select(OrganizationalHierarchy.department)
                    .where(OrganizationalHierarchy.id == area_id)
                    .distinct()
                )
                dept = result.scalars().first()
                if not dept:
                    return None, f"Área com ID {area_id} não encontrada"
                return f"Área válida: {dept}", None
            
            # If only name, search for matching departments
            if area_name:
                result = await db.execute(
                    select(OrganizationalHierarchy.department)
                    .where(OrganizationalHierarchy.department.ilike(f"%{area_name}%"))
                    .distinct()
                )
                depts = result.scalars().all()
                if not depts:
                    return None, f"Área '{area_name}' não encontrada"
                return f"Área encontrada: {depts[0]}", None
            
            return None, "Área não especificada"
        
        elif response_type == OwnerResponseType.CONFIRM_MATCH:
            usage_criteria = response_data.get('usage_criteria')
            if not usage_criteria or not usage_criteria.strip():
                return None, "Critérios de uso são obrigatórios"
            
            return "Match confirmado com critérios", None
        
        return None, "Tipo de resposta desconhecido"
    
    @classmethod
    async def _handle_confirm_match(
        cls,
        db: AsyncSession,
        match: VariableMatch,
        variable: CaseVariable,
        owner_response: OwnerResponse
    ):
        """Handle CONFIRM_MATCH: Owner approves, now awaits requester confirmation"""
        # Set to pending requester instead of approved - requester must confirm
        match.status = MatchStatus.PENDING_REQUESTER
        match.owner_validated_at = datetime.utcnow()
        match.owner_id = owner_response.responder_id
        
        # Wait for requester to confirm before final approval
        variable.search_status = VariableSearchStatus.REQUESTER_REVIEW.value
        
        # Notify requester to confirm
        result = await db.execute(select(Case).where(Case.id == variable.case_id))
        case = result.scalars().first()
        
        if case and case.created_by:
            table = match.data_table
            notification = Notification(
                collaborator_id=case.created_by,
                type=NotificationType.VARIABLE_APPROVED,
                priority=NotificationPriority.HIGH,
                title="Confirme a Indicação do Owner",
                message=f"O dono dos dados confirmou a tabela '{table.display_name if table else 'N/A'}' para a variável '{variable.variable_name}'. Verifique se atende sua necessidade.",
                data={
                    "match_id": match.id,
                    "variable_id": variable.id,
                    "case_id": case.id,
                    "usage_criteria": owner_response.usage_criteria,
                    "attention_points": owner_response.attention_points,
                    "action": "confirm_match"
                }
            )
            db.add(notification)
    
    @classmethod
    async def _handle_correct_table(
        cls,
        db: AsyncSession,
        match: VariableMatch,
        variable: CaseVariable,
        owner_response: OwnerResponse
    ):
        """Handle CORRECT_TABLE: Redirect to suggested table"""
        # Mark current match as rejected
        match.status = MatchStatus.REDIRECTED
        match.owner_validated_at = datetime.utcnow()
        match.owner_id = owner_response.responder_id
        match.rejection_reason = f"Tabela correta: ID {owner_response.suggested_table_id}"
        match.is_selected = False
        
        # Create or find match for the correct table
        result = await db.execute(
            select(VariableMatch).where(
                VariableMatch.case_variable_id == variable.id,
                VariableMatch.data_table_id == owner_response.suggested_table_id
            )
        )
        correct_match = result.scalars().first()
        
        if not correct_match:
            # Create new match with the correct table
            correct_match = VariableMatch(
                case_variable_id=variable.id,
                data_table_id=owner_response.suggested_table_id,
                score=1.0,  # High score since owner suggested it
                match_reason="Sugerido pelo dono dos dados originais",
                status=MatchStatus.PENDING_OWNER,  # Needs new owner approval
                is_selected=True,
                selected_at=datetime.utcnow(),
                selected_by_id=owner_response.responder_id
            )
            db.add(correct_match)
        else:
            # Update existing match
            correct_match.is_selected = True
            correct_match.selected_at = datetime.utcnow()
            correct_match.status = MatchStatus.PENDING_OWNER
        
        # Update variable
        variable.search_status = VariableSearchStatus.OWNER_REVIEW.value
        
        # Notify the new table owner
        result = await db.execute(
            select(DataTable).options(selectinload(DataTable.owner))
            .where(DataTable.id == owner_response.suggested_table_id)
        )
        new_table = result.scalars().first()
        
        if new_table and new_table.owner_id:
            notification = Notification(
                collaborator_id=new_table.owner_id,
                type=NotificationType.OWNER_VALIDATION_REQUEST,
                priority=NotificationPriority.HIGH,
                title="Solicitação de Validação - Redirecionado",
                message=f"A variável '{variable.variable_name}' foi redirecionada para sua tabela '{new_table.display_name}'. Valide se esta associação é apropriada.",
                data={
                    "match_id": correct_match.id if hasattr(correct_match, 'id') else None,
                    "variable_id": variable.id,
                    "table_id": new_table.id,
                    "redirected_from": match.data_table_id
                }
            )
            db.add(notification)
    
    @classmethod
    async def _handle_data_not_exist(
        cls,
        db: AsyncSession,
        match: VariableMatch,
        variable: CaseVariable,
        owner_response: OwnerResponse
    ):
        """Handle DATA_NOT_EXIST: Trigger involvement creation flow"""
        match.status = MatchStatus.REJECTED
        match.owner_validated_at = datetime.utcnow()
        match.owner_id = owner_response.responder_id
        match.rejection_reason = "Dados não existem - necessário envolvimento"
        match.is_selected = False
        
        variable.search_status = VariableSearchStatus.PENDING_INVOLVEMENT.value
        variable.selected_match_id = None
        
        # Notify requester to open involvement
        result = await db.execute(select(Case).where(Case.id == variable.case_id))
        case = result.scalars().first()
        
        if case and case.created_by:
            notification = Notification(
                collaborator_id=case.created_by,
                type=NotificationType.OWNER_REJECTED,
                priority=NotificationPriority.HIGH,
                title="Dados não existem - Envolvimento Necessário",
                message=f"O responsável informou que a variável '{variable.variable_name}' "
                        f"precisa de um envolvimento para criação dos dados. "
                        f"Por favor, abra uma requisição no sistema externo e registre o número.",
                data={
                    "case_id": case.id,
                    "variable_id": variable.id,
                    "action": "create_involvement",
                    "owner_notes": owner_response.notes
                }
            )
            db.add(notification)
    
    @classmethod
    async def _handle_delegate_person(
        cls,
        db: AsyncSession,
        match: VariableMatch,
        variable: CaseVariable,
        owner_response: OwnerResponse
    ):
        """Handle DELEGATE_PERSON: Redirect to another person"""
        match.status = MatchStatus.REDIRECTED
        match.owner_validated_at = datetime.utcnow()
        match.owner_id = owner_response.responder_id
        match.rejection_reason = f"Delegado para: {owner_response.delegate_to_funcional or owner_response.delegate_to_id}"
        
        # Find the delegated person
        delegate_id = owner_response.delegate_to_id
        if not delegate_id and owner_response.delegate_to_funcional:
            result = await db.execute(
                select(Collaborator).where(
                    or_(
                        Collaborator.email.ilike(f"%{owner_response.delegate_to_funcional}%"),
                        Collaborator.name.ilike(f"%{owner_response.delegate_to_funcional}%")
                    ),
                    Collaborator.active == True
                )
            )
            collaborator = result.scalars().first()
            if collaborator:
                delegate_id = collaborator.id
        
        if delegate_id:
            # Notify the delegated person
            notification = Notification(
                collaborator_id=delegate_id,
                type=NotificationType.OWNER_VALIDATION_REQUEST,
                priority=NotificationPriority.HIGH,
                title="Solicitação de Validação - Delegada",
                message=f"A responsabilidade pela validação da variável '{variable.variable_name}' foi delegada para você.",
                data={
                    "match_id": match.id,
                    "variable_id": variable.id,
                    "table_id": match.data_table_id,
                    "delegated_by": owner_response.responder_id
                }
            )
            db.add(notification)
            
            # Keep match in pending state for new owner
            match.status = MatchStatus.PENDING_OWNER
    
    @classmethod
    async def _handle_delegate_area(
        cls,
        db: AsyncSession,
        match: VariableMatch,
        variable: CaseVariable,
        owner_response: OwnerResponse
    ):
        """Handle DELEGATE_AREA: Redirect to another organizational area"""
        match.status = MatchStatus.REDIRECTED
        match.owner_validated_at = datetime.utcnow()
        match.owner_id = owner_response.responder_id
        match.rejection_reason = f"Redirecionado para área: {owner_response.delegate_area_name or owner_response.delegate_area_id}"
        
        variable.search_status = VariableSearchStatus.MATCHED.value
        variable.selected_match_id = None
        
        # Notify case requester about the redirect
        result = await db.execute(select(Case).where(Case.id == variable.case_id))
        case = result.scalars().first()
        
        if case and case.created_by:
            notification = Notification(
                collaborator_id=case.created_by,
                type=NotificationType.OWNER_REJECTED,
                priority=NotificationPriority.NORMAL,
                title="Responsabilidade Redirecionada",
                message=f"A variável '{variable.variable_name}' foi redirecionada para a área '{owner_response.delegate_area_name}'. "
                        f"Uma nova busca será necessária para encontrar o responsável correto.",
                data={
                    "case_id": case.id,
                    "variable_id": variable.id,
                    "delegated_area": owner_response.delegate_area_name,
                    "delegated_area_id": owner_response.delegate_area_id
                }
            )
            db.add(notification)
    
    # ============== Search/Autocomplete Methods ==============
    
    @classmethod
    async def search_collaborators(
        cls,
        db: AsyncSession,
        query: str,
        limit: int = 10
    ) -> List[Collaborator]:
        """Search collaborators by name or email for autocomplete"""
        if not query or len(query) < 2:
            return []
        
        result = await db.execute(
            select(Collaborator)
            .where(
                Collaborator.active == True,
                or_(
                    Collaborator.name.ilike(f"%{query}%"),
                    Collaborator.email.ilike(f"%{query}%")
                )
            )
            .order_by(Collaborator.name)
            .limit(limit)
        )
        return result.scalars().all()
    
    @classmethod
    async def search_areas(
        cls,
        db: AsyncSession,
        query: str,
        limit: int = 10
    ) -> List[dict]:
        """Search organizational areas by department name"""
        if not query or len(query) < 2:
            return []
        
        result = await db.execute(
            select(
                OrganizationalHierarchy.id,
                OrganizationalHierarchy.department,
                OrganizationalHierarchy.cost_center
            )
            .where(
                OrganizationalHierarchy.is_active == True,
                OrganizationalHierarchy.department.ilike(f"%{query}%")
            )
            .distinct()
            .limit(limit)
        )
        
        rows = result.all()
        return [
            {"id": row.id, "department": row.department, "cost_center": row.cost_center}
            for row in rows
        ]
    
    # ============== Requester Response Methods ==============
    
    @classmethod
    async def requester_respond(
        cls,
        db: AsyncSession,
        match_id: int,
        responder_id: int,
        response_type: RequesterResponseType,
        response_data: dict
    ) -> Tuple[VariableMatch, RequesterResponse]:
        """
        Handle requester response after owner has validated the match.
        
        Args:
            match_id: ID of the VariableMatch being responded to
            responder_id: ID of the requester responding
            response_type: APPROVE or one of the REJECT_* types
            response_data: rejection_reason, expected_data_description, etc.
        
        Returns:
            Tuple of (updated VariableMatch, created RequesterResponse)
        
        Raises:
            MatchingError: If validation fails or match not found
        """
        # Get the match
        result = await db.execute(
            select(VariableMatch)
            .options(selectinload(VariableMatch.data_table))
            .where(VariableMatch.id == match_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        if match.status != MatchStatus.PENDING_REQUESTER:
            raise MatchingError(f"Match is not pending requester confirmation (current: {match.status})")
        
        # Get the variable
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        
        # Get the latest owner response
        result = await db.execute(
            select(OwnerResponse)
            .where(OwnerResponse.variable_match_id == match_id)
            .order_by(OwnerResponse.created_at.desc())
        )
        owner_response = result.scalars().first()
        
        # Count existing loops
        result = await db.execute(
            select(func.count(RequesterResponse.id))
            .where(RequesterResponse.variable_match_id == match_id)
        )
        loop_count = result.scalar() or 0
        
        # Validate rejection reason if rejecting
        validation_error = None
        if response_type != RequesterResponseType.APPROVE:
            rejection_reason = response_data.get('rejection_reason', '').strip()
            if not rejection_reason or len(rejection_reason) < 10:
                validation_error = "Motivo da rejeição é obrigatório (mínimo 10 caracteres)"
        
        # Create the requester response record
        requester_response = RequesterResponse(
            variable_match_id=match_id,
            owner_response_id=owner_response.id if owner_response else None,
            response_type=response_type,
            responder_id=responder_id,
            rejection_reason=response_data.get('rejection_reason'),
            expected_data_description=response_data.get('expected_data_description'),
            improvement_suggestions=response_data.get('improvement_suggestions'),
            is_validated=validation_error is None,
            validation_error=validation_error,
            loop_count=loop_count + 1
        )
        db.add(requester_response)
        
        if validation_error:
            raise MatchingError(f"Validação falhou: {validation_error}")
        
        # Handle approval or rejection
        if response_type == RequesterResponseType.APPROVE:
            await cls._handle_requester_approve(db, match, variable, requester_response)
        else:
            await cls._handle_requester_reject(db, match, variable, requester_response, owner_response)
        
        await db.commit()
        return match, requester_response
    
    @classmethod
    async def _handle_requester_approve(
        cls,
        db: AsyncSession,
        match: VariableMatch,
        variable: CaseVariable,
        requester_response: RequesterResponse
    ):
        """Handle requester approval: finalize the match"""
        match.status = MatchStatus.APPROVED
        variable.search_status = VariableSearchStatus.APPROVED.value
        
        # Update approval history
        await cls._update_approval_history(db, variable, match.data_table_id, approved=True)
        
        # Notify owner that requester confirmed
        if match.owner_id:
            notification = Notification(
                collaborator_id=match.owner_id,
                type=NotificationType.VARIABLE_APPROVED,
                priority=NotificationPriority.NORMAL,
                title="Solicitante Confirmou Match",
                message=f"O solicitante confirmou que a tabela atende sua necessidade para a variável '{variable.variable_name}'.",
                data={
                    "match_id": match.id,
                    "variable_id": variable.id,
                    "status": "FINAL_APPROVED"
                }
            )
            db.add(notification)
    
    @classmethod
    async def _handle_requester_reject(
        cls,
        db: AsyncSession,
        match: VariableMatch,
        variable: CaseVariable,
        requester_response: RequesterResponse,
        owner_response: OwnerResponse
    ):
        """Handle requester rejection: loop back to owner with feedback"""
        match.status = MatchStatus.REJECTED_BY_REQUESTER
        variable.search_status = VariableSearchStatus.OWNER_REVIEW.value
        
        # Get the case for requester info
        result = await db.execute(select(Case).where(Case.id == variable.case_id))
        case = result.scalars().first()
        
        requester_name = "O solicitante"
        if case and case.created_by:
            result = await db.execute(select(Collaborator).where(Collaborator.id == case.created_by))
            requester = result.scalars().first()
            if requester:
                requester_name = requester.name
        
        # Notify owner about rejection and need for new response
        if owner_response and owner_response.responder_id:
            rejection_type_labels = {
                RequesterResponseType.REJECT_WRONG_DATA: "Dados não correspondem ao solicitado",
                RequesterResponseType.REJECT_INCOMPLETE: "Dados incompletos/faltando campos",
                RequesterResponseType.REJECT_WRONG_GRANULARITY: "Granularidade incorreta",
                RequesterResponseType.REJECT_WRONG_PERIOD: "Período/frequência incorreta",
                RequesterResponseType.REJECT_OTHER: "Outro motivo"
            }
            
            notification = Notification(
                collaborator_id=owner_response.responder_id,
                type=NotificationType.OWNER_VALIDATION_REQUEST,
                priority=NotificationPriority.HIGH,
                title="Solicitante Rejeitou Match - Nova Ação Necessária",
                message=f"{requester_name} rejeitou a indicação para '{variable.variable_name}'. " 
                        f"Motivo: {rejection_type_labels.get(requester_response.response_type, 'Não especificado')}. "
                        f"Avalie o feedback e escolha uma nova ação.",
                data={
                    "match_id": match.id,
                    "variable_id": variable.id,
                    "rejection_reason": requester_response.rejection_reason,
                    "expected_data": requester_response.expected_data_description,
                    "suggestions": requester_response.improvement_suggestions,
                    "loop_count": requester_response.loop_count,
                    "action": "respond_to_rejection"
                }
            )
            db.add(notification)
        
        # Reset match status to allow new owner response
        match.status = MatchStatus.PENDING_OWNER
    
    @classmethod
    async def get_matches_for_variable(
        cls,
        db: AsyncSession,
        variable_id: int
    ) -> List[VariableMatch]:
        """Get all matches for a variable with table details"""
        result = await db.execute(
            select(VariableMatch)
            .options(selectinload(VariableMatch.data_table))
            .where(VariableMatch.case_variable_id == variable_id)
            .order_by(VariableMatch.score.desc())
        )
        return result.scalars().all()

    @classmethod
    async def get_case_progress(
        cls,
        db: AsyncSession,
        case_id: int
    ) -> dict:
        """Get matching progress summary for a case"""
        # Optimized query with counts
        result = await db.execute(
            select(
                func.count(CaseVariable.id),
                CaseVariable.search_status
            )
            .where(CaseVariable.case_id == case_id)
            .group_by(CaseVariable.search_status)
        )
        stats = result.all()
        
        status_counts = {
            "PENDING": 0,
            "SEARCHING": 0,
            "MATCHED": 0,
            "OWNER_REVIEW": 0,
            "APPROVED": 0,
            "NO_MATCH": 0
        }
        
        total = 0
        for count, status in stats:
            status_key = status if status else "PENDING"
            if status_key in status_counts:
                status_counts[status_key] = count
            total += count
            
        progress = (status_counts["APPROVED"] / total) * 100 if total > 0 else 0
        
        return {
            "total": total,
            "pending": status_counts["PENDING"],
            "searching": status_counts["SEARCHING"],
            "matched": status_counts["MATCHED"],
            "owner_review": status_counts["OWNER_REVIEW"],
            "approved": status_counts["APPROVED"],
            "no_match": status_counts["NO_MATCH"],
            "progress_percent": round(progress, 1)
        }

    @classmethod
    async def get_case_matching_progress_details(
        cls,
        db: AsyncSession,
        case_id: int
    ) -> dict:
        """Get detailed matching progress including variable details"""
        # Get progress summary first
        progress = await cls.get_case_progress(db, case_id)
        
        # Get variables with matches and selected match loaded eagerly
        # optimized to avoid N+1
        result = await db.execute(
            select(CaseVariable)
            .where(CaseVariable.case_id == case_id)
            .order_by(CaseVariable.id)
        )
        variables = result.scalars().all()
        
        variable_details = []
        for var in variables:
            # We need to fetch matches and table info manually or via relationship
            # To fetch properly with async, specific queries are often safer than deep relations unless configured
            
            # Fetch matches with table
            matches_result = await db.execute(
                select(VariableMatch)
                .options(selectinload(VariableMatch.data_table).selectinload(DataTable.owner))
                .where(VariableMatch.case_variable_id == var.id)
                .order_by(VariableMatch.score.desc())
            )
            matches = matches_result.scalars().all()
            
            top_score = matches[0].score if matches else None
            
            # Helper to extract table info
            selected_table_info = {}
            match_status = None
            is_pending_owner = False
            is_approved = False
            
            selected_match = None
            if var.selected_match_id:
                selected_match = next((m for m in matches if m.id == var.selected_match_id), None)
            elif matches:
                selected_match = matches[0] # Fallback to top match
            
            if selected_match:
                table = selected_match.data_table
                match_status = selected_match.status.value if hasattr(selected_match.status, 'value') else selected_match.status
                is_pending_owner = match_status == 'PENDING_OWNER'
                is_approved = match_status == 'APPROVED'
                
                if table:
                    selected_table_info = {
                        "selected_table": table.display_name,
                        "selected_table_id": table.id,
                        "selected_table_domain": table.domain,
                        "selected_table_description": table.description,
                        "selected_table_full_path": getattr(table, 'full_path', None),
                        "selected_table_owner_name": table.owner.name if table.owner else None
                    }

            variable_details.append({
                "id": var.id,
                "variable_name": var.variable_name,
                "variable_type": var.variable_type,
                "concept": var.concept,
                "desired_lag": var.desired_lag,
                "search_status": var.search_status or "PENDING",
                "match_count": len(matches),
                "top_score": top_score,
                "match_status": match_status,
                "is_pending_owner": is_pending_owner,
                "is_approved": is_approved,
                **selected_table_info
            })
            
        progress["variables"] = variable_details
        return progress

    # Catalog Management
    @classmethod
    async def list_tables(
        cls,
        db: AsyncSession,
        domain: Optional[str] = None
    ) -> List[DataTable]:
        """List active tables"""
        query = select(DataTable).options(selectinload(DataTable.owner)).where(DataTable.is_active == True)
        if domain:
            query = query.where(DataTable.domain == domain)
        
        result = await db.execute(query.order_by(DataTable.display_name))
        return result.scalars().all()

    @classmethod
    async def create_table(
        cls,
        db: AsyncSession,
        data: dict
    ) -> DataTable:
        """Create a new table"""
        table = DataTable(**data)
        table.is_active = True
        db.add(table)
        await db.commit()
        await db.refresh(table)
        return table

    @classmethod
    async def get_table(
        cls,
        db: AsyncSession,
        table_id: int
    ) -> Optional[DataTable]:
        """Get table by ID"""
        result = await db.execute(
            select(DataTable)
            .options(selectinload(DataTable.owner))
            .where(DataTable.id == table_id)
        )
        return result.scalars().first()

    # ============== Variable In Use ==============
    
    @classmethod
    async def mark_variable_in_use(
        cls,
        db: AsyncSession,
        variable_id: int,
        user_id: int
    ) -> CaseVariable:
        """
        Mark a variable as 'in use' after requester confirms data is being used.
        Only allowed if variable is in APPROVED status.
        
        Args:
            variable_id: ID of the variable to mark
            user_id: ID of the user making this change (must be requester)
        
        Returns:
            Updated CaseVariable
        
        Raises:
            MatchingError: If variable not found or not in APPROVED status
        """
        # Get the variable
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == variable_id)
        )
        variable = result.scalars().first()
        
        if not variable:
            raise MatchingError("Variável não encontrada")
        
        if variable.search_status != VariableSearchStatus.APPROVED.value:
            raise MatchingError(f"Variável deve estar aprovada para marcar como 'Em Uso'. Status atual: {variable.search_status}")
        
        # Verify user is the case owner (requester)
        result = await db.execute(
            select(Case).where(Case.id == variable.case_id)
        )
        case = result.scalars().first()
        
        if case and case.created_by != user_id:
            raise MatchingError("Apenas o solicitante pode marcar a variável como 'Em Uso'")
        
        # Update status
        variable.search_status = VariableSearchStatus.IN_USE.value
        variable.in_use_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(variable)
        
        return variable

    # ============== Pending Owner Actions ==============
    
    @classmethod
    async def get_pending_for_owner(
        cls,
        db: AsyncSession,
        owner_id: int
    ) -> List[dict]:
        """
        Get all variables with matches pending owner action.
        Returns variables where the logged user is the data table owner
        and the match status is PENDING_OWNER.
        """
        # Query matches where:
        # 1. Match status = PENDING_OWNER
        # 2. Data table owner = current user
        # 3. Variable is not cancelled
        query = (
            select(VariableMatch)
            .join(DataTable, VariableMatch.data_table_id == DataTable.id)
            .join(CaseVariable, VariableMatch.case_variable_id == CaseVariable.id)
            .options(
                selectinload(VariableMatch.data_table),
                selectinload(VariableMatch.case_variable).selectinload(CaseVariable.case)
            )
            .where(
                and_(
                    VariableMatch.status == MatchStatus.PENDING_OWNER,
                    DataTable.owner_id == owner_id,
                    CaseVariable.is_cancelled == False
                )
            )
            .order_by(VariableMatch.created_at.desc())
        )
        
        result = await db.execute(query)
        matches = result.scalars().all()
        
        # Transform to response format
        pending_items = []
        for match in matches:
            variable = match.case_variable
            case = variable.case if variable else None
            table = match.data_table
            
            pending_items.append({
                "match_id": match.id,
                "variable_id": variable.id if variable else None,
                "variable_name": variable.variable_name if variable else None,
                "product": variable.product if variable else None,
                "concept": variable.concept if variable else None,
                "priority": variable.priority if variable else None,
                "case_id": case.id if case else None,
                "case_title": case.title if case else None,
                "case_client": case.client_name if case else None,
                "requester_email": case.requester_email if case else None,
                "table_id": table.id if table else None,
                "table_name": table.name if table else None,
                "table_display_name": table.display_name if table else None,
                "match_score": match.score,
                "created_at": match.created_at.isoformat() if match.created_at else None
            })
        
        return pending_items

