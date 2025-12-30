# Table Search Agent

LangGraph-based intelligent agent for table search and matching in data catalogs.

## Features

- **LangGraph State Machine**: Deterministic workflow for table search
- **RAG System**: Semantic search using ChromaDB and PostgreSQL pgvector
- **Memory Systems**: Short-term (session) and long-term (historical decisions)
- **Deterministic Scoring**: Weighted scoring algorithm for consistent recommendations
- **API Layer**: FastAPI REST endpoints for integration

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Copy environment file
cp .env.example .env

# Start with Docker
docker-compose up -d

# Or run locally
uvicorn src.api.main:app --reload
```

## Project Structure

```
src/
├── agent/           # LangGraph agent core
│   ├── nodes/       # Processing nodes
│   ├── rag/         # RAG retrieval system
│   ├── memory/      # Memory systems
│   └── tools/       # Agent tools
├── api/             # FastAPI endpoints
└── core/            # Configuration and utilities
```

## API Endpoints

- `POST /api/v1/search` - Search for matching tables
- `POST /api/v1/feedback` - Record decision feedback
- `POST /api/v1/sync/catalog` - Sync table catalog
- `GET /api/v1/health` - Health check

## Integration

This agent integrates with gestao-cases-2.0 via REST API.
