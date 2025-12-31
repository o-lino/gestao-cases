"""
Matching Service - Scoring Module

Contains scoring algorithms for matching variables to data tables.
"""

import hashlib
from typing import List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_catalog import DataTable, ApprovalHistory


# Score weights - can be tuned based on business requirements
WEIGHT_SEMANTIC = 0.40
WEIGHT_HISTORY = 0.30
WEIGHT_KEYWORD = 0.20
WEIGHT_DOMAIN = 0.10

# Minimum score to consider a match
MIN_MATCH_SCORE = 0.3


def generate_concept_hash(variable_name: str, variable_type: str) -> str:
    """Generate a hash for concept-based caching"""
    normalized = f"{variable_name.lower().strip()}:{variable_type.lower()}"
    return hashlib.sha256(normalized.encode()).hexdigest()[:32]


def calculate_semantic_similarity(
    var_name: str,
    var_concept: str,
    table_name: str,
    table_desc: str,
    table_display: str
) -> float:
    """
    Calculate semantic similarity using word overlap (Jaccard similarity).
    
    This is a simple approach - for production, consider:
    - Word embeddings (Word2Vec, FastText)
    - Sentence transformers
    - TF-IDF with cosine similarity
    """
    # Normalize and tokenize
    var_words = set((var_name + " " + var_concept).lower().split())
    table_words = set((table_name + " " + table_desc + " " + table_display).lower().split())
    
    # Remove common Portuguese stopwords
    stopwords = {'de', 'da', 'do', 'e', 'para', 'com', 'em', 'a', 'o', 'os', 'as', 'um', 'uma'}
    var_words -= stopwords
    table_words -= stopwords
    
    if not var_words or not table_words:
        return 0.0
    
    # Jaccard similarity
    intersection = len(var_words & table_words)
    union = len(var_words | table_words)
    
    return intersection / union if union > 0 else 0.0


async def get_approval_rate(
    db: AsyncSession,
    concept_hash: str,
    table_id: int
) -> float:
    """
    Get historical approval rate for concept+table combination.
    Used to improve scoring based on past decisions.
    """
    result = await db.execute(
        select(ApprovalHistory).where(
            ApprovalHistory.concept_hash == concept_hash,
            ApprovalHistory.data_table_id == table_id
        )
    )
    history = result.scalars().first()
    
    if not history:
        return 0.5  # Neutral if no history
    
    return history.approval_rate


def calculate_keyword_match(var_name: str, table_keywords: List[str]) -> float:
    """
    Calculate keyword match score.
    Higher score if variable name contains or is contained in table keywords.
    """
    if not table_keywords:
        return 0.0
    
    var_name_lower = var_name.lower()
    matches = sum(
        1 for kw in table_keywords 
        if kw.lower() in var_name_lower or var_name_lower in kw.lower()
    )
    
    return min(1.0, matches / max(1, len(table_keywords)))


async def calculate_match_score(
    db: AsyncSession,
    variable_name: str,
    variable_type: str,
    variable_concept: str,
    table: DataTable,
    case_macro: str = None
) -> Tuple[float, str]:
    """
    Calculate comprehensive matching score between a variable and a table.
    
    Returns:
        Tuple of (score, reason_text)
    """
    scores = []
    reasons = []
    
    concept_hash = generate_concept_hash(variable_name, variable_type)
    
    # 1. Semantic similarity
    semantic_score = calculate_semantic_similarity(
        variable_name,
        variable_concept or "",
        table.name,
        table.description or "",
        table.display_name
    )
    scores.append(semantic_score * WEIGHT_SEMANTIC)
    if semantic_score > 0.5:
        reasons.append(f"Nome similar ({int(semantic_score*100)}%)")
    
    # 2. Historical approval rate
    history_score = await get_approval_rate(db, concept_hash, table.id)
    scores.append(history_score * WEIGHT_HISTORY)
    if history_score > 0.5:
        reasons.append(f"Histórico positivo ({int(history_score*100)}%)")
    
    # 3. Keyword matching
    keyword_score = calculate_keyword_match(
        variable_name,
        table.keywords or []
    )
    scores.append(keyword_score * WEIGHT_KEYWORD)
    if keyword_score > 0.5:
        reasons.append("Keywords compatíveis")
    
    # 4. Domain matching
    domain_score = 0.5  # Neutral default
    if case_macro and table.domain:
        if table.domain.lower() in case_macro.lower():
            domain_score = 1.0
            reasons.append("Mesmo domínio")
    scores.append(domain_score * WEIGHT_DOMAIN)
    
    total_score = sum(scores)
    reason_text = "; ".join(reasons) if reasons else "Match baseado em análise geral"
    
    return total_score, reason_text
