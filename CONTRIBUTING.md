# Contribuindo para o Projeto

Obrigado por considerar contribuir para o Gestão Cases 2.0!

---

## 🚀 Configuração do Ambiente

### Pré-requisitos

- Docker e Docker Compose
- Node.js 18+ (desenvolvimento frontend)
- Python 3.11+ (desenvolvimento backend)

### Setup

```bash
# Clone o repositório
git clone <repo-url>
cd gestao-cases-2.0

# Configure variáveis de ambiente
cp .env.example .env
cp .env.db.example .env.db

# Inicie os containers
docker-compose up -d
```

---

## 📋 Padrões de Código

### TypeScript (Frontend)

- Use **tipos explícitos** - evite `any`
- Prefixe variáveis não utilizadas com `_` (ex: `_index`)
- Remova imports não utilizados
- Use **interfaces** para props de componentes

```typescript
// ✅ Bom
interface ButtonProps {
  label: string;
  onClick: () => void;
}

// ❌ Evite
const Button = (props: any) => { ... }
```

### Python (Backend)

- Siga PEP 8
- Use **type hints** em funções
- Docstrings em funções públicas

```python
# ✅ Bom
def get_case(case_id: int) -> Case:
    """Retorna um case pelo ID."""
    ...
```

---

## 🌿 Workflow de Branches

```
main (produção)
├── develop (desenvolvimento)
│   ├── feature/nome-feature
│   ├── fix/descricao-bug
│   └── refactor/area-refatorada
```

### Convenção de Commits

Siga o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(frontend): add variable approval workflow
fix(backend): correct SLA calculation
docs: update README with new roles
refactor(cases): extract tab components
```

---

## 🧪 Testes

### Frontend

```bash
cd frontend
npm run test
```

### Backend

```bash
docker-compose exec backend pytest -v
```

### Build Limpo (TypeScript)

```bash
docker compose -f docker-compose.build.yml build --no-cache frontend-build
```

---

## 📝 Processo de Review

1. Crie uma branch a partir de `develop`
2. Faça suas alterações
3. Execute testes localmente
4. Abra um Pull Request
5. Aguarde code review
6. Após aprovação, faça merge

---

## 🔍 Checklist para PRs

- [ ] Código segue os padrões do projeto
- [ ] Testes passando
- [ ] Build TypeScript sem warnings
- [ ] Documentação atualizada (se necessário)
- [ ] Commit messages seguem convenção
