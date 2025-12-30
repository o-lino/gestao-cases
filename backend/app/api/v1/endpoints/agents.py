"""
Agent API Endpoints

MCP-compatible endpoints for AI agents:
- Tools: Actions agents can execute
- Resources: Data agents can query
- Decisions: Record and query decisions
- Consensus: Vote on pending decisions
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.session import get_db
from app.models.agent_decision import DecisionType, DecisionStatus, ConsensusStatus
from app.services.agent_decision_service import AgentDecisionService, AgentDecisionError

router = APIRouter()


# ================== Schemas ==================

class ToolDefinition(BaseModel):
    """Definition of a tool available to agents"""
    name: str
    description: str
    parameters: Dict[str, Any]
    returns: Dict[str, Any]


class ResourceDefinition(BaseModel):
    """Definition of a resource agents can access"""
    name: str
    description: str
    uri_template: str
    parameters: Optional[Dict[str, Any]] = None


class ContextData(BaseModel):
    """Context data for decision matching"""
    domain: Optional[str] = None
    entity_type: Optional[str] = None
    concept: Optional[str] = None
    extra: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, merging extra fields"""
        result = {}
        if self.domain:
            result["domain"] = self.domain
        if self.entity_type:
            result["entity_type"] = self.entity_type
        if self.concept:
            result["concept"] = self.concept
        if self.extra:
            result.update(self.extra)
        return result


class DecisionRequest(BaseModel):
    """Request to record a decision"""
    agent_id: str = Field(..., description="Unique identifier for the agent")
    agent_version: Optional[str] = Field(None, description="Version of the agent")
    decision_type: DecisionType = Field(..., description="Type of decision")
    context_type: str = Field(..., description="Type of context (e.g., 'variable_matching')")
    context_data: ContextData = Field(..., description="Context data for matching")
    decision_value: Dict[str, Any] = Field(..., description="The actual decision")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Agent's confidence (0-1)")
    reasoning: Optional[str] = Field(None, description="Explanation of the decision")
    related_case_id: Optional[int] = Field(None, description="Related case ID if applicable")
    related_variable_id: Optional[int] = Field(None, description="Related variable ID if applicable")
    related_table_id: Optional[int] = Field(None, description="Related table ID if applicable")
    require_consensus: Optional[bool] = Field(None, description="Force consensus requirement")


class DecisionResponse(BaseModel):
    """Response for a recorded decision"""
    id: int
    status: DecisionStatus
    is_reused: bool
    source_decision_id: Optional[int] = None
    consensus_required: bool = False
    decision_value: Dict[str, Any]
    confidence_score: float


class VoteRequest(BaseModel):
    """Request to vote on a decision"""
    approve: bool = Field(..., description="True to approve, False to reject")
    comment: Optional[str] = Field(None, description="Optional comment explaining the vote")


class ReusableDecisionQuery(BaseModel):
    """Query for finding reusable decisions"""
    context_type: str = Field(..., description="Type of context")
    context_data: ContextData = Field(..., description="Context data to match")


class PendingDecisionResponse(BaseModel):
    """Response for a pending decision"""
    id: int
    agent_id: str
    decision_type: str
    decision_value: Dict[str, Any]
    confidence_score: float
    reasoning: Optional[str]
    context_type: Optional[str]
    created_at: datetime
    consensus: Optional[Dict[str, Any]]


class StatisticsResponse(BaseModel):
    """Response for decision statistics"""
    total_decisions: int
    status_counts: Dict[str, int]
    reused_count: int
    average_confidence: float
    reuse_rate: float


class VoteResponse(BaseModel):
    """Response after voting"""
    success: bool
    consensus_status: str
    approval_votes: int
    rejection_votes: int
    resolved: bool


# ================== Tools Endpoints ==================

@router.get("/tools", response_model=List[ToolDefinition], summary="List Available Tools")
async def list_tools():
    """
    List all tools available to agents.
    Compatible with MCP tool discovery.
    
    Tools define actions that agents can execute in the system.
    """
    return [
        ToolDefinition(
            name="record_decision",
            description="Record a decision made by the agent for potential reuse in similar contexts",
            parameters={
                "type": "object",
                "properties": {
                    "decision_type": {
                        "type": "string",
                        "enum": [e.value for e in DecisionType],
                        "description": "Type of decision being made"
                    },
                    "context_type": {
                        "type": "string",
                        "description": "Category of context (e.g., 'variable_matching', 'case_classification')"
                    },
                    "context_data": {
                        "type": "object",
                        "description": "Context data that led to this decision",
                        "properties": {
                            "domain": {"type": "string"},
                            "entity_type": {"type": "string"},
                            "concept": {"type": "string"}
                        }
                    },
                    "decision_value": {
                        "type": "object",
                        "description": "The actual decision content"
                    },
                    "confidence_score": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1,
                        "description": "Agent's confidence in the decision"
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Explanation of why this decision was made"
                    }
                },
                "required": ["decision_type", "context_type", "context_data", "decision_value", "confidence_score"]
            },
            returns={
                "type": "object",
                "properties": {
                    "decision_id": {"type": "integer"},
                    "status": {"type": "string"},
                    "is_reused": {"type": "boolean"}
                }
            }
        ),
        ToolDefinition(
            name="find_reusable_decision",
            description="Find a previously approved decision for similar context to reuse",
            parameters={
                "type": "object",
                "properties": {
                    "context_type": {"type": "string"},
                    "context_data": {"type": "object"}
                },
                "required": ["context_type", "context_data"]
            },
            returns={
                "type": "object",
                "properties": {
                    "found": {"type": "boolean"},
                    "decision": {"type": "object", "nullable": True}
                }
            }
        ),
        ToolDefinition(
            name="search_cases",
            description="Search cases by criteria",
            parameters={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Filter by case status"},
                    "domain": {"type": "string", "description": "Filter by domain"},
                    "limit": {"type": "integer", "default": 10, "description": "Maximum results"}
                }
            },
            returns={"type": "array", "items": {"type": "object"}}
        ),
        ToolDefinition(
            name="get_approval_history",
            description="Get approval history for a concept to understand past decisions",
            parameters={
                "type": "object",
                "properties": {
                    "context_type": {"type": "string"},
                    "concept": {"type": "string"}
                },
                "required": ["context_type"]
            },
            returns={
                "type": "object",
                "properties": {
                    "total_decisions": {"type": "integer"},
                    "approval_rate": {"type": "number"}
                }
            }
        ),
        ToolDefinition(
            name="vote_on_decision",
            description="Submit a vote to approve or reject a pending decision",
            parameters={
                "type": "object",
                "properties": {
                    "decision_id": {"type": "integer"},
                    "approve": {"type": "boolean"},
                    "comment": {"type": "string"}
                },
                "required": ["decision_id", "approve"]
            },
            returns={
                "type": "object",
                "properties": {
                    "success": {"type": "boolean"},
                    "consensus_status": {"type": "string"}
                }
            }
        )
    ]


# ================== Resources Endpoints ==================

@router.get("/resources", response_model=List[ResourceDefinition], summary="List Available Resources")
async def list_resources():
    """
    List all resources available to agents.
    Compatible with MCP resource discovery.
    
    Resources define data that agents can access.
    """
    return [
        ResourceDefinition(
            name="cases",
            description="Access case data including metadata and variables",
            uri_template="/api/v1/cases/{case_id}",
            parameters={"case_id": {"type": "integer", "description": "Case ID"}}
        ),
        ResourceDefinition(
            name="case_variables",
            description="Access variables associated with a case",
            uri_template="/api/v1/cases/{case_id}/variables",
            parameters={"case_id": {"type": "integer", "description": "Case ID"}}
        ),
        ResourceDefinition(
            name="data_tables",
            description="Access data catalog tables",
            uri_template="/api/v1/matching/tables/{table_id}",
            parameters={"table_id": {"type": "integer", "description": "Table ID"}}
        ),
        ResourceDefinition(
            name="approval_history",
            description="Access historical approval decisions for learning",
            uri_template="/api/v1/agents/decisions/history?context_type={context_type}",
            parameters={"context_type": {"type": "string", "description": "Type of context"}}
        ),
        ResourceDefinition(
            name="decision_contexts",
            description="Access decision context patterns and statistics",
            uri_template="/api/v1/agents/contexts?domain={domain}",
            parameters={"domain": {"type": "string", "description": "Domain filter"}}
        ),
        ResourceDefinition(
            name="pending_decisions",
            description="Access decisions waiting for consensus validation",
            uri_template="/api/v1/agents/decisions/pending",
            parameters={}
        )
    ]


# ================== Decisions Endpoints ==================

@router.post("/decisions", response_model=DecisionResponse, summary="Record Agent Decision")
async def record_decision(
    request: DecisionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Record a decision made by an agent.
    
    The system will:
    1. Check if a similar context has approved decisions for reuse
    2. If reusable decision found, return it with is_reused=True
    3. If confidence is high enough (>85%), auto-approve
    4. Otherwise, create consensus request for validation
    
    **Reuse Logic:**
    - Decisions are matched by context hash (deterministic)
    - Contexts with 70%+ approval rate and 3+ decisions enable auto-reuse
    - High confidence (85%+) decisions are auto-approved
    """
    try:
        context_data = request.context_data.to_dict()
        
        decision = await AgentDecisionService.record_decision(
            db=db,
            agent_id=request.agent_id,
            decision_type=request.decision_type,
            context_type=request.context_type,
            context_data=context_data,
            decision_value=request.decision_value,
            confidence_score=request.confidence_score,
            reasoning=request.reasoning,
            related_case_id=request.related_case_id,
            related_variable_id=request.related_variable_id,
            related_table_id=request.related_table_id,
            agent_version=request.agent_version,
            require_consensus=request.require_consensus
        )
        
        return DecisionResponse(
            id=decision.id,
            status=decision.status,
            is_reused=decision.is_reused,
            source_decision_id=decision.source_decision_id,
            consensus_required=decision.status == DecisionStatus.CONSENSUS_REQUIRED,
            decision_value=decision.decision_value,
            confidence_score=decision.confidence_score
        )
        
    except AgentDecisionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.post("/decisions/find-reusable", summary="Find Reusable Decision")
async def find_reusable_decision(
    query: ReusableDecisionQuery,
    db: AsyncSession = Depends(get_db)
):
    """
    Find a reusable decision for the given context.
    
    Returns null if no suitable decision exists.
    A decision is reusable if:
    - The context has 3+ historical decisions
    - The context has 70%+ approval rate
    - An approved decision exists with 70%+ confidence
    """
    import logging
    try:
        context_data = query.context_data.to_dict()
        
        decision = await AgentDecisionService.find_reusable_decision(
            db=db,
            context_type=query.context_type,
            context_data=context_data
        )
        
        if decision:
            return {
                "found": True,
                "decision": {
                    "id": decision.id,
                    "decision_value": decision.decision_value,
                    "confidence_score": decision.confidence_score,
                    "reasoning": decision.reasoning,
                    "reuse_count": decision.reuse_count,
                    "agent_id": decision.agent_id,
                    "created_at": decision.created_at.isoformat()
                }
            }
        
        return {"found": False, "decision": None}
    except Exception as e:
        logging.warning(f"Error finding reusable decision: {e}")
        return {"found": False, "decision": None}


@router.get("/decisions/pending", response_model=List[PendingDecisionResponse], summary="Get Pending Decisions")
async def get_pending_decisions(
    voter_id: Optional[int] = Query(None, description="Filter out decisions already voted by this user"),
    decision_type: Optional[DecisionType] = Query(None, description="Filter by decision type"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get decisions pending consensus validation.
    
    These are decisions that require collective approval before they can be reused.
    Use voter_id to filter out decisions you've already voted on.
    """
    import logging
    try:
        decisions = await AgentDecisionService.get_pending_decisions(
            db=db,
            voter_id=voter_id,
            decision_type=decision_type
        )
        
        return [
            PendingDecisionResponse(
                id=d.id,
                agent_id=d.agent_id,
                decision_type=d.decision_type.value,
                decision_value=d.decision_value,
                confidence_score=d.confidence_score,
                reasoning=d.reasoning,
                context_type=d.context.context_type if d.context else None,
                created_at=d.created_at,
                consensus={
                    "id": d.consensus[0].id if d.consensus else None,
                    "approval_votes": d.consensus[0].approval_votes if d.consensus else 0,
                    "rejection_votes": d.consensus[0].rejection_votes if d.consensus else 0,
                    "required_approvals": d.consensus[0].required_approvals if d.consensus else 2,
                    "voting_deadline": d.consensus[0].voting_deadline.isoformat() if d.consensus else None,
                    "status": d.consensus[0].status.value if d.consensus else None
                } if d.consensus else None
            )
            for d in decisions
        ]
    except Exception as e:
        logging.warning(f"Error getting pending decisions: {e}")
        return []


@router.get("/decisions/{decision_id}", summary="Get Decision Details")
async def get_decision(
    decision_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a specific decision."""
    decision = await AgentDecisionService.get_decision_by_id(db, decision_id)
    
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    return {
        "id": decision.id,
        "agent_id": decision.agent_id,
        "agent_version": decision.agent_version,
        "decision_type": decision.decision_type.value,
        "decision_value": decision.decision_value,
        "confidence_score": decision.confidence_score,
        "reasoning": decision.reasoning,
        "status": decision.status.value,
        "is_reused": decision.is_reused,
        "source_decision_id": decision.source_decision_id,
        "reuse_count": decision.reuse_count,
        "created_at": decision.created_at.isoformat(),
        "validated_at": decision.validated_at.isoformat() if decision.validated_at else None,
        "context": {
            "id": decision.context.id,
            "context_type": decision.context.context_type,
            "domain": decision.context.domain,
            "concept": decision.context.concept,
            "approval_rate": decision.context.approval_rate,
            "total_decisions": decision.context.total_decisions
        } if decision.context else None,
        "consensus": {
            "id": decision.consensus[0].id,
            "status": decision.consensus[0].status.value,
            "approval_votes": decision.consensus[0].approval_votes,
            "rejection_votes": decision.consensus[0].rejection_votes,
            "required_approvals": decision.consensus[0].required_approvals,
            "voting_deadline": decision.consensus[0].voting_deadline.isoformat()
        } if decision.consensus else None,
        "related_case_id": decision.related_case_id,
        "related_variable_id": decision.related_variable_id,
        "related_table_id": decision.related_table_id
    }


@router.post("/decisions/{decision_id}/vote", response_model=VoteResponse, summary="Vote on Decision")
async def vote_on_decision(
    decision_id: int,
    request: VoteRequest,
    voter_id: int = Query(..., description="ID of the voting user"),
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a vote for a decision requiring consensus.
    
    Each user can only vote once per decision.
    When quorum is reached, the decision is automatically approved or rejected.
    """
    try:
        consensus = await AgentDecisionService.vote_on_decision(
            db=db,
            decision_id=decision_id,
            voter_id=voter_id,
            approve=request.approve,
            comment=request.comment
        )
        
        return VoteResponse(
            success=True,
            consensus_status=consensus.status.value,
            approval_votes=consensus.approval_votes,
            rejection_votes=consensus.rejection_votes,
            resolved=consensus.status != ConsensusStatus.VOTING
        )
        
    except AgentDecisionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/decisions/statistics", response_model=StatisticsResponse, summary="Get Decision Statistics")
async def get_decision_statistics(
    context_type: Optional[str] = Query(None, description="Filter by context type"),
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about agent decisions.
    
    Useful for understanding decision patterns and reuse rates.
    """
    stats = await AgentDecisionService.get_decision_statistics(
        db=db,
        context_type=context_type,
        agent_id=agent_id
    )
    
    return StatisticsResponse(**stats)


@router.get("/decisions/history", summary="Get Decision History")
async def get_decision_history(
    context_type: str = Query(..., description="Type of context"),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get historical decisions for a context type.
    
    Useful for learning from past decisions.
    """
    import logging
    try:
        decisions = await AgentDecisionService.get_decisions_by_context(
            db=db,
            context_type=context_type,
            status=DecisionStatus.APPROVED,
            limit=limit
        )
        
        # Filter by domain if provided
        if domain:
            decisions = [d for d in decisions if d.context and d.context.domain == domain]
        
        return {
            "context_type": context_type,
            "domain": domain,
            "count": len(decisions),
            "decisions": [
                {
                    "id": d.id,
                    "decision_value": d.decision_value,
                    "confidence_score": d.confidence_score,
                    "reasoning": d.reasoning,
                    "reuse_count": d.reuse_count,
                    "context": {
                        "domain": d.context.domain if d.context else None,
                        "concept": d.context.concept if d.context else None
                    },
                    "created_at": d.created_at.isoformat()
                }
                for d in decisions
            ]
        }
    except Exception as e:
        logging.warning(f"Error getting decision history: {e}")
        return {
            "context_type": context_type,
            "domain": domain,
            "count": 0,
            "decisions": []
        }
