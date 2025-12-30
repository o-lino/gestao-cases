"""
LangGraph Workflow V3

Hierarchical search with disambiguation and quality integration.
Version 3 adds: Use-case based scoring, certification, freshness, quality.
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state_v2 import TableSearchStateV2
from .nodes.intent_normalizer import normalize_intent
from .nodes.hierarchical_search import search_domains, search_owners
from .nodes.disambiguation_search import search_tables_with_disambiguation
from .nodes.decision_builder_v2 import decide_v2
from .nodes.feedback_recorder_v2 import record_feedback_v2


def build_graph_v3() -> StateGraph:
    """
    Build V3 LangGraph workflow.
    
    Flow:
    START → normalize_intent → search_domains → search_owners → 
    → search_tables_with_disambiguation → decide → record_feedback → END
    
    V3 Improvements over V2:
    - Full disambiguation scoring (cert, fresh, quality, context)
    - Use-case based weights (operational, analytical, regulatory)
    - Quality metrics from Athena integration
    """
    workflow = StateGraph(TableSearchStateV2)
    
    # Add nodes
    workflow.add_node("normalize_intent", normalize_intent)
    workflow.add_node("search_domains", search_domains)
    workflow.add_node("search_owners", search_owners)
    workflow.add_node("search_tables", search_tables_with_disambiguation)  # V3 node
    workflow.add_node("decide", decide_v2)
    workflow.add_node("record_feedback", record_feedback_v2)
    
    # Define flow
    workflow.set_entry_point("normalize_intent")
    workflow.add_edge("normalize_intent", "search_domains")
    workflow.add_edge("search_domains", "search_owners")
    workflow.add_edge("search_owners", "search_tables")
    workflow.add_edge("search_tables", "decide")
    workflow.add_edge("decide", "record_feedback")
    workflow.add_edge("record_feedback", END)
    
    return workflow


def create_agent_v3(checkpointer: MemorySaver | None = None):
    """Create compiled V3 agent."""
    workflow = build_graph_v3()
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    
    return workflow.compile()


def create_agent_v3_with_memory():
    """Create V3 agent with memory checkpointing."""
    memory = MemorySaver()
    return create_agent_v3(checkpointer=memory)


# Default V3 agent instance
_default_agent_v3 = None


def get_agent_v3():
    """Get or create default V3 agent."""
    global _default_agent_v3
    if _default_agent_v3 is None:
        _default_agent_v3 = create_agent_v3_with_memory()
    return _default_agent_v3


async def initialize_agent_v3():
    """
    Initialize V3 agent with quality sync.
    
    Call this on application startup to:
    1. Sync quality metrics from Athena
    2. Start the proactive sync scheduler
    """
    from .quality import get_quality_cache, start_quality_sync
    
    # Initial sync
    cache = get_quality_cache()
    result = await cache.sync_from_athena(force=True)
    print(f"[AgentV3] Initial quality sync: {result}")
    
    # Start scheduler
    await start_quality_sync()
    print("[AgentV3] Quality sync scheduler started")
    
    # Get agent
    return get_agent_v3()
