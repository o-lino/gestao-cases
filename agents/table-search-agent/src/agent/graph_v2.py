"""
LangGraph Workflow V2

Hierarchical search with intent normalization.
Supports multiple output modes for different consumers.
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state_v2 import TableSearchStateV2
from .nodes.intent_normalizer import normalize_intent
from .nodes.hierarchical_search import search_domains, search_owners, search_tables_v2
from .nodes.decision_builder_v2 import decide_v2
from .nodes.feedback_recorder_v2 import record_feedback_v2


def build_graph_v2() -> StateGraph:
    """
    Build V2 LangGraph workflow.
    
    Flow:
    START → normalize_intent → search_domains → search_owners → 
    → search_tables → decide → record_feedback → END
    
    Key differences from V1:
    - Intent normalization first (LLM understands query)
    - Hierarchical search (domain → owner → table)
    - Multi-output modes (single match / ranking)
    - Feedback-driven learning
    """
    workflow = StateGraph(TableSearchStateV2)
    
    # Add nodes
    workflow.add_node("normalize_intent", normalize_intent)
    workflow.add_node("search_domains", search_domains)
    workflow.add_node("search_owners", search_owners)
    workflow.add_node("search_tables", search_tables_v2)
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


def create_agent_v2(checkpointer: MemorySaver | None = None):
    """Create compiled V2 agent."""
    workflow = build_graph_v2()
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    
    return workflow.compile()


def create_agent_v2_with_memory():
    """Create V2 agent with memory checkpointing."""
    memory = MemorySaver()
    return create_agent_v2(checkpointer=memory)


# Default V2 agent instance
_default_agent_v2 = None


def get_agent_v2():
    """Get or create default V2 agent."""
    global _default_agent_v2
    if _default_agent_v2 is None:
        _default_agent_v2 = create_agent_v2_with_memory()
    return _default_agent_v2
