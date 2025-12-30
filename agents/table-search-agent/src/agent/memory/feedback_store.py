"""
Feedback Store

Persistent storage for decision history.
Enables learning from past approvals/rejections.
"""

from typing import Optional, Literal
from datetime import datetime
from dataclasses import dataclass
import hashlib
import asyncio


@dataclass
class DecisionRecord:
    """A single decision record."""
    id: Optional[int] = None
    request_id: str = ""
    concept_hash: str = ""          # Hash of normalized intent
    
    # What was recommended
    domain_id: Optional[str] = None
    owner_id: Optional[int] = None
    table_id: Optional[int] = None
    
    # Outcome
    outcome: Literal["APPROVED", "REJECTED", "MODIFIED"] = "APPROVED"
    actual_table_id: Optional[int] = None  # If MODIFIED
    
    # Context
    confidence_at_decision: float = 0.0
    use_case: str = "default"
    
    created_at: Optional[datetime] = None


class FeedbackStore:
    """
    Store and query decision history.
    
    Uses PostgreSQL in production, in-memory for development.
    """
    
    def __init__(self, use_postgres: bool = False, connection_string: str = None):
        self.use_postgres = use_postgres
        self.connection_string = connection_string
        
        # In-memory storage (development)
        self._memory_store: dict[str, list[DecisionRecord]] = {}
        
        # Aggregated scores cache
        self._score_cache: dict[str, float] = {}
        self._cache_ttl_minutes = 5
        self._cache_updated: dict[str, datetime] = {}
    
    async def record_decision(self, record: DecisionRecord) -> int:
        """
        Record a decision outcome.
        
        Returns the record ID.
        """
        record.created_at = datetime.utcnow()
        
        if self.use_postgres:
            return await self._insert_postgres(record)
        
        return self._insert_memory(record)
    
    def _insert_memory(self, record: DecisionRecord) -> int:
        """Insert into in-memory store."""
        key = f"{record.concept_hash}:{record.table_id}"
        
        if key not in self._memory_store:
            self._memory_store[key] = []
        
        record.id = len(self._memory_store[key]) + 1
        self._memory_store[key].append(record)
        
        # Invalidate cache
        self._invalidate_cache(key)
        
        return record.id
    
    async def _insert_postgres(self, record: DecisionRecord) -> int:
        """Insert into PostgreSQL."""
        # TODO: Implement with asyncpg
        # query = """
        #     INSERT INTO decision_history 
        #     (request_id, concept_hash, domain_id, owner_id, table_id, 
        #      outcome, actual_table_id, confidence_at_decision, use_case)
        #     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        #     RETURNING id
        # """
        raise NotImplementedError("PostgreSQL not configured")
    
    async def get_historical_score(
        self, 
        concept_hash: str, 
        table_id: int,
        min_samples: int = 3,
    ) -> tuple[float, int]:
        """
        Get historical approval rate for a concept+table pair.
        
        Returns:
            (score, sample_count) - Score 0-1, count of samples
        """
        cache_key = f"{concept_hash}:{table_id}"
        
        # Check cache
        if self._is_cache_valid(cache_key):
            cached = self._score_cache.get(cache_key, 0.5)
            return cached, -1  # -1 indicates cached
        
        if self.use_postgres:
            return await self._query_postgres(concept_hash, table_id, min_samples)
        
        return self._query_memory(concept_hash, table_id, min_samples)
    
    def _query_memory(
        self, 
        concept_hash: str, 
        table_id: int,
        min_samples: int,
    ) -> tuple[float, int]:
        """Query in-memory store."""
        key = f"{concept_hash}:{table_id}"
        records = self._memory_store.get(key, [])
        
        if len(records) < min_samples:
            return 0.5, len(records)  # Default neutral
        
        approved = sum(1 for r in records if r.outcome == "APPROVED")
        total = len(records)
        score = approved / total
        
        # Cache result
        self._score_cache[key] = score
        self._cache_updated[key] = datetime.utcnow()
        
        return score, total
    
    async def _query_postgres(
        self, 
        concept_hash: str, 
        table_id: int,
        min_samples: int,
    ) -> tuple[float, int]:
        """Query PostgreSQL."""
        # TODO: Implement with asyncpg
        raise NotImplementedError("PostgreSQL not configured")
    
    async def get_top_tables_for_concept(
        self, 
        concept_hash: str, 
        limit: int = 5,
    ) -> list[tuple[int, float, int]]:
        """
        Get top tables historically approved for a concept.
        
        Returns:
            List of (table_id, approval_rate, sample_count)
        """
        if self.use_postgres:
            return await self._get_top_postgres(concept_hash, limit)
        
        return self._get_top_memory(concept_hash, limit)
    
    def _get_top_memory(
        self, 
        concept_hash: str, 
        limit: int,
    ) -> list[tuple[int, float, int]]:
        """Get top tables from memory."""
        # Find all keys matching concept
        matching = {}
        for key, records in self._memory_store.items():
            if key.startswith(f"{concept_hash}:"):
                table_id = int(key.split(":")[1])
                approved = sum(1 for r in records if r.outcome == "APPROVED")
                total = len(records)
                if total >= 3:
                    matching[table_id] = (approved / total, total)
        
        # Sort by approval rate
        sorted_tables = sorted(
            matching.items(), 
            key=lambda x: (x[1][0], x[1][1]),  # rate, then count
            reverse=True
        )
        
        return [(t_id, rate, cnt) for t_id, (rate, cnt) in sorted_tables[:limit]]
    
    def _invalidate_cache(self, key: str) -> None:
        """Invalidate cache for a key."""
        self._score_cache.pop(key, None)
        self._cache_updated.pop(key, None)
    
    def _is_cache_valid(self, key: str) -> bool:
        """Check if cache is still valid."""
        if key not in self._cache_updated:
            return False
        
        age = (datetime.utcnow() - self._cache_updated[key]).total_seconds() / 60
        return age < self._cache_ttl_minutes
    
    @property
    def stats(self) -> dict:
        """Get store statistics."""
        total_records = sum(len(r) for r in self._memory_store.values())
        unique_concepts = len(set(k.split(":")[0] for k in self._memory_store.keys()))
        
        return {
            "total_records": total_records,
            "unique_concepts": unique_concepts,
            "unique_pairs": len(self._memory_store),
            "cache_size": len(self._score_cache),
            "storage": "postgres" if self.use_postgres else "memory",
        }


def generate_concept_hash(intent_data: dict) -> str:
    """
    Generate hash from normalized intent.
    
    Similar intents should produce the same hash.
    """
    # Key fields for hashing
    key_parts = [
        intent_data.get("data_need", ""),
        intent_data.get("target_entity", ""),
        intent_data.get("target_product", ""),
        intent_data.get("target_segment", ""),
        intent_data.get("granularity", ""),
    ]
    
    # Sort and join
    normalized = "|".join(sorted(filter(None, key_parts))).lower()
    
    return hashlib.sha256(normalized.encode()).hexdigest()[:16]


# Global instance
_feedback_store: Optional[FeedbackStore] = None


def get_feedback_store(use_postgres: bool = False) -> FeedbackStore:
    """Get or create feedback store."""
    global _feedback_store
    if _feedback_store is None:
        _feedback_store = FeedbackStore(use_postgres=use_postgres)
    return _feedback_store
