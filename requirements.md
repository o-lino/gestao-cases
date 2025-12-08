# Especificação Técnica Completa: Sistema de Gestão de Cases (Modernizado) v2.0

> **Versão:** 2.1 (Agent-Ready Specification)
> **Data:** 26/11/2025
> **Status:** Aprovado para Implementação

Este documento consolida todas as especificações técnicas, requisitos de negócio, modelagem de dados e arquitetura para o desenvolvimento do Sistema de Gestão de Cases. Ele serve como a "Fonte da Verdade" única para o Agente de IA e desenvolvedores.

---

## 1. Visão Geral e Objetivos

**Sistema de Gestão de Cases** é uma plataforma corporativa destinada a centralizar, padronizar e acelerar o ciclo de vida de iniciativas de consultoria ("Cases"). O sistema substitui processos manuais e fragmentados por um fluxo de trabalho digital, auditável e enriquecido por Inteligência Artificial.

### 1.1 Objetivos Técnicos

1.  **Eliminar Débito Técnico:** Substituir planilhas e scripts legados por uma arquitetura robusta baseada em microsserviços/monolito modular.
2.  **Escalabilidade:** Suportar crescimento de dados e usuários sem degradação de performance (SLA < 200ms).
3.  **Segurança:** Implementar RBAC granular e trilhas de auditoria completas (LGPD/GDPR compliant).
4.  **Inteligência:** Integrar LLMs para automação de tarefas cognitivas (resumo, classificação, geração de conteúdo).

---

## 2. Arquitetura de Solução

### 2.1 Visão Geral (C4 Model - Container Level)

O sistema opera sobre uma arquitetura de três camadas (3-tier) containerizada, hospedada em ambiente Cloud (AWS).

1.  **Frontend (SPA):** React 18 + TypeScript + Vite. Responsável pela interação do usuário.
2.  **Backend (API):** FastAPI (Python 3.11). Responsável pela lógica de negócio, orquestração de IA e persistência.
3.  **Database:** PostgreSQL 15. Responsável pelo armazenamento relacional e documentos (JSONB).
4.  **AI Gateway:** Módulo interno do backend que gerencia a comunicação com provedores de LLM (IaraGenAI, Bedrock).

### 2.2 Stack Tecnológico Detalhado

| Camada             | Tecnologia  | Versão | Justificativa                                       |
| :----------------- | :---------- | :----- | :-------------------------------------------------- |
| **Linguagem**      | Python      | 3.11+  | Ecossistema rico para IA e Backend.                 |
| **Framework Web**  | FastAPI     | 0.100+ | Alta performance (ASGI), validação Pydantic nativa. |
| **ORM**            | SQLAlchemy  | 2.0+   | Suporte a AsyncIO, mapeamento robusto.              |
| **Migrations**     | Alembic     | Latest | Controle de versão do schema do banco.              |
| **Frontend**       | React       | 18.2+  | Padrão de mercado, ecossistema de componentes.      |
| **Estilização**    | TailwindCSS | 3.3+   | Produtividade e consistência visual.                |
| **UI Lib**         | Shadcn/ui   | Latest | Componentes acessíveis e customizáveis.             |
| **Banco de Dados** | PostgreSQL  | 15+    | Robustez, suporte a JSONB para dados flexíveis.     |
| **Container**      | Docker      | Latest | Portabilidade e consistência de ambiente.           |

---

## Modelagem de Dados (Database Schema)

O banco de dados utiliza uma abordagem híbrida: Relacional para entidades estruturadas (Users, Cases Core) e NoSQL (JSONB) para dados flexíveis (Variáveis de Cases, Configurações).

### Diagrama Entidade-Relacionamento (Texto)

**Collaborators** (1) <--- (N) **Cases**
**Cases** (1) <--- (N) **CaseVariables**
**Cases** (1) <--- (N) **CaseHistory** (Audit)
**Cases** (1) <--- (N) **Comments**
**Cases** (1) <--- (N) **Attachments**

### Definições DDL (SQL)

#### Tabela: `collaborators`

Tabela de usuários do sistema. Sincronizado via AD ou criado localmente.

```sql
create table collaborators (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'USER', -- Enum: ADMIN, MANAGER, USER
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

create index idx_collaborators_email ON collaborators(email);
```

#### Tabela: `cases`

Tabela central. Contém os metadados fixos do projeto.

````sql
```sql
create table cases (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- Enum: DRAFT, SUBMITTED, REVIEW, APPROVED, REJECTED, CLOSED
  created_by INTEGER REFERENCES collaborators(id),
  assigned_to_id INTEGER REFERENCES collaborators(id),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(15, 2),

  -- Controle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1
);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_author ON cases(created_by);
````

#### Tabela: `case_variables`

Armazena dados dinâmicos do case (ex: campos customizados por tipo de projeto).

```sql
CREATE TABLE case_variables (
  id SERIAL PRIMARY KEY,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  variable_name VARCHAR(100) NOT NULL,
  variable_value JSONB NOT NULL, -- Pode ser string, int, array, obj
  variable_type VARCHAR(50) NOT NULL, -- Enum: TEXT, NUMBER, DATE, SELECT
  is_required BOOLEAN DEFAULT FALSE
);
CREATE UNIQUE INDEX idx_case_var_unique ON case_variables(case_id, variable_name);
```

#### Tabela: `audit_logs` (Case History)

Trilha de auditoria imutável.

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- ex: CASE, COLLABORATOR
  entity_id INTEGER NOT NULL,
  actor_id INTEGER REFERENCES collaborators(id),
  action_type VARCHAR(50) NOT NULL, -- ex: CREATE, UPDATE, TRANSITION
  changes JSONB NOT NULL, -- { "field": { "old": "A", "new": "B" } }
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2.5 Migração Alembic (Exemplo)

Para garantir que o campo JSONB seja criado corretamente, o script de migração deve ser explícito.

```python
# alembic/versions/xxxx_create_cases_table.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

def upgrade():
    op.create_table(
        'case_variables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=True),
        sa.Column('variable_name', sa.String(length=100), nullable=False),
        sa.Column('variable_value', JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('variable_type', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # Criar indice GIN para performance em queries JSON
    op.create_index('idx_case_variables_value', 'case_variables', ['variable_value'], postgresql_using='gin')

def downgrade():
    op.drop_index('idx_case_variables_value', table_name='case_variables')
    op.drop_table('case_variables')
```

### 3.2.6 Padrões de Consulta JSONB (Performance)

Para buscar cases baseados em campos dinâmicos, utilizar operadores nativos do PostgreSQL.

Exemplo: Buscar cases onde a variável "departamento" é "TI"

```sql
-- Query SQL Pura
SELECT * FROM cases c
JOIN case_variables cv ON c.id = cv.case_id
WHERE cv.variable_name = 'departamento'
AND cv.variable_value->>'value' = 'TI';
```

Exemplo: SQLAlchemy Core

```python
# python
stmt = select(Case).join(CaseVariable).where(
    and_(
        CaseVariable.variable_name == 'departamento',
        CaseVariable.variable_value.op('->>')('value') == 'TI'
    )
)
```

### 3.2.7 Estratégia de Indexação e Performance

Para garantir a escalabilidade do modelo híbrido, a estratégia de índices deve ser agressiva.

1.  **Índices B-Tree Padrão:**

    - Chaves Primárias (`id`) e Estrangeiras (`case_id`, `author_id`).
    - Campos de filtro frequente: `status`, `created_at`, `email`.

2.  **Índices GIN (Generalized Inverted Index):**

    - Crucial para o campo `variable_value` (JSONB). Permite buscas eficientes dentro da estrutura JSON (ex: `@>`, `?`, `?&`).
    - `CREATE INDEX idx_case_vars_gin ON case_variables USING GIN (variable_value);`

3.  **Particionamento (Futuro):**
    - Considerar particionamento da tabela `audit_logs` por intervalo de data (`RANGE PARTITION`) se o volume exceder 10 milhões de linhas/ano.

### 3.3 Data Seeding & Fixtures

Para facilitar o desenvolvimento e testes, criar scripts que populam o banco com dados iniciais.

```python
# scripts/seed_data.py
def seed_users(db: Session):
    if not db.query(Collaborator).filter_by(email="admin@company.com").first():
        admin = Collaborator(
            email="admin@company.com",
            full_name="Admin User",
            role="ADMIN",
            is_active=True
        )
        db.add(admin)
        db.commit()

def seed_variables_config(db: Session):
    # Configuração inicial de variáveis possíveis (se houver tabela de meta-config)
    pass
```

### 3.4 Manutenção de Banco de Dados

Rotinas essenciais para saúde do PostgreSQL em produção.

- **Vacuuming:** O uso intensivo de `UPDATE` em JSONB gera "bloat". Configurar autovacuum agressivo para a tabela `case_variables`.
  ```sql
  ALTER TABLE case_variables SET (autovacuum_vacuum_scale_factor = 0.05);
  ```
- **Reindex:** Recriar índices GIN mensalmente para evitar degradação de performance.
  ```sql
  REINDEX INDEX CONCURRENTLY idx_case_vars_gin;
  ```

---

## 4. Especificação do Backend (FastAPI)

### 4.1 Estrutura do Projeto

A estrutura segue o padrão "Domain-Driven Design" simplificado para FastAPI.

```
backend/app/
├── api/
│   └── v1/
│       ├── endpoints/
│       │   ├── cases.py        # CRUD e Actions de Cases
│       │   ├── analytics.py    # Dashboards
│       │   └── auth.py         # Login/Refresh
│       └── router.py           # Agregador de rotas
├── core/
│   ├── config.py               # Pydantic Settings
│   ├── security.py             # JWT Handler
│   └── exceptions.py           # Custom Exceptions
├── models/                     # SQLAlchemy Models
├── schemas/                    # Pydantic Schemas (Request/Response)
├── services/
│   ├── workflow_engine.py      # Máquina de Estados
│   ├── ai_service.py           # Integração LLM
│   └── notification_service.py # Email/Teams
└── main.py                     # App Entrypoint
```

### 4.2 Contratos de API (Schemas Pydantic)

Para garantir a validação rigorosa dos dados, os seguintes schemas devem ser implementados em `backend/app/schemas/case.py`.

````python
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import date, datetime
from enum import Enum

class CaseStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    REVIEW = "REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"

class CaseBase(BaseModel):
    title: str = Field(..., min_length=5, max_length=255, description="Título descritivo do case")
    description: Optional[str] = Field(None, description="Detalhamento do escopo")
    client_name: Optional[str] = Field(None, max_length=255)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = Field(None, ge=0)
    variables: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Campos customizados flexíveis")

    @validator('end_date')
    def end_date_must_be_after_start_date(cls, v, values):
        if 'start_date' in values and v and values['start_date'] and v < values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v

class CaseCreateSchema(CaseBase):
    pass

class CaseUpdateSchema(CaseBase):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    # Todos os campos opcionais para PATCH

class CaseResponseSchema(CaseBase):
    id: int
    status: CaseStatus
    author_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

### 4.4 Definição da Máquina de Estados (Workflow)

A lógica de transição deve ser rígida. O sistema deve validar `current_status` -> `target_status` baseado na role do usuário.

| Estado Atual | Estado Destino | Role Necessária | Ações Automáticas (Side-effects) |
| :--- | :--- | :--- | :--- |
| `DRAFT` | `SUBMITTED` | USER, MANAGER | Notificar Manager; Validar campos obrigatórios. |
| `SUBMITTED` | `REVIEW` | MANAGER | Atribuir revisor; Notificar solicitante. |
| `REVIEW` | `APPROVED` | MANAGER | Gerar documento de aprovação; Notificar todos. |
| `REVIEW` | `REJECTED` | MANAGER | Solicitar motivo obrigatório; Notificar solicitante. |
| `REJECTED` | `DRAFT` | USER | Permitir edição para ressubmissão. |
| `APPROVED` | `CLOSED` | ADMIN, MANAGER | Arquivar case. |

**Regra de Imutabilidade:** Cases em estado `APPROVED` ou `CLOSED` tornam-se *read-only*, exceto por usuários ADMIN.

### 4.5 Middleware de Autenticação (Dependência)

Para proteger rotas, utilizar o sistema de injeção de dependência do FastAPI.

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.core.config import settings
from app.schemas.token import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        roles: list = payload.get("roles", [])
        if username is None:
            raise credentials_exception
        return TokenData(username=username, roles=roles)
    except JWTError:
        raise credentials_exception

def role_required(required_roles: list[str]):
    def role_checker(current_user: TokenData = Depends(get_current_user)):
        if not any(role in current_user.roles for role in required_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker
````

### 4.6 Validação de Variáveis Dinâmicas (Service Layer)

Como `case_variables` armazena JSONB, a validação deve ocorrer na camada de serviço antes da persistência.

```python
def validate_variable_value(var_type: str, value: Any) -> bool:
    """
    Valida se o valor corresponde ao tipo declarado.
    """
    try:
        if var_type == 'NUMBER':
            float(value)
        elif var_type == 'DATE':
            datetime.strptime(str(value), '%Y-%m-%d')
        elif var_type == 'BOOLEAN':
            if str(value).lower() not in ['true', 'false', '1', '0']:
                raise ValueError
        # TEXT e SELECT são strings simples
        return True
    except ValueError:
        return False

def process_case_variables(case_id: int, variables: dict, db: Session):
    for name, value in variables.items():
        # Buscar definição do tipo (poderia vir de uma tabela de metadados)
        # Aqui assumimos um padrão ou inferência
        var_type = infer_type(value)

        if not validate_variable_value(var_type, value):
            raise HTTPException(status_code=400, detail=f"Invalid format for {name}")

        db_var = CaseVariable(
            case_id=case_id,
            variable_name=name,
            variable_value=value,
            variable_type=var_type
        )
        db.add(db_var)
```

### 4.7 Observabilidade e Logging Estruturado

O sistema deve implementar logging estruturado (JSON) e tracing distribuído para facilitar o debug por agentes de IA e humanos.

#### 4.7.1 Configuração de Logger (Loguru/Structlog)

```python
import sys
from loguru import logger

# Configuração para saída em JSON (Ideal para Datadog/CloudWatch)
logger.remove()
logger.add(sys.stdout, serialize=True, format="{time} {level} {message}")

def log_case_action(case_id: int, action: str, user_id: int, details: dict = None):
    logger.info("Case Action Performed", extra={
        "event.category": "business",
        "case.id": case_id,
        "user.id": user_id,
        "action": action,
        "details": details or {}
    })
```

#### 4.7.2 Tracing (OpenTelemetry)

Instrumentação automática do FastAPI e SQLAlchemy.

```python
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

# No startup do app
FastAPIInstrumentor.instrument_app(app)
SQLAlchemyInstrumentor().instrument(engine=engine)
```

### 4.8 Gerenciamento de Arquivos (Blob Storage)

O sistema não deve armazenar arquivos no banco de dados. Utilizar Object Storage (AWS S3).

#### 4.8.1 Estratégia de Upload Seguro (Presigned URLs)

Para evitar sobrecarga na API, o upload deve ser feito diretamente do Frontend para o Storage, usando URLs pré-assinadas geradas pelo Backend.

1.  **Frontend** solicita URL de upload para `POST /api/v1/files/upload-url`.
2.  **Backend** gera URL assinada (válida por 5 min) e retorna.
3.  **Frontend** faz `PUT` do arquivo binário para a URL assinada.
4.  **Frontend** confirma o upload para o Backend, que salva a referência (Key/Path) no banco.

```python
# backend/app/services/storage.py
class StorageService:
    def generate_presigned_url(self, file_key: str, expiration=300) -> str:
        """
        Gera URL temporária para upload ou download seguro.
        Abstrai boto3 (AWS).
        """
        pass
```

### 4.9 Serviço de Notificações (Adapter Pattern)

O sistema deve suportar múltiplos canais de notificação, desacoplados da lógica de negócio.

```python
# backend/app/services/notifications/interfaces.py
class NotificationAdapter(ABC):
    @abstractmethod
    async def send(self, recipient: str, subject: str, content: str):
        pass

# backend/app/services/notifications/service.py
class NotificationService:
    def __init__(self):
        self.email_adapter = EmailAdapter()
        self.teams_adapter = TeamsAdapter()

    async def notify_case_approval(self, case: Case, approver: User):
        subject = f"Case Aprovado: {case.title}"
        content = render_template("case_approved.html", case=case, approver=approver)

        # Envia em paralelo
        await asyncio.gather(
            self.email_adapter.send(case.author.email, subject, content),
            self.teams_adapter.send(case.author.teams_id, subject, content)
        )
```

### 4.10 Estratégia de Cache (Redis)

Para garantir a performance de leitura (< 200ms), implementar cache na camada de serviço ("Cache-Aside").

```python
# backend/app/core/cache.py
import redis.asyncio as redis
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

def cache_key(namespace: str, *args):
    return f"{namespace}:{':'.join(str(arg) for arg in args)}"
```

#### POST /api/v1/cases

Cria um novo case.

- **Request Body:** `CaseCreateSchema`
- **Response:** `CaseResponseSchema` (201 Created)

#### POST /api/v1/cases/{id}/transition

Executa uma transição de estado no workflow.

- **Request Body:**
  - `target_status`: string (Enum)
  - `comment`: string (Reason for transition)
- **Logic:**
  1.  Verifica se a transição é válida (State Machine).
  2.  Verifica permissões do usuário (Policy Check).
  3.  Atualiza status no DB.
  4.  Grava log em `audit_logs`.
  5.  Dispara notificações (Side-effect).

### 4.3 Padrão de Resposta de Erro (RFC 7807)

Todas as APIs devem retornar erros seguindo o padrão "Problem Details for HTTP APIs".

````json
{
  "type": "about:blank",
  "title": "Business Rule Violation",
  "status": 422,
  "detail": "Transition from DRAFT to APPROVED is not allowed.",
  "instance": "/api/v1/cases/123/transition",
  "code": "INVALID_TRANSITION" // Código interno para frontend
### 4.11 Rate Limiting

Proteção contra abuso e DoS na camada de API.

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

@app.on_event("startup")
async def startup():
    await FastAPILimiter.init(redis_client)

# Exemplo: Limitar criação de cases a 5 por minuto por usuário
@router.post("/cases", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
async def create_case(...):
    ...
````

### 4.12 Documentação da API (OpenAPI/Swagger)

A documentação viva é essencial. O FastAPI gera o `openapi.json` automaticamente, mas deve ser customizado.

```python
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Gestão de Cases API",
        version="2.1.0",
        description="API para gestão do ciclo de vida de projetos de consultoria.",
        routes=app.routes,
    )
    # Adicionar esquemas de segurança globais
    openapi_schema["components"]["securitySchemes"] = {
        "OAuth2PasswordBearer": {
            "type": "oauth2",
            "flows": {
                "password": {
                    "tokenUrl": "token",
                    "scopes": {}
                }
            }
        }
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi
```

### 4.13 Event Bus (Domain Events)

Para desacoplar efeitos colaterais (notificações, logs, webhooks), utilizar um barramento de eventos interno.

```python
# backend/app/core/events.py
from typing import Callable, List

class EventBus:
    def __init__(self):
        self.subscribers: dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(handler)

    async def publish(self, event_type: str, payload: dict):
        if event_type in self.subscribers:
            for handler in self.subscribers[event_type]:
                await handler(payload)

event_bus = EventBus()

# Uso
# event_bus.subscribe("case_approved", send_email_notification)
# await event_bus.publish("case_approved", {"case_id": 1})
```

### 4.14 Padrão de Paginação

Para listas grandes, a API deve suportar paginação baseada em `limit` e `offset` (ou cursor para performance extrema).

**Request:** `GET /cases?limit=20&offset=0`

**Response Standard:**

```json
{
  "items": [ ... ],
  "total": 150,
  "page": 1,
  "size": 20,
  "pages": 8
}
```

```python
# backend/app/schemas/common.py
from typing import Generic, TypeVar, List
from pydantic.generics import GenericModel

T = TypeVar("T")

class Page(GenericModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int
```

### 4.15 Health Checks (K8s Probes)

Endpoints leves para monitoramento de disponibilidade.

```python
@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok"}

@app.get("/health/deep", tags=["System"])
async def deep_health_check(db: Session = Depends(get_db)):
    try:
        # Verifica DB
        db.execute("SELECT 1")
        # Verifica Redis
        await redis_client.ping()
        return {"status": "ok", "db": "connected", "redis": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
```

### 4.16 Connection Pooling (SQLAlchemy)

Para suportar alta concorrência em produção, a configuração do pool de conexões deve ser ajustada para evitar "pool exhaustion".

```python
# backend/app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,   # Verifica conexão antes de usar
    pool_size=20,         # Conexões mantidas abertas
    max_overflow=10,      # Conexões extras permitidas em picos
    pool_recycle=3600,    # Recicla conexões a cada 1h
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession
)
```

### 4.17 Processamento Assíncrono (Celery)

Tarefas pesadas (geração de IA, envio de emails em massa, processamento de PDFs) não devem bloquear o loop de eventos do FastAPI.

**Stack:** Celery + Redis (Broker & Backend).

```python
# backend/app/worker.py
from celery import Celery
from app.core.config import settings

celery_app = Celery("worker", broker=settings.REDIS_URL)
celery_app.conf.task_routes = {"app.tasks.*": "main-queue"}

# backend/app/tasks/ai_tasks.py
@celery_app.task(acks_late=True)
def generate_case_summary_task(case_id: int):
    # 1. Buscar dados do case no DB
    # 2. Chamar AI Service (síncrono dentro da task)
    # 3. Salvar resultado no DB
    # 4. Notificar via WebSocket/EventBus
    pass
```

### 4.18 WebSockets (Notificações em Tempo Real)

Para atualizações instantâneas de status e notificações sem polling.

```python
# backend/app/api/v1/endpoints/websockets.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.connection_manager import manager

router = APIRouter()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Processar mensagens do cliente se necessário
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

# Uso no Service de Notificação
async def notify_user(user_id: int, message: dict):
```

    await manager.send_personal_message(message, user_id)

````

### 4.19 Estratégia de Backup e Disaster Recovery

Garantia de continuidade de negócios (RPO < 1h, RTO < 4h).

1.  **Banco de Dados (PostgreSQL):**
    *   **PITR (Point-in-Time Recovery):** Habilitado com retenção de 7 dias.
    *   **Geo-Redundância:** Réplica de leitura em região secundária (ex: us-east-1 -> us-west-2).
    *   **Snapshots:** Diários, retidos por 30 dias.

2.  **Blob Storage (Documentos):**
    *   **Versioning:** Habilitado para recuperar arquivos deletados/sobrescritos.
    *   **Soft Delete:** 30 dias de retenção.

3.  **Infraestrutura:**
    *   **IaC:** Todo o ambiente recriável via Terraform em < 30 min.

### 4.20 Estratégia de Versionamento de API

Para garantir compatibilidade retroativa com clientes móveis ou integrações externas.

*   **URI Versioning:** `/api/v1/cases`, `/api/v2/cases`.
*   **Deprecation Policy:**
    *   Avisar com 3 meses de antecedência via header `Warning`.
    *   Utilizar header `Sunset` (RFC 8594) para indicar data de desligamento.

```python
# Exemplo de Header de Deprecation
response.headers["Warning"] = '299 - "This endpoint will be removed on 2025-12-31"'
response.headers["Sunset"] = "Wed, 31 Dec 2025 23:59:59 GMT"
````

### 4.21 Idempotência de API

Para garantir que retentativas de rede não dupliquem operações críticas (ex: criar case, aprovar).

- **Mecanismo:** Cliente envia header `Idempotency-Key` (UUID v4).
- **Backend:** Armazena chave no Redis por 24h. Se chave existir, retorna a resposta salva anteriormente sem reprocessar.

```python
# Middleware de Idempotência (Conceitual)
@app.middleware("http")
async def idempotency_middleware(request: Request, call_next):
    key = request.headers.get("Idempotency-Key")
    if key:
        cached_response = await redis.get(f"idempotency:{key}")
        if cached_response:
            return Response(**json.loads(cached_response))

    response = await call_next(request)

    if key and response.status_code < 400:
        await redis.set(f"idempotency:{key}", serialize(response), ex=86400)

    return response
```

### 4.22 Feature Flags (PostHog / Unleash)

Para permitir "Trunk-Based Development" e rollouts progressivos.

```python
if feature_flags.is_enabled("new_ai_model_v2", user_id=user.id):
    result = await ai_service_v2.process(data)
else:
    result = await ai_service_v1.process(data)
```

### 4.23 Compressão de Resposta (Gzip/Brotli)

Para reduzir o uso de banda e melhorar o tempo de carregamento em redes móveis.

```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000) # Comprimir respostas > 1KB
```

---

## 5. Especificação do Frontend (React)

### 5.1 Gerenciamento de Estado

- **Server State:** `TanStack Query (React Query)`. Cacheamento de dados da API, revalidação automática, loading states.
- **Client State:** `Zustand`. Para estados globais simples (ex: tema, sidebar open/close, user session).
- **Form State:** `React Hook Form` + `Zod`. Validação de formulários complexos no client-side.

### 5.2 Componentes de UI (Shadcn/ui)

Utilização de componentes primitivos acessíveis:

- `DataTable`: Para listagem de cases com sort/filter.
- `Dialog/Sheet`: Para edições rápidas e visualização de detalhes.
- `Form`: Wrappers controlados para inputs.
- `Toast`: Notificações de sucesso/erro.

#### 5.2.1 Exemplo de Interface de Componente (`CaseCard`)

Para garantir consistência, os componentes de domínio devem seguir interfaces estritas.

```typescript
interface CaseCardProps {
  id: number;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "REVIEW" | "APPROVED" | "REJECTED";
  updatedAt: string;
  authorName: string;
  onAction: (action: "edit" | "view" | "delete") => void;
  className?: string;
}

export const CaseCard: React.FC<CaseCardProps> = ({
  title,
  status,
  ...props
}) => {
  // Implementação usando Card, Badge e Button do Shadcn
};
```

### 5.3 Estrutura de Pastas

```
frontend/src/
├── components/
│   ├── ui/             # Shadcn primitives (Button, Input)
│   ├── layout/         # Sidebar, Header
│   └── domain/         # Componentes de negócio (CaseCard, StatusBadge)
├── hooks/              # Custom hooks (useCases, useAuth)
├── lib/                # Utils (axios instance, formatters)
├── pages/              # Rotas (Dashboard, CaseList, CaseDetail)
└── services/           # API calls definitions
```

### 5.4 Estratégia de Data Fetching (React Query)

Utilizar chaves de query hierárquicas para facilitar a invalidação de cache.

- **Keys Factory:**

```typescript
export const caseKeys = {
  all: ["cases"] as const,
  lists: () => [...caseKeys.all, "list"] as const,
  list: (filters: string) => [...caseKeys.lists(), { filters }] as const,
  details: () => [...caseKeys.all, "detail"] as const,
  detail: (id: number) => [...caseKeys.details(), id] as const,
};
```

- **Exemplo de Hook:**

```typescript
export function useCase(id: number) {
  return useQuery({
    queryKey: caseKeys.detail(id),
    queryFn: () => casesApi.getCase(id),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
```

### 5.5 Configuração do Cliente HTTP (Axios Interceptors)

Para gerenciar tokens JWT automaticamente (anexar no header e refresh).

```typescript
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        const { data } = await axios.post("/auth/refresh", {
          token: refreshToken,
        });
        localStorage.setItem("access_token", data.access_token);
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Logout user
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

### 5.6 Especificação de Página: Detalhes do Case (`/cases/:id`)

Esta é a tela mais complexa. Deve ser composta por múltiplos componentes isolados que consomem o mesmo contexto ou cache.

**Layout:**

1.  **Header:** Título, StatusBadge, Breadcrumbs.
2.  **Toolbar:** Botões de Ação (Editar, Transitar Status) - _Visibilidade baseada em permissão_.
3.  **Tabs:**
    - _Visão Geral:_ Descrição, Metadados, Variáveis (Renderizadas dinamicamente).
    - _Documentos:_ Lista de anexos com preview.
    - _Histórico:_ Timeline vertical dos `audit_logs`.
    - _IA Insights:_ Painel com resumo e risco gerados.

**Lógica de Renderização de Variáveis:**

```tsx
// Componente que decide como renderizar cada variável baseada no tipo
const VariableRenderer = ({ type, value }) => {
  switch (type) {
    case "DATE":
      return <DatePicker value={value} readOnly />;
    case "BOOLEAN":
```

- **Backend:** Armazena chave no Redis por 24h. Se chave existir, retorna a resposta salva anteriormente sem reprocessar.

```python
# Middleware de Idempotência (Conceitual)
@app.middleware("http")
async def idempotency_middleware(request: Request, call_next):
    key = request.headers.get("Idempotency-Key")
    if key:
        cached_response = await redis.get(f"idempotency:{key}")
        if cached_response:
            return Response(**json.loads(cached_response))

    response = await call_next(request)

    if key and response.status_code < 400:
        await redis.set(f"idempotency:{key}", serialize(response), ex=86400)

    return response
```

### 4.22 Feature Flags (PostHog / Unleash)

Para permitir "Trunk-Based Development" e rollouts progressivos.

```python
if feature_flags.is_enabled("new_ai_model_v2", user_id=user.id):
    result = await ai_service_v2.process(data)
else:
    result = await ai_service_v1.process(data)
```

### 4.23 Compressão de Resposta (Gzip/Brotli)

Para reduzir o uso de banda e melhorar o tempo de carregamento em redes móveis.

```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000) # Comprimir respostas > 1KB
```

---

## 5. Especificação do Frontend (React)

### 5.1 Gerenciamento de Estado

- **Server State:** `TanStack Query (React Query)`. Cacheamento de dados da API, revalidação automática, loading states.
- **Client State:** `Zustand`. Para estados globais simples (ex: tema, sidebar open/close, user session).
- **Form State:** `React Hook Form` + `Zod`. Validação de formulários complexos no client-side.

### 5.2 Componentes de UI (Shadcn/ui)

Utilização de componentes primitivos acessíveis:

- `DataTable`: Para listagem de cases com sort/filter.
- `Dialog/Sheet`: Para edições rápidas e visualização de detalhes.
- `Form`: Wrappers controlados para inputs.
- `Toast`: Notificações de sucesso/erro.

#### 5.2.1 Exemplo de Interface de Componente (`CaseCard`)

Para garantir consistência, os componentes de domínio devem seguir interfaces estritas.

```typescript
interface CaseCardProps {
  id: number;
  title: string;
  status: "DRAFT" | "SUBMITTED" | "REVIEW" | "APPROVED" | "REJECTED";
  updatedAt: string;
  authorName: string;
  onAction: (action: "edit" | "view" | "delete") => void;
  className?: string;
}

export const CaseCard: React.FC<CaseCardProps> = ({
  title,
  status,
  ...props
}) => {
  // Implementação usando Card, Badge e Button do Shadcn
};
```

### 5.3 Estrutura de Pastas

```
frontend/src/
├── components/
│   ├── ui/             # Shadcn primitives (Button, Input)
│   ├── layout/         # Sidebar, Header
│   └── domain/         # Componentes de negócio (CaseCard, StatusBadge)
├── hooks/              # Custom hooks (useCases, useAuth)
├── lib/                # Utils (axios instance, formatters)
├── pages/              # Rotas (Dashboard, CaseList, CaseDetail)
└── services/           # API calls definitions
```

### 5.4 Estratégia de Data Fetching (React Query)

Utilizar chaves de query hierárquicas para facilitar a invalidação de cache.

- **Keys Factory:**

```typescript
export const caseKeys = {
  all: ["cases"] as const,
  lists: () => [...caseKeys.all, "list"] as const,
  list: (filters: string) => [...caseKeys.lists(), { filters }] as const,
  details: () => [...caseKeys.all, "detail"] as const,
  detail: (id: number) => [...caseKeys.details(), id] as const,
};
```

- **Exemplo de Hook:**

```typescript
export function useCase(id: number) {
  return useQuery({
    queryKey: caseKeys.detail(id),
    queryFn: () => casesApi.getCase(id),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
```

### 5.5 Configuração do Cliente HTTP (Axios Interceptors)

Para gerenciar tokens JWT automaticamente (anexar no header e refresh).

```typescript
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        const { data } = await axios.post("/auth/refresh", {
          token: refreshToken,
        });
        localStorage.setItem("access_token", data.access_token);
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Logout user
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

### 5.6 Especificação de Página: Detalhes do Case (`/cases/:id`)

Esta é a tela mais complexa. Deve ser composta por múltiplos componentes isolados que consomem o mesmo contexto ou cache.

**Layout:**

1.  **Header:** Título, StatusBadge, Breadcrumbs.
2.  **Toolbar:** Botões de Ação (Editar, Transitar Status) - _Visibilidade baseada em permissão_.
3.  **Tabs:**
    - _Visão Geral:_ Descrição, Metadados, Variáveis (Renderizadas dinamicamente).
    - _Documentos:_ Lista de anexos com preview.
    - _Histórico:_ Timeline vertical dos `audit_logs`.
    - _IA Insights:_ Painel com resumo e risco gerados.

**Lógica de Renderização de Variáveis:**

````tsx
// Componente que decide como renderizar cada variável baseada no tipo
const VariableRenderer = ({ type, value }) => {
  switch (type) {
    case "DATE":
      return <DatePicker value={value} readOnly />;
    case "BOOLEAN":
      return <Switch checked={value} disabled />;
    case "TEXT":
      return <p className="text-gray-700">{value}</p>;
    default:
      return <span>{JSON.stringify(value)}</span>;
    }
};

### 5.7 Tratamento de Erros (Error Boundaries)

Para evitar que a aplicação inteira quebre ("Tela Branca da Morte") devido a erros em componentes específicos.

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-md">
      <h3 className="font-bold text-red-800">Algo deu errado neste componente.</h3>
      <pre className="text-xs text-red-600 mt-2">{error.message}</pre>
      <Button onClick={resetErrorBoundary} variant="outline" className="mt-4">
        Tentar novamente
      </Button>
    </div>
  );
}

// Uso no App
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <CaseDetailsPage />
</ErrorBoundary>
````

### 5.8 Acessibilidade (a11y) e WCAG 2.1

O frontend deve ser acessível para todos os usuários, cumprindo requisitos legais e corporativos.

1.  **Navegação por Teclado:** Todos os elementos interativos devem ser focáveis (`tabindex`) e operáveis via teclado.
2.  **Leitores de Tela:** Utilizar atributos ARIA (`aria-label`, `aria-expanded`, `role`) corretamente, especialmente em componentes customizados como Modais e Dropdowns. O `Radix UI` (base do Shadcn) já fornece isso nativamente.
3.  **Contraste:** Garantir razão de contraste mínima de 4.5:1 para texto normal.
4.  **Feedback Visual:** Nunca usar apenas cor para transmitir informação (ex: erro em formulário deve ter ícone e texto, não apenas borda vermelha).

**Ferramenta de Linting:**
Configurar `eslint-plugin-jsx-a11y` no pipeline de CI para bloquear commits com violações óbvias de acessibilidade.

### 5.9 Sistema de Design e Temas (TailwindCSS)

O sistema utiliza tokens semânticos para facilitar a manutenção e o suporte a Dark Mode.

**`tailwind.config.js` (Exemplo):**

```javascript
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))", // Laranja Itaú
          foreground: "hsl(var(--primary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // ... outros tokens
      },
    },
  },
};
```

### 5.10 Proteção de Rotas (Private Routes)

Componente Wrapper para proteger rotas baseadas em autenticação e roles.

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface PrivateRouteProps {
  roles?: string[]; // Roles permitidas
}

export const PrivateRoute = ({ roles }: PrivateRouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

// Uso no Router
<Route element={<PrivateRoute roles={["ADMIN", "MANAGER"]} />}>
  <Route path="/admin" element={<AdminDashboard />} />
</Route>;
```

### 5.11 Internacionalização (i18n)

Preparado para expansão global utilizando `i18next`.

```typescript
// frontend/src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    pt: {
      translation: {
        welcome: "Bem-vindo ao Gestão de Cases",
        status: {
          DRAFT: "Rascunho",
          APPROVED: "Aprovado",
        },
      },
    },
    en: {
      translation: {
        welcome: "Welcome to Case Management",
        status: {
          DRAFT: "Draft",
          APPROVED: "Approved",
        },
      },
    },
  },
  lng: "pt", // Idioma padrão
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

### 5.12 Otimização de Performance (Web Vitals)

Foco em LCP (Largest Contentful Paint) < 2.5s e CLS (Cumulative Layout Shift) < 0.1.

1.  **Code Splitting:** Carregamento preguiçoso de rotas e componentes pesados.
    ```tsx
    const CaseDetails = lazy(() => import("./pages/CaseDetails"));
    ```
2.  **Tree Shaking:** Garantir que apenas o código utilizado das bibliotecas (ex: lodash, lucide-react) seja incluído no bundle.
3.  **Prefetching:** Carregar dados da próxima página quando o usuário faz hover no link (`onMouseEnter`).

---

## 6. Integrações e Inteligência Artificial

### 6.1 AI Gateway Service

Módulo responsável por abstrair a complexidade dos modelos de IA.

- **Primary Provider:** IaraGenAI (Internal API).
- **Fallback Provider:** AWS Bedrock (Claude 3 Sonnet).

#### Funcionalidades de IA

1.  **Smart Summarization:**
    - _Input:_ Descrição longa e documentos anexos.
    - _Output:_ Resumo executivo de 1 parágrafo.
2.  **Risk Assessment:**
    - _Input:_ Dados do projeto (Orçamento, Prazo, Cliente).
    - _Output:_ Score de Risco (0-100) e lista de fatores de risco.
3.  **Variable Extraction:**
    - _Input:_ Texto livre ou documento PDF.
    - _Output:_ JSON com variáveis estruturadas preenchidas automaticamente.

#### 6.1.1 Engenharia de Prompts (System Prompts)

Para garantir consistência nas respostas da IA, utilizar os seguintes templates de System Prompt.

**Summarization Agent:**

```text
Você é um assistente especialista em gestão de projetos corporativos.
Sua tarefa é ler a descrição técnica de um projeto e gerar um "Resumo Executivo" de no máximo 300 caracteres.
Foque no objetivo de negócio, orçamento e prazo.
Não use jargões técnicos desnecessários.
Entrada: {case_description}
Saída: Resumo em texto corrido.
```

**Risk Analyzer Agent:**

```text
Você é um auditor de riscos sênior. Analise os dados do projeto abaixo e classifique o risco em: BAIXO, MÉDIO ou ALTO.
Considere:
1. Orçamento > R$ 1M (Alto Risco)
2. Prazo < 1 mês (Médio Risco)
3. Tecnologias legadas (Alto Risco)

Entrada: {case_json}
Saída (JSON):
{
  "risk_level": "ALTO",
  "reason": "Orçamento elevado e prazo curto.",
  "suggested_mitigation": "Aumentar equipe ou renegociar prazo."
}
```

**Governance & Compliance Agent:**

```text
Você é um especialista em Compliance Corporativo.
Analise a descrição do case e verifique se há menção a dados sensíveis (PII, Cartão de Crédito, Segredos Industriais).
Se houver, alerte imediatamente.

Entrada: {case_description}
Saída (JSON):
{
  "has_sensitive_data": true,
  "flagged_terms": ["CPF", "Salários"],
  "recommendation": "Anonimizar dados antes de prosseguir."
}
```

#### 6.1.2 Lógica de Fallback (Pseudo-código)

O serviço de IA deve implementar o padrão _Circuit Breaker_ e _Fallback_ para garantir alta disponibilidade.

```python
class AIService:
    def __init__(self):
        self.primary = IaraClient()
        self.secondary = BedrockClient()

    async def generate_summary(self, text: str) -> str:
        try:
            # Tenta provedor primário (IaraGenAI)
            return await self.primary.summarize(text)
        except (TimeoutError, ServiceUnavailableError):
            # Log warning
            logger.warning("IaraGenAI unavailable, switching to Bedrock")
            try:
                # Tenta provedor secundário (AWS Bedrock)
                return await self.secondary.summarize(text)
            except Exception as e:
                # Falha total - Retorna erro ou texto original truncado
                logger.error(f"All AI providers failed: {e}")
                raise AIProcessingError("Unable to generate summary at this time.")
```

#### 6.1.3 Fluxo de Extração de Variáveis (Intelligent Document Processing)

Para extrair dados estruturados de PDFs anexados (ex: Contratos, Propostas).

### 6.2 Notificações

- **Email:** Via SMTP ou AWS SES. Templates HTML renderizados com Jinja2.
- **Teams/Slack:** Webhooks para canais de monitoramento ou DMs para aprovadores.

---

## 7. Segurança e Compliance

### 7.1 Autenticação e Autorização

- **Protocolo:** OAuth2 com JWT (Access Token + Refresh Token).
- **Identity Provider:** Suporte a AWS Cognito ou OIDC genérico para SSO corporativo.
- **RBAC (Role-Based Access Control):**
  - `ADMIN`: Acesso total, gestão de usuários.
  - `MANAGER`: Aprovação de cases, visualização de relatórios gerenciais.
  - `USER`: Criação e edição de seus próprios cases.

#### 7.1.1 Estrutura do Token JWT

O payload do token deve conter as claims necessárias para autorização no frontend e backend sem consultas excessivas ao banco.

```json
{
  "sub": "1234567890", // User ID
  "name": "John Doe",
  "email": "john.doe@company.com",
  "roles": ["MANAGER"], // Array de roles
  "iat": 1516239022,
  "exp": 1516242622,
  "iss": "auth.company.com"
}
```

### 7.2 Proteção de Dados

- **Encryption at Rest:** Banco de dados criptografado (TDE).
- **Encryption in Transit:** TLS 1.2+ obrigatório.
- **Sanitização:** Inputs validados via Pydantic (Backend) e Zod (Frontend) para prevenir Injection.

### 7.3 Segurança de Aplicação (Middleware)

Implementar headers de segurança padrão (OWASP) usando middleware.

```python
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# 1. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Restrito em PROD
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Security Headers (Helmet-like)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

---

## 8. Plano de Testes

### 8.1 Backend

- **Unit Tests:** Pytest. Foco em Services e Models. Mockar DB e chamadas externas.
- **Integration Tests:** Pytest + TestContainers (Postgres). Testar endpoints reais e fluxo de dados no banco.
- **Coverage Target:** > 80%.

### 8.2 Frontend (Vitest + Playwright)

A estratégia de testes do frontend combina testes unitários rápidos com testes E2E robustos.

#### 8.2.1 Testes Unitários (Vitest)

Focados em lógica de componentes isolados, hooks e utilitários.

```typescript
// frontend/src/components/domain/StatusBadge.test.tsx
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders correct label and color for APPROVED", () => {
    render(<StatusBadge status="APPROVED" />);
    const badge = screen.getByText("Aprovado");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-green-100");
  });
});
```

#### 8.2.2 Testes E2E (Playwright)

Simulam fluxos completos do usuário no navegador real.

```typescript
// frontend/e2e/create-case.spec.ts
import { test, expect } from "@playwright/test";

test("User can create a new case", async ({ page }) => {
  await page.goto("/cases/new");

  // Preencher formulário
  await page.fill('input[name="title"]', "Projeto Migração Cloud");
  await page.fill(
    'textarea[name="description"]',
    "Migração de servidores on-premise."
  );

  // Submeter
  await page.click('button[type="submit"]');

  // Verificar redirecionamento e toast
  await expect(page).toHaveURL(/\/cases\/\d+/);
  await expect(page.getByText("Case criado com sucesso")).toBeVisible();
});
```

### 8.3 Cenários de Teste (BDD - Gherkin Style)

Para orientar o desenvolvimento orientado a comportamento (BDD), considere os seguintes cenários críticos.

**Feature: Aprovação de Case**

```gherkin
Scenario: Gerente aprova um case válido
  Given que existe um case com status "REVIEW"
  And eu sou um usuário com role "MANAGER"
  When eu envio uma requisição para transição para "APPROVED"
  Then o status do case deve ser atualizado para "APPROVED"
  And um registro deve ser criado na tabela "audit_logs"
  And um email de notificação deve ser enviado ao autor

Scenario: Usuário comum tenta aprovar case
  Given que existe um case com status "REVIEW"
  And eu sou um usuário com role "USER"
  When eu envio uma requisição para transição para "APPROVED"
  Then a API deve retornar erro 403 Forbidden
  And o status do case NÃO deve ser alterado
```

**Feature: Validação de Orçamento**

```gherkin
Scenario: Criação de case com orçamento negativo
  Given que eu sou um usuário autenticado
  When eu tento criar um case com budget = -100.00
  Then a API deve retornar erro 422 Unprocessable Entity
  And a mensagem de erro deve indicar "budget must be greater than or equal to 0"
```

---

## 9. Guia de Deployment

### 9.1 Docker Compose (Desenvolvimento)

````yaml
version: "3.8"
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: cases_db
  backend:
    build: ./backend
    ports:
      - "8000:8000"
### 9.2 Produção (AWS ECS/EKS)
*   **Backend:** Container Linux (Python). Variáveis de ambiente via AWS Secrets Manager.
*   **Frontend:** AWS Amplify ou S3 + CloudFront.
*   **Database:** AWS RDS for PostgreSQL.

### 9.3 Pipeline CI/CD (GitHub Actions)

Exemplo de workflow para Build e Deploy automático.

```yaml
name: Build and Deploy

on:
  push:
    branches: [ "main" ]

jobs:
  build-backend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    - name: Run Tests
      run: |
        cd backend
        pytest

  build-frontend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Build
      run: |
        cd frontend
        npm ci
        npm run build
````

### 9.4 Variáveis de Ambiente (.env)

O sistema depende das seguintes configurações. **Nunca commitar este arquivo.**

```ini
# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changethis
POSTGRES_DB=app

# Security
SECRET_KEY=supersecretkey_must_be_changed_in_production
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM=HS256

# AI Providers
IARA_API_KEY=sk-iara-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASSWORD=...
```

### 9.5 Infraestrutura como Código (Terraform)

Para garantir reprodutibilidade do ambiente de produção na AWS.

```hcl
# infra/main.tf

provider "aws" {
  region = "us-east-1"
}

resource "aws_db_instance" "default" {
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.t3.micro"
  db_name              = "gestaocases"
  username             = "postgres"
  password             = var.db_password
  parameter_group_name = "default.postgres15"
  skip_final_snapshot  = true
}

resource "aws_ecs_cluster" "main" {
  name = "gestao-cases-cluster"
}
# ... (rest of AWS ECS configuration)
```

```typescript
// frontend/e2e/create-case.spec.ts
import { test, expect } from "@playwright/test";

test("User can create a new case", async ({ page }) => {
  await page.goto("/cases/new");

  // Preencher formulário
  await page.fill('input[name="title"]', "Projeto Migração Cloud");
  await page.fill(
    'textarea[name="description"]',
    "Migração de servidores on-premise."
  );

  // Submeter
  await page.click('button[type="submit"]');

  // Verificar redirecionamento e toast
  await expect(page).toHaveURL(/\/cases\/\d+/);
  await expect(page.getByText("Case criado com sucesso")).toBeVisible();
});
```

### 8.3 Cenários de Teste (BDD - Gherkin Style)

Para orientar o desenvolvimento orientado a comportamento (BDD), considere os seguintes cenários críticos.

**Feature: Aprovação de Case**

```gherkin
Scenario: Gerente aprova um case válido
  Given que existe um case com status "REVIEW"
  And eu sou um usuário com role "MANAGER"
  When eu envio uma requisição para transição para "APPROVED"
  Then o status do case deve ser atualizado para "APPROVED"
  And um registro deve ser criado na tabela "audit_logs"
  And um email de notificação deve ser enviado ao autor

Scenario: Usuário comum tenta aprovar case
  Given que existe um case com status "REVIEW"
  And eu sou um usuário com role "USER"
  When eu envio uma requisição para transição para "APPROVED"
  Then a API deve retornar erro 403 Forbidden
  And o status do case NÃO deve ser alterado
```

**Feature: Validação de Orçamento**

```gherkin
Scenario: Criação de case com orçamento negativo
  Given que eu sou um usuário autenticado
  When eu tento criar um case com budget = -100.00
  Then a API deve retornar erro 422 Unprocessable Entity
  And a mensagem de erro deve indicar "budget must be greater than or equal to 0"
```

---

## 9. Guia de Deployment

### 9.1 Docker Compose (Desenvolvimento)

````yaml
version: "3.8"
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: cases_db
  backend:
    build: ./backend
    ports:
      - "8000:8000"
### 9.2 Produção (Azure App Service)
*   **Backend:** Container Linux (Python). Variáveis de ambiente via Key Vault.
*   **Frontend:** Static Web App ou Container Nginx.
*   **Database:** Azure Database for PostgreSQL (Managed Service).

### 9.3 Pipeline CI/CD (GitHub Actions)

Exemplo de workflow para Build e Deploy automático.

```yaml
name: Build and Deploy

on:
  push:
    branches: [ "main" ]

jobs:
  build-backend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    - name: Run Tests
      run: |
        cd backend
        pytest

  build-frontend:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Build
      run: |
        cd frontend
        npm ci
        npm run build
````

### 9.4 Variáveis de Ambiente (.env)

O sistema depende das seguintes configurações. **Nunca commitar este arquivo.**

```ini
# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changethis
POSTGRES_DB=app

# Security
SECRET_KEY=supersecretkey_must_be_changed_in_production
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM=HS256

# AI Providers
IARA_API_KEY=sk-iara-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASSWORD=...
```

### 9.5 Infraestrutura como Código (Terraform)

Para garantir reprodutibilidade do ambiente de produção na AWS.

```hcl
# infra/main.tf

provider "aws" {
  region = "us-east-1"
}

resource "aws_db_instance" "default" {
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.t3.micro"
  db_name              = "gestaocases"
  username             = "postgres"
  password             = var.db_password
  parameter_group_name = "default.postgres15"
  skip_final_snapshot  = true
}

resource "aws_ecs_cluster" "main" {
  name = "gestao-cases-cluster"
}
# ... (rest of AWS ECS configuration)
```

### 9.6 Padrões de Qualidade (Linting & Formatting)

Para manter a base de código limpa e consistente entre desenvolvedores e agentes de IA.

- **Backend (Python):**

  - **Ruff:** Linter e Formatter ultra-rápido (substitui Black, Isort, Flake8).
  - **Mypy:** Checagem estática de tipos (Strict Mode).
  - **Pre-commit Hooks:** Bloqueia commits fora do padrão.

- **Frontend (TypeScript)::**
  - **ESLint:** Regras recomendadas + Acessibilidade + React Hooks.
  - **Prettier:** Formatação de código.
  - **Husky:** Git hooks para rodar linter antes do push.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.0.270
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
```

---

## 10. Estratégia de Migração de Dados (Legado)

A migração dos dados atuais (Planilhas/SharePoint) é crítica para o sucesso do projeto.

### 10.1 Pipeline ETL (Extract, Transform, Load)

Será desenvolvido um script Python dedicado (`scripts/migration_etl.py`) utilizando `pandas`.

1.  **Extract:** Leitura dos arquivos `.xlsx` ou conexão com API do SharePoint.
2.  **Transform:**
    - **Sanitização:** Remoção de espaços extras, correção de encoding.
    - **Mapeamento de Status:** "Em andamento" -> "SUBMITTED", "Finalizado" -> "CLOSED".
    - **Normalização de Datas:** Converter `dd/mm/yyyy` e `mm/dd/yy` para ISO 8601.
    - **Mapeamento de Usuários:** De-para de nomes/emails antigos para `collaborators.id` novos.
3.  **Load:**
    - Inserção em lote (Batch Insert) no PostgreSQL para performance.
    - Geração de logs de erro para registros falhos (ex: email não encontrado).

### 10.2 Validação Pós-Migração

- **Contagem de Registros:** Comparar `count(*)` origem vs destino.
- **Amostragem:** Verificar manualmente 10 cases complexos.
- **Integridade Referencial:** Garantir que todo case tenha um autor válido.

---

## 11. Manutenção e Troubleshooting (Runbook)

Guia rápido para resolução de incidentes comuns em produção.

### 11.1 Erros Comuns

| Sintoma                          | Causa Provável                            | Ação de Correção                                                                                    |
| :------------------------------- | :---------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| **Erro 504 Gateway Timeout**     | IA demorando > 30s para responder.        | Verificar logs do Celery; Aumentar timeout do Nginx; Verificar status da API da OpenAI/Bedrock.     |
| **Erro "Too many clients" (DB)** | Vazamento de conexões ou pico de tráfego. | Verificar `pg_stat_activity`; Ajustar `pool_size` no backend; Reiniciar pods da API.                |
| **Frontend lento / Travando**    | Renderização excessiva de listas grandes. | Verificar se a paginação está ativa; Implementar virtualização (`react-window`) na tabela de cases. |
| **Upload falha silenciosamente** | Token SAS/Presigned URL expirado.         | Verificar relógio do servidor; Aumentar tempo de expiração da URL assinada.                         |

### 11.2 Rotinas de Manutenção

1.  **Vacuum do PostgreSQL:** Agendar `VACUUM ANALYZE` semanalmente para otimizar índices GIN do JSONB.
2.  **Limpeza de Logs:** Configurar rotação de logs de aplicação (reter 30 dias) e auditoria (reter 5 anos - Cold Storage).
3.  **Rotação de Chaves:** Renovar `SECRET_KEY` e credenciais de Service Principals a cada 90 dias.

### 11.3 Regras de Alerta (Prometheus/Grafana)

Definição de limiares para disparo de alertas para o time de SRE/DevOps.

| Alerta              | Condição (PromQL)                                                                   | Severidade    | Ação                          |
| :------------------ | :---------------------------------------------------------------------------------- | :------------ | :---------------------------- |
| **High Error Rate** | `rate(http_requests_total{status=~"5.."}[5m]) > 1%`                                 | P1 (Critical) | PageDuty -> On-call Engineer  |
| **High Latency**    | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5`    | P2 (Warning)  | Notificar canal Slack #devops |
| **Low Disk Space**  | `node_filesystem_avail_bytes{mountpoint="/"}` / `node_filesystem_size_bytes < 0.15` | P2 (Warning)  | Limpar logs / Expandir disco  |
| **AI Service Down** | `rate(ai_provider_errors_total[5m]) > 0`                                            | P1 (Critical) | Verificar status AWS/OpenAI   |

---

## 12. Roadmap de Evolução

### 12.1 Fase 1: MVP (Mês 1-2)

- Core do Sistema (CRUD Cases, Auth, Workflow Básico).
- Integração IA Básica (Resumo e Risco).
- Migração de Dados Legados.

### 12.2 Fase 2: Inteligência Avançada (Mês 3-4)

- RAG para busca semântica em anexos.
- Agentes Autônomos para preenchimento de variáveis.
- Chatbot para dúvidas sobre cases.

### 12.3 Fase 3: Analytics & Governança (Mês 5)

- Dashboards Gerenciais (Power BI Embedded ou Custom).
- Integração com SAP/ERP Financeiro.
- App Mobile para aprovações rápidas.

---

## 13. Métricas de Sucesso (KPIs)

O sucesso da implementação será medido pelos seguintes indicadores:

1.  **Eficiência Operacional:**

    - **Cycle Time:** Redução do tempo médio de aprovação de 5 dias para 2 dias.
    - **Touchpoints:** Redução de 4 para 1 interação humana necessária para cadastro.

2.  **Adoção de IA:**

    - **Taxa de Utilização:** > 70% dos cases criados utilizando o recurso de "Smart Summarization".
    - **Precisão:** < 5% de edições manuais nos campos preenchidos automaticamente pela IA.

3.  **Qualidade Técnica:**
    - **Uptime:** 99.9% de disponibilidade em horário comercial.
    - **Performance:** Tempo de resposta da API (p95) < 200ms.

---

## 14. Glossário Técnico

- **Case:** Unidade de trabalho/projeto.
- **Workflow:** Máquina de estados que rege o ciclo de vida do case.
- **JSONB:** Tipo de dado do PostgreSQL para armazenamento de documentos JSON binários.
- **JWT:** JSON Web Token, usado para autenticação stateless.
- **RAG:** Retrieval-Augmented Generation, técnica para enriquecer prompts de IA com dados do banco.

---

## 15. Referências e Aprovação

```

```
