"""
Decision Maker Node

Makes final recommendation decisions based on scores:
- Ranks candidates by total score
- Determines confidence level
- Generates reasoning
- Selects top recommendation if confidence is high enough
"""

from typing import Any

from ..state import (
    TableSearchState, 
    TableRecommendation, 
    ConfidenceLevel,
    TableCandidate,
    TableScore,
)
from src.core.config import settings


def determine_confidence_level(score: float) -> ConfidenceLevel:
    """Determine confidence level based on score."""
    if score >= settings.auto_select_threshold:
        return ConfidenceLevel.HIGH
    elif score >= settings.suggest_threshold:
        return ConfidenceLevel.MEDIUM
    else:
        return ConfidenceLevel.LOW


def generate_match_reason(table: TableCandidate, score: TableScore) -> str:
    """Generate human-readable match reason."""
    reasons = []
    
    if score.semantic_score >= 0.6:
        reasons.append(f"Alta similaridade semântica ({int(score.semantic_score * 100)}%)")
    
    if score.historical_score >= 0.7:
        reasons.append(f"Histórico positivo ({int(score.historical_score * 100)}% aprovação)")
    
    if score.domain_score >= 0.8:
        reasons.append(f"Mesmo domínio ({table.domain})")
    
    if score.keyword_score >= 0.5:
        reasons.append("Keywords compatíveis")
    
    if not reasons:
        reasons.append("Match baseado em análise geral")
    
    return "; ".join(reasons)


def generate_overall_reasoning(
    recommendations: list[TableRecommendation],
    confidence_level: ConfidenceLevel,
    variable_name: str
) -> str:
    """Generate overall reasoning for the decision."""
    if not recommendations:
        return f"Nenhuma tabela encontrada para a variável '{variable_name}'."
    
    top = recommendations[0]
    
    if confidence_level == ConfidenceLevel.HIGH:
        return (
            f"Recomendação de alta confiança: '{top.table.display_name}' "
            f"(score: {top.score.total_score:.2f}). {top.match_reason}"
        )
    elif confidence_level == ConfidenceLevel.MEDIUM:
        return (
            f"Sugestão para '{variable_name}': '{top.table.display_name}' "
            f"(score: {top.score.total_score:.2f}). {len(recommendations)} opções encontradas. "
            f"Validação humana recomendada."
        )
    else:
        return (
            f"Confiança baixa para '{variable_name}'. "
            f"{len(recommendations)} opções encontradas. "
            f"Requer validação humana."
        )


def make_decision(state: TableSearchState) -> dict[str, Any]:
    """
    Node: Make final recommendation decision.
    
    This node:
    1. Ranks candidates by score
    2. Filters by minimum score threshold
    3. Determines confidence level
    4. Creates recommendations with reasoning
    5. Selects top recommendation if confidence allows
    
    Returns:
        State update with recommendations and confidence.
    """
    # Build table lookup
    tables_by_id = {t.id: t for t in state["candidate_tables"]}
    
    # Sort scores
    sorted_scores = sorted(
        state["scores"].values(),
        key=lambda s: s.total_score,
        reverse=True
    )
    
    # Filter by minimum score and limit results
    recommendations = []
    for i, score in enumerate(sorted_scores):
        if score.total_score < settings.min_match_score:
            break
        if i >= state["max_results"]:
            break
        
        table = tables_by_id.get(score.table_id)
        if not table:
            continue
        
        confidence_level = determine_confidence_level(score.total_score)
        match_reason = generate_match_reason(table, score)
        
        recommendations.append(TableRecommendation(
            table=table,
            score=score,
            rank=i + 1,
            reasoning=match_reason,
            confidence_level=confidence_level,
            match_reason=match_reason,
            matched_column=None,  # Could be enhanced to find specific columns
        ))
    
    # Determine overall confidence
    if recommendations:
        top_score = recommendations[0].score.total_score
        overall_confidence = top_score
        overall_level = determine_confidence_level(top_score)
        top_recommendation = recommendations[0]
    else:
        overall_confidence = 0.0
        overall_level = ConfidenceLevel.LOW
        top_recommendation = None
    
    # Generate reasoning
    overall_reasoning = generate_overall_reasoning(
        recommendations,
        overall_level,
        state["variable_name"]
    )
    
    return {
        "recommendations": recommendations,
        "top_recommendation": top_recommendation,
        "overall_confidence": overall_confidence,
        "confidence_level": overall_level,
        "overall_reasoning": overall_reasoning,
        "current_step": "decided",
    }
