"""
LangGraph Workflow V4

Full-featured agent with:
- Column-level search
- Historical learning
- Disambiguation scoring
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state_v2 import TableSearchStateV2
from .nodes.intent_normalizer import normalize_intent
from .nodes.hierarchical_search import search_domains, search_owners
from .nodes.disambiguation_search import search_tables_with_disambiguation
from .nodes.column_search import search_by_columns, merge_column_and_table_results
from .nodes.decision_builder_v2 import decide_v2
from .nodes.feedback_recorder_v2 import record_feedback_v2


def build_graph_v4() -> StateGraph:
    """
    Build V4 LangGraph workflow.
    
    Flow:
    START → normalize_intent → search_domains → search_owners → 
    → [search_tables, search_columns] → merge_results → decide → record → END
    
    V4 Improvements:
    - Column-level search for field queries
    - Historical learning from feedback
    - Full disambiguation scoring
    """
    workflow = StateGraph(TableSearchStateV2)
    
    # Add nodes
    workflow.add_node("normalize_intent", normalize_intent)
    workflow.add_node("search_domains", search_domains)
    workflow.add_node("search_owners", search_owners)
    workflow.add_node("search_tables", search_tables_with_disambiguation)
    workflow.add_node("search_columns", search_by_columns)
    workflow.add_node("merge_results", merge_column_and_table_results)
    workflow.add_node("decide", decide_v2)
    workflow.add_node("record_feedback", record_feedback_v2)
    
    # Define flow
    workflow.set_entry_point("normalize_intent")
    workflow.add_edge("normalize_intent", "search_domains")
    workflow.add_edge("search_domains", "search_owners")
    
    # Parallel search: tables and columns
    workflow.add_edge("search_owners", "search_tables")
    workflow.add_edge("search_owners", "search_columns")
    
    # Merge after both searches complete
    workflow.add_edge("search_tables", "merge_results")
    workflow.add_edge("search_columns", "merge_results")
    
    workflow.add_edge("merge_results", "decide")
    workflow.add_edge("decide", "record_feedback")
    workflow.add_edge("record_feedback", END)
    
    return workflow


def create_agent_v4(checkpointer: MemorySaver | None = None):
    """Create compiled V4 agent."""
    workflow = build_graph_v4()
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    
    return workflow.compile()


def create_agent_v4_with_memory():
    """Create V4 agent with memory checkpointing."""
    memory = MemorySaver()
    return create_agent_v4(checkpointer=memory)


# Default V4 agent
_default_agent_v4 = None


def get_agent_v4():
    """Get or create default V4 agent."""
    global _default_agent_v4
    if _default_agent_v4 is None:
        _default_agent_v4 = create_agent_v4_with_memory()
    return _default_agent_v4


async def initialize_agent_v4():
    """
    Initialize V4 agent with all systems.
    
    Call on startup to:
    1. Sync quality metrics
    2. Start quality scheduler
    3. Initialize column index
    """
    from .quality import get_quality_cache, start_quality_sync
    
    # Quality sync
    cache = get_quality_cache()
    result = await cache.sync_from_athena(force=True)
    print(f"[AgentV4] Quality sync: {result}")
    
    await start_quality_sync()
    print("[AgentV4] Quality scheduler started")
    
    return get_agent_v4()
