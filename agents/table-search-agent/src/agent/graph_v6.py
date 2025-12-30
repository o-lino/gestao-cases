"""
LangGraph Workflow V6 (Final)

Complete agent with all features:
- Hierarchical search (Domain → Owner → Table)
- Column-level search
- Historical learning from feedback
- Multi-dimensional disambiguation scoring
- Ambiguity detection with clarifying questions
- LLM-based reranking
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state_v2 import TableSearchStateV2
from .nodes.intent_normalizer import normalize_intent
from .nodes.hierarchical_search import search_domains, search_owners
from .nodes.disambiguation_search import search_tables_with_disambiguation
from .nodes.column_search import search_by_columns, merge_column_and_table_results
from .nodes.llm_reranker import llm_rerank_node
from .nodes.ambiguity_check import check_ambiguity
from .nodes.decision_builder_v2 import decide_v2
from .nodes.feedback_recorder_v2 import record_feedback_v2


def build_graph_v6() -> StateGraph:
    """
    Build V6 LangGraph workflow (final version).
    
    Flow:
    START → normalize_intent → search_domains → search_owners → 
    → [search_tables, search_columns] → merge_results →
    → llm_rerank → check_ambiguity → decide → record → END
    
    Features:
    - Full hierarchical search
    - Column-level search (parallel)
    - LLM reranking (conditional)
    - Ambiguity detection
    - Feedback learning
    """
    workflow = StateGraph(TableSearchStateV2)
    
    # Add nodes
    workflow.add_node("normalize_intent", normalize_intent)
    workflow.add_node("search_domains", search_domains)
    workflow.add_node("search_owners", search_owners)
    workflow.add_node("search_tables", search_tables_with_disambiguation)
    workflow.add_node("search_columns", search_by_columns)
    workflow.add_node("merge_results", merge_column_and_table_results)
    workflow.add_node("llm_rerank", llm_rerank_node)
    workflow.add_node("check_ambiguity", check_ambiguity)
    workflow.add_node("decide", decide_v6)
    workflow.add_node("record_feedback", record_feedback_v2)
    
    # Define flow
    workflow.set_entry_point("normalize_intent")
    workflow.add_edge("normalize_intent", "search_domains")
    workflow.add_edge("search_domains", "search_owners")
    
    # Parallel search
    workflow.add_edge("search_owners", "search_tables")
    workflow.add_edge("search_owners", "search_columns")
    
    # Merge
    workflow.add_edge("search_tables", "merge_results")
    workflow.add_edge("search_columns", "merge_results")
    
    # LLM rerank after merge
    workflow.add_edge("merge_results", "llm_rerank")
    
    # Ambiguity check after rerank
    workflow.add_edge("llm_rerank", "check_ambiguity")
    
    # Decision and record
    workflow.add_edge("check_ambiguity", "decide")
    workflow.add_edge("decide", "record_feedback")
    workflow.add_edge("record_feedback", END)
    
    return workflow


async def decide_v6(state: TableSearchStateV2) -> dict:
    """
    V6 Decision node - combines all enhancements.
    
    Includes:
    - Ambiguity information
    - LLM rerank status
    - Full score breakdown
    """
    from .nodes.decision_builder_v2 import decide_v2
    
    # Get base decision
    base_result = await decide_v2(state)
    
    # Add ambiguity info
    ambiguity_result = state.get("ambiguity_result")
    if ambiguity_result and ambiguity_result.is_ambiguous:
        if base_result.get("ranking_output"):
            base_result["ranking_output"].clarifying_question = ambiguity_result.clarifying_question
        
        base_result["ambiguity"] = {
            "type": ambiguity_result.type.value,
            "is_ambiguous": True,
            "clarifying_question": ambiguity_result.clarifying_question,
            "options": [
                {
                    "id": o.id,
                    "label": o.label,
                    "description": o.description,
                    "table_id": o.table_id,
                }
                for o in ambiguity_result.options
            ],
            "provisional_table_id": ambiguity_result.provisional_table_id,
        }
    else:
        base_result["ambiguity"] = {
            "type": "NONE",
            "is_ambiguous": False,
        }
    
    # Add LLM rerank status
    base_result["llm_reranked"] = state.get("llm_reranked", False)
    
    return base_result


def create_agent_v6(checkpointer: MemorySaver | None = None):
    """Create compiled V6 agent."""
    workflow = build_graph_v6()
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    
    return workflow.compile()


def create_agent_v6_with_memory():
    """Create V6 agent with memory checkpointing."""
    memory = MemorySaver()
    return create_agent_v6(checkpointer=memory)


# Default agent
_default_agent_v6 = None


def get_agent_v6():
    """Get or create default V6 agent."""
    global _default_agent_v6
    if _default_agent_v6 is None:
        _default_agent_v6 = create_agent_v6_with_memory()
    return _default_agent_v6


async def initialize_agent_v6():
    """
    Initialize V6 agent with all systems.
    
    Call on startup to:
    1. Sync quality metrics
    2. Start quality scheduler
    3. Warm up caches
    """
    from .quality import get_quality_cache, start_quality_sync
    
    # Quality sync
    cache = get_quality_cache()
    result = await cache.sync_from_athena(force=True)
    print(f"[AgentV6] Quality sync: {result}")
    
    await start_quality_sync()
    print("[AgentV6] Quality scheduler started")
    
    return get_agent_v6()
