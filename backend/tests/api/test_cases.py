
import pytest
from httpx import AsyncClient
from app.main import app
from app.api import deps
from app.models.collaborator import Collaborator

# Mock user override
async def override_get_current_user_admin():
    return Collaborator(id=1, email="admin@example.com", role="ADMIN")

@pytest.fixture
def admin_client(client: AsyncClient):
    app.dependency_overrides[deps.get_current_user] = override_get_current_user_admin
    yield client
    app.dependency_overrides.pop(deps.get_current_user, None)

@pytest.mark.asyncio
async def test_create_case(admin_client: AsyncClient):
    response = await admin_client.post(
        "/api/v1/cases/",
        json={
            "title": "Test Case",
            "description": "A test case description",
            "variables": [
                {"variable_name": "Var1", "variable_type": "TEXT", "variable_value": "Val1", "is_required": True}
            ]
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Case"
    assert data["status"] == "DRAFT"
    assert len(data["variables"]) == 1

@pytest.mark.asyncio
async def test_read_cases(admin_client: AsyncClient):
    # Create a case first
    await admin_client.post(
        "/api/v1/cases/",
        json={"title": "Case 1", "description": "Desc 1"}
    )
    
    response = await admin_client.get("/api/v1/cases/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

@pytest.mark.asyncio
async def test_get_case_detail(admin_client: AsyncClient):
    create_res = await admin_client.post(
        "/api/v1/cases/",
        json={"title": "Detail Case", "description": "Desc"}
    )
    case_id = create_res.json()["id"]
    
    response = await admin_client.get(f"/api/v1/cases/{case_id}")
    assert response.status_code == 200
    assert response.json()["title"] == "Detail Case"

@pytest.mark.asyncio
async def test_update_case(admin_client: AsyncClient):
    create_res = await admin_client.post(
        "/api/v1/cases/",
        json={"title": "Update Case", "description": "Desc"}
    )
    case_id = create_res.json()["id"]
    
    response = await admin_client.patch(
        f"/api/v1/cases/{case_id}",
        json={"title": "Updated Title"}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"
