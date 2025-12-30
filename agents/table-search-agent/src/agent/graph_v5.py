"""
LangGraph Workflow V5

Complete agent with:
- Column-level search
- Historical learning
- Disambiguation scoring
- Ambiguity detection with clarifying questions
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state_v2 import TableSearchStateV2
from .nodes.intent_normalizer import normalize_intent
from .nodes.hierarchical_search import search_domains, search_owners
from .nodes.disambiguation_search import search_tables_with_disambiguation
from .nodes.column_search import search_by_columns, merge_column_and_table_results
from .nodes.ambiguity_check import check_ambiguity
from .nodes.decision_builder_v2 import decide_v2
from .nodes.feedback_recorder_v2 import record_feedback_v2


def build_graph_v5() -> StateGraph:
    """
    Build V5 LangGraph workflow.
    
    Flow:
    START → normalize_intent → search_domains → search_owners → 
    → [search_tables, search_columns] → merge_results → 
    → check_ambiguity → decide → record → END
    
    V5 Improvements:
    - Ambiguity detection before decision
    - Clarifying questions in output
    - All V4 features
    """
    workflow = StateGraph(TableSearchStateV2)
    
    # Add nodes
    workflow.add_node("normalize_intent", normalize_intent)
    workflow.add_node("search_domains", search_domains)
    workflow.add_node("search_owners", search_owners)
    workflow.add_node("search_tables", search_tables_with_disambiguation)
    workflow.add_node("search_columns", search_by_columns)
    workflow.add_node("merge_results", merge_column_and_table_results)
    workflow.add_node("check_ambiguity", check_ambiguity)
    workflow.add_node("decide", decide_v5)
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
    
    # Ambiguity check before decision
    workflow.add_edge("merge_results", "check_ambiguity")
    workflow.add_edge("check_ambiguity", "decide")
    
    workflow.add_edge("decide", "record_feedback")
    workflow.add_edge("record_feedback", END)
    
    return workflow


async def decide_v5(state: TableSearchStateV2) -> dict:
    """
    V5 Decision node that considers ambiguity.
    
    If ambiguity detected, include clarifying question in output.
    """
    from .nodes.decision_builder_v2 import decide_v2
    
    # Get base decision
    base_result = await decide_v2(state)
    
    # Check ambiguity result
    ambiguity_result = state.get("ambiguity_result")
    
    if ambiguity_result and ambiguity_result.is_ambiguous:
        # Enhance output with ambiguity info
        if base_result.get("ranking_output"):
            base_result["ranking_output"].clarifying_question = ambiguity_result.clarifying_question
        
        # Add ambiguity data to result
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
    
    return base_result


def create_agent_v5(checkpointer: MemorySaver | None = None):
    """Create compiled V5 agent."""
    workflow = build_graph_v5()
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    
    return workflow.compile()


def create_agent_v5_with_memory():
    """Create V5 agent with memory checkpointing."""
    memory = MemorySaver()
    return create_agent_v5(checkpointer=memory)


# Default agent
_default_agent_v5 = None


def get_agent_v5():
    """Get or create default V5 agent."""
    global _default_agent_v5
    if _default_agent_v5 is None:
        _default_agent_v5 = create_agent_v5_with_memory()
    return _default_agent_v5
