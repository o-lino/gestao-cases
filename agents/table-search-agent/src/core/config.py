"""
Core Configuration Module

Provides typed configuration from environment variables with sensible defaults.
"""

from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings
from pydantic import Field


class AgentSettings(BaseSettings):
    """Agent configuration settings."""
    
    # OpenAI
    openai_api_key: str = Field(default="", description="OpenAI API Key")
    openai_model: str = Field(default="gpt-4o-mini", description="OpenAI model to use")
    
    # Vector DB - ChromaDB
    chroma_persist_dir: str = Field(default="./data/chroma", description="ChromaDB persistence directory")
    chroma_collection_name: str = Field(default="table_catalog", description="ChromaDB collection name")
    
    # Vector DB - PostgreSQL
    postgres_host: str = Field(default="localhost")
    postgres_port: int = Field(default=5432)
    postgres_db: str = Field(default="table_search")
    postgres_user: str = Field(default="postgres")
    postgres_password: str = Field(default="postgres")
    
    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0")
    
    # API
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8001)
    api_debug: bool = Field(default=True)
    
    # Scoring Weights (deterministic)
    weight_semantic: float = Field(default=0.35, ge=0, le=1)
    weight_historical: float = Field(default=0.30, ge=0, le=1)
    weight_keyword: float = Field(default=0.15, ge=0, le=1)
    weight_domain: float = Field(default=0.10, ge=0, le=1)
    weight_freshness: float = Field(default=0.05, ge=0, le=1)
    weight_owner_trust: float = Field(default=0.05, ge=0, le=1)
    
    # Decision Thresholds
    auto_select_threshold: float = Field(default=0.90, ge=0, le=1)
    suggest_threshold: float = Field(default=0.70, ge=0, le=1)
    min_match_score: float = Field(default=0.30, ge=0, le=1)
    
    # Memory
    semantic_cache_ttl_hours: int = Field(default=24)
    history_lookback_days: int = Field(default=90)
    min_decisions_for_pattern: int = Field(default=3)
    
    # Embeddings
    embedding_model: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    
    # Integration
    gestao_cases_api_url: str = Field(default="http://localhost:8000")
    
    @property
    def postgres_dsn(self) -> str:
        """Generate PostgreSQL connection string."""
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
    
    @property
    def scoring_weights(self) -> dict[str, float]:
        """Get scoring weights as a dictionary."""
        return {
            "semantic": self.weight_semantic,
            "historical": self.weight_historical,
            "keyword": self.weight_keyword,
            "domain": self.weight_domain,
            "freshness": self.weight_freshness,
            "owner_trust": self.weight_owner_trust,
        }
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> AgentSettings:
    """Get cached settings instance."""
    return AgentSettings()


settings = get_settings()
