"""
RAG Retriever Module

Provides table retrieval using vector embeddings.
Supports both ChromaDB and PostgreSQL pgvector.
"""

from typing import Optional, Protocol
from abc import ABC, abstractmethod

from src.core.config import settings


class TableRetriever(Protocol):
    """Protocol for table retrieval."""
    
    async def search(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        max_results: int = 10
    ) -> list[dict]:
        """Search for tables matching the query."""
        ...
    
    async def index_table(self, table: dict) -> None:
        """Index a table in the vector store."""
        ...


class ChromaRetriever:
    """ChromaDB-based retriever for table search."""
    
    def __init__(self):
        self._client = None
        self._collection = None
        self._embeddings = None
    
    async def _ensure_initialized(self):
        """Lazy initialize ChromaDB client and embeddings."""
        if self._client is None:
            try:
                import chromadb
                from chromadb.config import Settings as ChromaSettings
                from sentence_transformers import SentenceTransformer
                
                self._client = chromadb.Client(ChromaSettings(
                    chroma_db_impl="duckdb+parquet",
                    persist_directory=settings.chroma_persist_dir,
                    anonymized_telemetry=False
                ))
                
                self._collection = self._client.get_or_create_collection(
                    name=settings.chroma_collection_name,
                    metadata={"hnsw:space": "cosine"}
                )
                
                self._embeddings = SentenceTransformer(settings.embedding_model)
                
            except ImportError as e:
                print(f"Warning: ChromaDB not available: {e}")
                raise
    
    async def search(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        max_results: int = 10
    ) -> list[dict]:
        """Search tables using embedding similarity."""
        await self._ensure_initialized()
        
        # Generate query embedding
        query_embedding = self._embeddings.encode(query).tolist()
        
        # Build filter
        where_filter = None
        if domain_filter:
            where_filter = {"domain": domain_filter}
        
        # Query collection
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=max_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )
        
        # Convert to table dicts
        tables = []
        if results and results["metadatas"]:
            for i, metadata in enumerate(results["metadatas"][0]):
                table = {
                    "id": metadata.get("id"),
                    "name": metadata.get("name"),
                    "display_name": metadata.get("display_name"),
                    "description": results["documents"][0][i] if results["documents"] else None,
                    "domain": metadata.get("domain"),
                    "schema_name": metadata.get("schema_name"),
                    "keywords": metadata.get("keywords", "").split(",") if metadata.get("keywords") else [],
                    "columns": [],  # Would need separate storage
                    "owner_id": metadata.get("owner_id"),
                    "owner_name": metadata.get("owner_name"),
                    "_distance": results["distances"][0][i] if results["distances"] else 1.0,
                }
                tables.append(table)
        
        return tables
    
    async def index_table(self, table: dict) -> None:
        """Index a table in ChromaDB."""
        await self._ensure_initialized()
        
        # Create document text for embedding
        doc_text = ' '.join(filter(None, [
            table.get("name", ""),
            table.get("display_name", ""),
            table.get("description", ""),
            ' '.join(table.get("keywords", [])),
        ]))
        
        # Create metadata
        metadata = {
            "id": table["id"],
            "name": table.get("name", ""),
            "display_name": table.get("display_name", ""),
            "domain": table.get("domain", ""),
            "schema_name": table.get("schema_name", ""),
            "keywords": ",".join(table.get("keywords", [])),
            "owner_id": table.get("owner_id"),
            "owner_name": table.get("owner_name", ""),
        }
        
        # Generate embedding
        embedding = self._embeddings.encode(doc_text).tolist()
        
        # Upsert to collection
        self._collection.upsert(
            ids=[str(table["id"])],
            embeddings=[embedding],
            documents=[doc_text],
            metadatas=[metadata]
        )


class MockRetriever:
    """Mock retriever for testing without vector database."""
    
    def __init__(self):
        self._tables = []
    
    async def search(
        self,
        query: str,
        domain_filter: Optional[str] = None,
        max_results: int = 10
    ) -> list[dict]:
        """Return mock results based on simple matching."""
        query_lower = query.lower()
        results = []
        
        for table in self._tables:
            text = ' '.join(filter(None, [
                table.get("name", ""),
                table.get("display_name", ""),
                table.get("description", ""),
            ])).lower()
            
            # Simple keyword matching
            if any(word in text for word in query_lower.split()):
                if domain_filter is None or table.get("domain") == domain_filter:
                    results.append(table)
        
        return results[:max_results]
    
    async def index_table(self, table: dict) -> None:
        """Add table to mock store."""
        # Remove existing with same ID
        self._tables = [t for t in self._tables if t.get("id") != table.get("id")]
        self._tables.append(table)


# Global retriever instance
_retriever: Optional[TableRetriever] = None


def get_retriever() -> TableRetriever:
    """Get or create the table retriever instance."""
    global _retriever
    
    if _retriever is None:
        try:
            _retriever = ChromaRetriever()
        except Exception as e:
            print(f"Warning: ChromaRetriever unavailable, using mock: {e}")
            _retriever = MockRetriever()
    
    return _retriever
