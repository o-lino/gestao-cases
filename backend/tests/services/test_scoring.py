"""
Matching Scoring Tests

Tests for the scoring algorithms in the matching service.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock

from app.services.matching.scoring import (
    generate_concept_hash,
    calculate_semantic_similarity,
    calculate_keyword_match,
    MIN_MATCH_SCORE,
    WEIGHT_SEMANTIC,
    WEIGHT_HISTORY,
    WEIGHT_KEYWORD,
    WEIGHT_DOMAIN,
)


class TestConceptHash:
    """Tests for concept hash generation"""
    
    def test_generate_concept_hash_basic(self):
        """Test basic hash generation"""
        hash1 = generate_concept_hash("revenue", "currency")
        assert len(hash1) == 32
        assert hash1.isalnum()
    
    def test_generate_concept_hash_deterministic(self):
        """Test that same inputs produce same hash"""
        hash1 = generate_concept_hash("revenue", "currency")
        hash2 = generate_concept_hash("revenue", "currency")
        assert hash1 == hash2
    
    def test_generate_concept_hash_case_insensitive(self):
        """Test that hash is case insensitive"""
        hash1 = generate_concept_hash("Revenue", "Currency")
        hash2 = generate_concept_hash("revenue", "currency")
        assert hash1 == hash2
    
    def test_generate_concept_hash_different_inputs(self):
        """Test that different inputs produce different hashes"""
        hash1 = generate_concept_hash("revenue", "currency")
        hash2 = generate_concept_hash("expense", "currency")
        assert hash1 != hash2


class TestSemanticSimilarity:
    """Tests for semantic similarity calculation"""
    
    def test_identical_strings(self):
        """Test similarity of identical strings"""
        score = calculate_semantic_similarity(
            "revenue total", "",
            "revenue total", "", ""
        )
        assert score == 1.0
    
    def test_completely_different_strings(self):
        """Test similarity of completely different strings"""
        score = calculate_semantic_similarity(
            "apple orange", "",
            "banana grape", "", ""
        )
        assert score == 0.0
    
    def test_partial_overlap(self):
        """Test similarity with partial word overlap"""
        score = calculate_semantic_similarity(
            "total revenue annual", "",
            "revenue yearly", "", ""
        )
        # Should have some overlap due to "revenue"
        assert 0.0 < score < 1.0
    
    def test_stopwords_removed(self):
        """Test that Portuguese stopwords are removed"""
        # "de", "da", "do" should be removed
        score1 = calculate_semantic_similarity(
            "receita de vendas", "",
            "receita da vendas", "", ""
        )
        score2 = calculate_semantic_similarity(
            "receita vendas", "",
            "receita vendas", "", ""
        )
        # Both should be similar since stopwords are removed
        assert score1 == score2
    
    def test_empty_input(self):
        """Test with empty inputs"""
        score = calculate_semantic_similarity("", "", "", "", "")
        assert score == 0.0


class TestKeywordMatch:
    """Tests for keyword matching"""
    
    def test_exact_keyword_match(self):
        """Test when variable name matches keyword exactly"""
        score = calculate_keyword_match("revenue", ["revenue", "sales"])
        assert score > 0.0
    
    def test_partial_keyword_match(self):
        """Test when variable name contains keyword"""
        score = calculate_keyword_match("total_revenue", ["revenue"])
        assert score > 0.0
    
    def test_no_keyword_match(self):
        """Test when no keywords match"""
        score = calculate_keyword_match("expense", ["revenue", "sales"])
        assert score == 0.0
    
    def test_empty_keywords(self):
        """Test with empty keyword list"""
        score = calculate_keyword_match("revenue", [])
        assert score == 0.0
    
    def test_multiple_matches(self):
        """Test with multiple keyword matches"""
        score = calculate_keyword_match(
            "revenue_sales_total", 
            ["revenue", "sales", "total"]
        )
        assert score == 1.0  # All keywords match


class TestScoringConstants:
    """Tests for scoring constants"""
    
    def test_weights_sum_to_one(self):
        """Test that all weights sum to 1.0"""
        total = WEIGHT_SEMANTIC + WEIGHT_HISTORY + WEIGHT_KEYWORD + WEIGHT_DOMAIN
        assert abs(total - 1.0) < 0.001
    
    def test_min_score_reasonable(self):
        """Test that minimum score is reasonable"""
        assert 0.0 < MIN_MATCH_SCORE < 0.5
