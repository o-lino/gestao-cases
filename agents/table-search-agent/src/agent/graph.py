"""
LangGraph Workflow Definition

Defines the graph structure for the table search agent.
Uses a state machine pattern with conditional routing.
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state import TableSearchState, ConfidenceLevel
from .nodes.context_analyzer import analyze_context
from .nodes.table_retriever import retrieve_tables
from .nodes.score_calculator import calculate_scores
from .nodes.decision_maker import make_decision
from .nodes.history_learner import record_history


def should_retrieve_more(state: TableSearchState) -> str:
    """
    Conditional edge: decide if we need to retrieve more tables.
    
    Returns:
        - "retrieve_more": if needs_more_context and iteration < max
        - "calculate": otherwise, proceed to scoring
    """
    if state["needs_more_context"] and state["iteration"] < state["max_iterations"]:
        return "retrieve_more"
    return "calculate"


def should_finalize(state: TableSearchState) -> str:
    """
    Conditional edge: decide if we have enough confidence to finalize.
    
    Returns:
        - "finalize": proceed to decision making
        - "iterate": go back to retrieval for more context
    """
    # Always finalize after scoring in this version
    # Future: could add iteration logic here
    return "finalize"


def build_graph() -> StateGraph:
    """
    Build the LangGraph workflow for table search.
    
    Workflow:
    START → analyze_context → retrieve_tables → calculate_scores → 
    → make_decision → record_history → END
    
    With conditional routing for re-retrieval if confidence is low.
    """
    # Initialize the graph with our state type
    workflow = StateGraph(TableSearchState)
    
    # Add nodes
    workflow.add_node("analyze_context", analyze_context)
    workflow.add_node("retrieve_tables", retrieve_tables)
    workflow.add_node("calculate_scores", calculate_scores)
    workflow.add_node("make_decision", make_decision)
    workflow.add_node("record_history", record_history)
    
    # Define edges
    workflow.set_entry_point("analyze_context")
    
    # Linear flow for now (can add conditional edges later)
    workflow.add_edge("analyze_context", "retrieve_tables")
    workflow.add_edge("retrieve_tables", "calculate_scores")
    workflow.add_edge("calculate_scores", "make_decision")
    workflow.add_edge("make_decision", "record_history")
    workflow.add_edge("record_history", END)
    
    return workflow


def create_agent(checkpointer: MemorySaver | None = None):
    """
    Create the compiled agent with optional checkpointing.
    
    Args:
        checkpointer: Optional LangGraph checkpointer for state persistence.
                     Use MemorySaver for short-term memory.
    
    Returns:
        Compiled LangGraph runnable.
    """
    workflow = build_graph()
    
    if checkpointer:
        return workflow.compile(checkpointer=checkpointer)
    
    return workflow.compile()


def create_agent_with_memory():
    """
    Create agent with built-in memory checkpointing.
    
    This enables:
    - Session persistence
    - State recovery after failures
    - Conversation history tracking
    """
    memory = MemorySaver()
    return create_agent(checkpointer=memory)


# Default agent instance (lazy initialization)
_default_agent = None


def get_agent():
    """Get or create the default agent instance."""
    global _default_agent
    if _default_agent is None:
        _default_agent = create_agent_with_memory()
    return _default_agent
