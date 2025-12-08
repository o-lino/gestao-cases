
from typing import List, Dict
from fastapi import HTTPException, status
from app.schemas.case import CaseStatus
from app.models.collaborator import Collaborator

class WorkflowService:
    # Transition Rules: {CurrentStatus: {TargetStatus: [AllowedRoles]}}
    TRANSITIONS: Dict[CaseStatus, Dict[CaseStatus, List[str]]] = {
        CaseStatus.DRAFT: {
            CaseStatus.SUBMITTED: ["USER", "MANAGER", "ADMIN"]
        },
        CaseStatus.SUBMITTED: {
            CaseStatus.REVIEW: ["MANAGER", "ADMIN"],
            CaseStatus.DRAFT: ["USER", "MANAGER", "ADMIN"] # Recall
        },
        CaseStatus.REVIEW: {
            CaseStatus.APPROVED: ["MANAGER", "ADMIN"],
            CaseStatus.REJECTED: ["MANAGER", "ADMIN"],
            CaseStatus.DRAFT: ["MANAGER", "ADMIN"] # Send back to draft
        },
        CaseStatus.REJECTED: {
            CaseStatus.DRAFT: ["USER", "MANAGER", "ADMIN"] # Re-edit
        },
        CaseStatus.APPROVED: {
            CaseStatus.CLOSED: ["ADMIN", "MANAGER"]
        },
        CaseStatus.CLOSED: {
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

workflow_service = WorkflowService()
