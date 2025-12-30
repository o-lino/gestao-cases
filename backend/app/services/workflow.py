
from typing import List, Dict, Any, Tuple
from fastapi import HTTPException, status
from app.schemas.case import CaseStatus
from app.models.collaborator import Collaborator

class WorkflowService:
    # Transition Rules: {CurrentStatus: {TargetStatus: [AllowedRoles]}}
    TRANSITIONS: Dict[CaseStatus, Dict[CaseStatus, List[str]]] = {
        CaseStatus.DRAFT: {
            CaseStatus.SUBMITTED: ["USER", "MANAGER", "ADMIN"],
            CaseStatus.CANCELLED: ["USER", "MANAGER", "ADMIN"]
        },
        CaseStatus.SUBMITTED: {
            CaseStatus.REVIEW: ["MANAGER", "ADMIN"],
            CaseStatus.DRAFT: ["USER", "MANAGER", "ADMIN"],  # Recall
            CaseStatus.CANCELLED: ["USER", "MANAGER", "ADMIN"]
        },
        CaseStatus.REVIEW: {
            CaseStatus.APPROVED: ["MANAGER", "ADMIN"],
            CaseStatus.REJECTED: ["MANAGER", "ADMIN"],
            CaseStatus.DRAFT: ["MANAGER", "ADMIN"],  # Send back to draft
            CaseStatus.CANCELLED: ["USER", "MANAGER", "ADMIN"]
        },
        CaseStatus.REJECTED: {
            CaseStatus.DRAFT: ["USER", "MANAGER", "ADMIN"],  # Re-edit
            CaseStatus.CANCELLED: ["USER", "MANAGER", "ADMIN"]
        },
        CaseStatus.APPROVED: {
            CaseStatus.CLOSED: ["ADMIN", "MANAGER"],
            CaseStatus.CANCELLED: ["USER", "MANAGER", "ADMIN"]
        },
        CaseStatus.CLOSED: {
            # Terminal state
        },
        CaseStatus.CANCELLED: {
            # Terminal state
        }
    }

    @classmethod
    def validate_transition(cls, current_status: CaseStatus, target_status: CaseStatus, user: Collaborator):
        """
        Validates if a transition is allowed based on the state machine and user role.
        """
        allowed_transitions = cls.TRANSITIONS.get(current_status, {})
        
        if target_status not in allowed_transitions:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid transition from {current_status} to {target_status}"
            )
        
        allowed_roles = allowed_transitions[target_status]
        if user.role not in allowed_roles:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role {user.role} not authorized for this transition"
            )
        
        return True

    @classmethod
    def validate_can_close(cls, variables: List[Any]) -> Tuple[bool, str]:
        """
        Validates if a case can be closed based on its variables.
        All variables must be either IN_USE or CANCELLED.
        Returns (can_close, reason_message).
        """
        if not variables:
            return True, ""  # No variables, can close
        
        # Terminal states that allow case closure
        closeable_statuses = ['IN_USE', 'CANCELLED']
        
        # Count variables not in closeable state
        not_ready = []
        for v in variables:
            status = getattr(v, 'search_status', 'PENDING')
            is_cancelled = getattr(v, 'is_cancelled', False)
            
            if is_cancelled or status in closeable_statuses:
                continue
            
            not_ready.append({
                'name': getattr(v, 'variable_name', 'Unknown'),
                'status': status
            })
        
        if not_ready:
            names = ', '.join([v['name'] for v in not_ready[:3]])
            if len(not_ready) > 3:
                names += f" (+{len(not_ready) - 3} mais)"
            return False, f"Não é possível fechar o case. As variáveis precisam estar 'Em Uso' ou 'Canceladas'. Pendentes: {names}"
        
        return True, ""
    
    @classmethod
    def get_case_closure_summary(cls, variables: List[Any]) -> Dict[str, Any]:
        """Get summary of variable statuses for case closure UI"""
        summary = {
            'in_use': 0,
            'approved': 0,
            'cancelled': 0,
            'pending': 0,
            'total': len(variables),
            'can_close': False,
            'message': ''
        }
        
        for v in variables:
            status = getattr(v, 'search_status', 'PENDING')
            is_cancelled = getattr(v, 'is_cancelled', False)
            
            if is_cancelled or status == 'CANCELLED':
                summary['cancelled'] += 1
            elif status == 'IN_USE':
                summary['in_use'] += 1
            elif status == 'APPROVED':
                summary['approved'] += 1
            else:
                summary['pending'] += 1
        
        can_close, message = cls.validate_can_close(variables)
        summary['can_close'] = can_close
        summary['message'] = message
        
        return summary

workflow_service = WorkflowService()


