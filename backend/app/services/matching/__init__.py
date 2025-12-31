"""
Matching Service Package

Modular implementation of the data matching workflow.

Modules:
- scoring: Score calculation algorithms
- search: Table search and match creation
- history: Approval history tracking
"""

from app.services.matching.scoring import (
    WEIGHT_SEMANTIC,
    WEIGHT_HISTORY,
    WEIGHT_KEYWORD,
    WEIGHT_DOMAIN,
    MIN_MATCH_SCORE,
    generate_concept_hash,
    calculate_semantic_similarity,
    calculate_keyword_match,
    calculate_match_score,
)

from app.services.matching.search import (
    MatchingError,
    search_matches,
    get_matches_for_variable,
)

from app.services.matching.history import (
    update_approval_history,
)

__all__ = [
    # Scoring
    "WEIGHT_SEMANTIC",
    "WEIGHT_HISTORY", 
    "WEIGHT_KEYWORD",
    "WEIGHT_DOMAIN",
    "MIN_MATCH_SCORE",
    "generate_concept_hash",
    "calculate_semantic_similarity",
    "calculate_keyword_match",
    "calculate_match_score",
    # Search
    "MatchingError",
    "search_matches",
    "get_matches_for_variable",
    # History
    "update_approval_history",
]
