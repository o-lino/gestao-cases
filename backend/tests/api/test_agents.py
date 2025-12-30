"""
Tests for Agent API Endpoints

Tests the API endpoints for:
- Tools discovery
- Resources discovery
- Decision recording
- Consensus voting
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.agent_decision import DecisionType, DecisionStatus


@pytest.mark.asyncio
class TestAgentToolsEndpoint:
    """Tests for GET /agents/tools"""
    
    async def test_list_tools(self, client: AsyncClient):
        """Should return list of available tools"""
        response = await client.get("/api/v1/agents/tools")
        
        assert response.status_code == 200
        tools = response.json()
        
        assert isinstance(tools, list)
        assert len(tools) > 0
        
        # Check tool structure
        tool_names = [t["name"] for t in tools]
        assert "record_decision" in tool_names
        assert "find_reusable_decision" in tool_names
        
        # Verify tool has required fields
        record_tool = next(t for t in tools if t["name"] == "record_decision")
        assert "description" in record_tool
        assert "parameters" in record_tool
        assert "returns" in record_tool


@pytest.mark.asyncio
class TestAgentResourcesEndpoint:
    """Tests for GET /agents/resources"""
    
    async def test_list_resources(self, client: AsyncClient):
        """Should return list of available resources"""
        response = await client.get("/api/v1/agents/resources")
        
        assert response.status_code == 200
        resources = response.json()
        
        assert isinstance(resources, list)
        assert len(resources) > 0
        
        # Check resource structure
        resource_names = [r["name"] for r in resources]
        assert "cases" in resource_names
        assert "approval_history" in resource_names
        
        # Verify resource has required fields
        cases_resource = next(r for r in resources if r["name"] == "cases")
        assert "description" in cases_resource
        assert "uri_template" in cases_resource


@pytest.mark.asyncio
class TestAgentDecisionsEndpoint:
    """Tests for /agents/decisions endpoints"""
    
    async def test_record_decision_valid(self, client: AsyncClient):
        """Should record a valid decision"""
        response = await client.post(
            "/api/v1/agents/decisions",
            json={
                "agent_id": "test-agent",
                "decision_type": "VARIABLE_MATCH",
                "context_type": "variable_matching",
                "context_data": {
                    "domain": "vendas",
                    "concept": "faturamento"
                },
                "decision_value": {"matched_table_id": 123},
                "confidence_score": 0.85
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "status" in data
        assert data["is_reused"] is False
    
    async def test_record_decision_high_confidence_approved(self, client: AsyncClient):
        """High confidence decision should be auto-approved"""
        response = await client.post(
            "/api/v1/agents/decisions",
            json={
                "agent_id": "test-agent",
                "decision_type": "RISK_ASSESSMENT",
                "context_type": "risk",
                "context_data": {"domain": "finance"},
                "decision_value": {"risk_level": "low"},
                "confidence_score": 0.95  # Very high confidence
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "APPROVED"
    
    async def test_record_decision_low_confidence_consensus(self, client: AsyncClient):
        """Low confidence decision should require consensus"""
        response = await client.post(
            "/api/v1/agents/decisions",
            json={
                "agent_id": "test-agent",
                "decision_type": "CASE_CLASSIFICATION",
                "context_type": "classification",
                "context_data": {"domain": "unknown"},
                "decision_value": {"category": "other"},
                "confidence_score": 0.45  # Low confidence
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "CONSENSUS_REQUIRED"
        assert data["consensus_required"] is True
    
    async def test_record_decision_invalid_confidence(self, client: AsyncClient):
        """Should reject invalid confidence score"""
        response = await client.post(
            "/api/v1/agents/decisions",
            json={
                "agent_id": "test-agent",
                "decision_type": "VARIABLE_MATCH",
                "context_type": "test",
                "context_data": {},
                "decision_value": {},
                "confidence_score": 1.5  # Invalid: > 1.0
            }
        )
        
        assert response.status_code == 422  # Validation error
    
    async def test_record_decision_missing_fields(self, client: AsyncClient):
        """Should reject request with missing required fields"""
        response = await client.post(
            "/api/v1/agents/decisions",
            json={
                "agent_id": "test-agent"
                # Missing required fields
            }
        )
        
        assert response.status_code == 422


@pytest.mark.asyncio
class TestFindReusableDecisionEndpoint:
    """Tests for POST /agents/decisions/find-reusable"""
    
    async def test_find_reusable_no_history(self, client: AsyncClient):
        """Should return not found when no history exists"""
        response = await client.post(
            "/api/v1/agents/decisions/find-reusable",
            json={
                "context_type": "nonexistent",
                "context_data": {"domain": "unknown"}
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["found"] is False
        assert data["decision"] is None


@pytest.mark.asyncio
class TestPendingDecisionsEndpoint:
    """Tests for GET /agents/decisions/pending"""
    
    async def test_get_pending_decisions(self, client: AsyncClient):
        """Should return list of pending decisions"""
        response = await client.get("/api/v1/agents/decisions/pending")
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
    
    async def test_get_pending_decisions_with_filter(self, client: AsyncClient):
        """Should filter by decision type"""
        response = await client.get(
            "/api/v1/agents/decisions/pending",
            params={"decision_type": "VARIABLE_MATCH"}
        )
        
        assert response.status_code == 200


@pytest.mark.asyncio
class TestVoteEndpoint:
    """Tests for POST /agents/decisions/{id}/vote"""
    
    async def test_vote_decision_not_found(self, client: AsyncClient):
        """Should return error for non-existent decision"""
        response = await client.post(
            "/api/v1/agents/decisions/99999/vote",
            params={"voter_id": 1},
            json={"approve": True}
        )
        
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
class TestStatisticsEndpoint:
    """Tests for GET /agents/decisions/statistics"""
    
    async def test_get_statistics(self, client: AsyncClient):
        """Should return decision statistics"""
        response = await client.get("/api/v1/agents/decisions/statistics")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_decisions" in data
        assert "status_counts" in data
        assert "reused_count" in data
        assert "average_confidence" in data
        assert "reuse_rate" in data
    
    async def test_get_statistics_with_filter(self, client: AsyncClient):
        """Should filter statistics by context type"""
        response = await client.get(
            "/api/v1/agents/decisions/statistics",
            params={"context_type": "variable_matching"}
        )
        
        assert response.status_code == 200


@pytest.mark.asyncio
class TestDecisionHistoryEndpoint:
    """Tests for GET /agents/decisions/history"""
    
    async def test_get_history(self, client: AsyncClient):
        """Should return decision history"""
        response = await client.get(
            "/api/v1/agents/decisions/history",
            params={"context_type": "variable_matching"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "context_type" in data
        assert "decisions" in data
        assert isinstance(data["decisions"], list)
