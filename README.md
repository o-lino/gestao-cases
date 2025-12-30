# Sistema de Gestão de Cases - v2.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

Sistema web para gerenciamento completo do ciclo de vida de projetos de consultoria (cases).

## 🚀 Stack Tecnológica

- **Backend**: FastAPI 0.104+ (Python 3.11)
- **Frontend**: React 18.2 + TypeScript + Vite
- **Database**: PostgreSQL 15
- **Cache**: Redis
- **Container**: Docker & Docker Compose

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 18+ (para desenvolvimento local do frontend)
- Python 3.11+ (para desenvolvimento local do backend)

## 🛠️ Configuração Inicial

### 1. Criar arquivos de ambiente

Copie os arquivos de exemplo e preencha com valores reais:

```bash
cp .env.example .env
cp .env.db.example .env.db
```

**IMPORTANTE**: Atualize as seguintes variáveis:

- `SECRET_KEY`: Gere uma chave aleatória de 32+ caracteres
- `POSTGRES_PASSWORD`: Use uma senha segura

### 2. Iniciar os serviços

```bash
docker-compose up -d
```

### 3. Executar migrações do banco de dados

```bash
docker-compose exec backend alembic upgrade head
```

### 4. (Opcional) Criar usuário inicial

```bash
docker-compose exec backend python -m app.initial_data
```

## 🌐 Acessar a aplicação

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentação API**: http://localhost:8000/docs

## 📦 Desenvolvimento Local

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🧪 Testes

### Backend

```bash
docker-compose exec backend pytest -v
```

### Frontend

```bash
cd frontend
npm run test
```

## 📝 Principais Funcionalidades

- ✅ Autenticação JWT com roles (ADMIN, MANAGER, USER)
- ✅ CRUD completo de Cases
- ✅ Variáveis dinâmicas (JSONB) por case
- ✅ Workflow de estados com validação de transições
- ✅ Histórico de auditoria completo
- ✅ Upload de documentos (S3)
- ✅ Paginação e filtros
- ✅ Validação de dados em múltiplas camadas

## 🏗️ Arquitetura

```
backend/
├── app/
│   ├── api/          # Endpoints REST
│   ├── core/         # Config, segurança, exceções
│   ├── models/       # SQLAlchemy models
│   ├── schemas/      # Pydantic schemas
│   └── services/     # Lógica de negócio
└── alembic/          # Migrações de DB

frontend/
├── src/
│   ├── components/   # Componentes reutilizáveis
│   ├── pages/        # Páginas da aplicação
│   ├── services/     # API clients
│   └── context/      # Context providers
```

## 🔒 Segurança

- Todas as senhas são hasheadas com bcrypt
- JWT tokens com expiração configurável
- CORS configurável por ambiente
- Validação de dados com Pydantic V2
- Proteção contra SQL Injection (SQLAlchemy ORM)
- Headers de segurança implementados

## 📚 Documentação Adicional

- [Requirements Specification](./requirements.md) - Especificação completa
- [API Documentation](http://localhost:8000/docs) - Swagger UI (quando rodando)

## 🤝 Contribuindo

1. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
2. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
3. Push para a branch (`git push origin feature/AmazingFeature`)
4. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a [Licença MIT](LICENSE) - veja o arquivo LICENSE para detalhes.

## 🆘 Troubleshooting

### Erro de conexão com banco de dados

Certifique-se de que o serviço PostgreSQL está rodando:

```bash
docker-compose ps
```

Verifique os logs:

```bash
docker-compose logs db
```

### Migrate não encontrado

Execute migrations manualmente:

```bash
docker-compose exec backend alembic upgrade head
```

### Frontend não carrega

Reconstrua os containers:

```bash
docker-compose down
docker-compose up --build
```
