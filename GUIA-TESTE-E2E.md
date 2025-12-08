# Guia de Teste E2E Manual - Sistema de Gestão de Cases

**Data de Criação**: 2025-11-28  
**Objetivo**: Validar todas as funcionalidades implementadas do sistema

---

## 🎯 Pré-requisitos

Antes de iniciar, certifique-se de que:

- [ ] Backend está rodando: `docker-compose ps` (backend, db, redis devem estar "Up")
- [ ] Frontend está rodando: `npm run dev` na pasta `frontend/`
- [ ] Você consegue acessar `http://localhost:3000`
- [ ] DevTools do navegador está aberto (F12) na aba Console

---

## 📝 Teste 1: Criação de Case

### Passos:

1. **Navegar para o formulário**

   - [ ] Abrir `http://localhost:3000`
   - [ ] Clicar em "Cases" no menu lateral
   - [ ] Clicar no botão "Novo Case"
   - [ ] Verificar: URL é `/cases/new`

2. **Preencher campos obrigatórios**

   - [ ] **Macro Case**: `Sistema E2E`
   - [ ] **Nome do Subcase**: `Teste Completo Final`
   - [ ] **Cliente**: `Cliente Validação`
   - [ ] **Contexto do Case**: `Este é um teste end-to-end completo do sistema de gestão de cases para validar todas as funcionalidades implementadas.`
   - [ ] **Impacto**: `Validação completa de todas as integrações backend-frontend`
   - [ ] **Necessidade**: `Garantir que o sistema está funcional antes da entrega`
   - [ ] **Jornada Impactada**: `Desenvolvimento`
   - [ ] **Segmento Impactado**: `Equipe Técnica`
   - [ ] **Clientes Impactados**: `10000`

3. **Adicionar uma variável**

   - [ ] Clicar no botão "Adicionar Variáveis"
   - [ ] Preencher modal:
     - **Nome**: `Taxa de Sucesso`
     - **Conceito**: `Percentual de testes que passaram com sucesso`
     - **Prioridade**: `Alta`
     - **Defasagem Desejada**: `D-1`
     - **Produto**: `Sistema de Gestão`
     - **Histórico Mínimo**: `6 meses`
     - **Tipo**: `Número` (selecionar "number" no dropdown)
   - [ ] Clicar em "Adicionar e concluir"
   - [ ] Verificar: Variável aparece na lista

4. **Verificar console antes de submeter**

   - [ ] Abrir Console do DevTools
   - [ ] Verificar: Não há erros em vermelho

5. **Submeter o formulário**

   - [ ] Clicar no botão no final do formulário (deve dizer "Adicionar Case" ou "Confirmar e Criar")
   - [ ] **IMPORTANTE**: Verificar o modal de confirmação

6. **Validar Modal de Confirmação**
   - [ ] Verificar **Título** mostra: `Teste Completo Final` (SEM duplicação)
   - [ ] Verificar **Cliente** mostra: `Cliente Validação` (SEM duplicação)
   - [ ] Verificar **Macro Case** mostra: `Sistema E2E` (SEM duplicação)
   - [ ] Verificar **Contexto** está correto e completo
   - [ ] Verificar seção de **Variáveis** mostra: `1` variável
   - [ ] Verificar variável listada: `Taxa de Sucesso (Sistema de Gestão)`

**❌ FALHA CRÍTICA**: Se qualquer campo mostrar duplicação (ex: "Teste Completo FinalTeste Completo Final"), ANOTAR e parar aqui.

7. **Confirmar criação**

   - [ ] Clicar em "Confirmar e Criar"
   - [ ] **Observar console**: Deve mostrar logs:
     ```
     Form data before normalization: {...}
     Form data after normalization: {...}
     Submitting case to API: {...}
     [caseService] Creating case with data: {...}
     [caseService] Case created successfully: {id: X, ...}
     ```

8. **Verificar criação bem-sucedida**
   - [ ] Verificar: **Redirecionamento** para `/cases/{id}` (onde `{id}` é um número)
   - [ ] OU: Redirecionamento para `/cases` (lista de cases)
   - [ ] Se redirecionou para a lista, clicar no case recém-criado

**❌ FALHA CRÍTICA**: Se aparecer um alerta de erro, ANOTAR a mensagem exata e verificar console.

### Resultado do Teste 1:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui qualquer problema ou comportamento inesperado]
  ```

---

## 📄 Teste 2: Página de Detalhes do Case

### Pré-requisito:

- Case criado no Teste 1 com ID conhecido
- Você está em `/cases/{id}`

---

### 2.1 - Aba Overview (Visão Geral)

**Passos**:

1. [ ] Verificar: Aba "Visão Geral" está ativa (destacada)
2. [ ] Verificar dados exibidos:
   - [ ] **Título/Nome** do case está correto
   - [ ] **Status** mostra "DRAFT" (rascunho)
   - [ ] **Cliente** está correto
   - [ ] **Macro Case** está correto
   - [ ] **Contexto** está completo
   - [ ] **Impacto** está correto
   - [ ] **Necessidade** está correta
   - [ ] **Jornada** está correta
   - [ ] **Segmento** está correto
   - [ ] **Clientes Impactados** está correto
3. [ ] Verificar: Não há dados faltando ou truncados

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

### 2.2 - Aba Variáveis

**Passos**:

1. [ ] Clicar na aba "Variáveis"
2. [ ] Verificar: Lista mostra **1 variável**
3. [ ] Verificar dados da variável:
   - [ ] **Nome**: `Taxa de Sucesso`
   - [ ] **Conceito**: está completo
   - [ ] **Produto**: `Sistema de Gestão`
   - [ ] **Prioridade**: `Alta`
   - [ ] **Tipo**: `number` ou `Número`

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

### 2.3 - Aba Documentos

**Passos**:

1. [ ] Clicar na aba "Documentos"
2. [ ] Verificar: Botão "Enviar Documento" está visível
3. [ ] Verificar: Mensagem "Nenhum documento enviado ainda" está exibida (se for o primeiro acesso)

**Teste de Upload**: 4. [ ] Criar um arquivo de teste (pode ser um .txt com conteúdo "Teste E2E") 5. [ ] Clicar em "Enviar Documento" 6. [ ] Selecionar o arquivo criado 7. [ ] **Observar**:

- [ ] Botão muda para "Enviando..." enquanto faz upload
- [ ] Após conclusão, arquivo aparece na lista
- [ ] Nome do arquivo está correto
- [ ] Data de envio está presente

**Verificar Console**: 8. [ ] No console, procurar por:

- Logs de upload de arquivo
- URL presignada gerada (deve ser um mock: `http://localhost:8000/mock-s3/...`)
- Confirmação de registro do documento

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

### 2.4 - Aba Comentários

**Passos**:

1. [ ] Clicar na aba "Comentários"
2. [ ] Verificar: Campo de texto para novo comentário está visível
3. [ ] Verificar: Botão "Enviar" está visível
4. [ ] Verificar: Mensagem "Nenhum comentário ainda" está exibida (se for o primeiro acesso)

**Teste de Criação de Comentário**: 5. [ ] Digitar no campo: `Este é um comentário de teste E2E para validar a funcionalidade.` 6. [ ] Clicar em "Enviar" 7. [ ] **Observar**:

- [ ] Botão muda para "Enviando..." durante o envio
- [ ] Comentário aparece na lista após conclusão
- [ ] Texto do comentário está completo e correto
- [ ] Mostra "Usuário 1" (ou ID do usuário logado)
- [ ] Timestamp está presente e razoável

8. [ ] **Adicionar um segundo comentário**: `Segundo comentário para testar listagem múltipla.`
9. [ ] Verificar: Agora mostra **2 comentários** na ordem correta (mais recente primeiro)

**Verificar Console**: 10. [ ] Procurar por logs de criação de comentário 11. [ ] Verificar chamada à API: `POST /cases/{id}/comments`

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

### 2.5 - Aba Histórico

**Passos**:

1. [ ] Clicar na aba "Histórico"
2. [ ] **Observar loading state**: "Carregando histórico..."
3. [ ] Após carregar, verificar eventos:

   - [ ] Deve mostrar pelo menos **1 evento**: criação do case
   - [ ] Evento mostra ação (ex: "CREATE" ou descrição)
   - [ ] Evento mostra usuário que criou
   - [ ] Evento mostra timestamp correto

4. [ ] Verificar ordem cronológica (mais recente primeiro)

**Verificar Console**: 5. [ ] Procurar por logs de busca de histórico 6. [ ] Verificar chamada à API: `GET /cases/{id}/history`

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

### 2.6 - Aba IA Insights

**Passos**:

1. [ ] Clicar na aba "IA Insights"
2. [ ] **Observar loading state**: "Carregando análise de IA..."
3. [ ] Após carregar, verificar seção **Resumo Inteligente**:

   - [ ] Mostra texto de resumo (pode ser mock)
   - [ ] Menciona "IaraGenAI"
   - [ ] Conteúdo está formatado e legível

4. [ ] Verificar seção **Análise de Risco**:

   - [ ] Mostra **Score de Risco** (número de 0 a 100)
   - [ ] Mostra **Nível de Risco** (BAIXO, MÉDIO ou ALTO)
   - [ ] Barra de progresso visual corresponde ao score
   - [ ] Cor da barra corresponde ao nível (verde/amarelo/vermelho)

5. [ ] Verificar **Fatores Identificados**:
   - [ ] Se houver fatores, são listados
   - [ ] Cada fator é uma frase descritiva

**Verificar Console**: 6. [ ] Procurar por logs das chamadas de IA 7. [ ] Verificar chamadas à API:

- `POST /cases/{id}/summarize`
- `POST /cases/{id}/risk-assessment`

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

## 🔄 Teste 3: Navegação e Listagem

### 3.1 - Voltar para Lista de Cases

**Passos**:

1. [ ] Clicar em "Cases" no menu lateral
2. [ ] Verificar: Redirecionamento para `/cases`
3. [ ] Verificar: Case criado aparece na tabela
4. [ ] Verificar dados na tabela:
   - [ ] ID está correto
   - [ ] Título está correto
   - [ ] Cliente está correto
   - [ ] Status mostra "DRAFT"
   - [ ] Data de criação está presente

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

## 🎨 Teste 4: Transição de Status (Opcional)

**Nota**: Este teste valida o workflow de aprovação.

### Passos:

1. [ ] Voltar para a página de detalhes do case: `/cases/{id}`
2. [ ] Verificar se há botões de ação para mudar status (podem estar no topo ou na aba Overview)
3. [ ] Se houver botão "Submeter" ou "Aprovar", clicar
4. [ ] Verificar se status muda
5. [ ] Voltar para aba Histórico
6. [ ] Verificar se novo evento de mudança de status foi registrado

**Verificar Console**: 7. [ ] Procurar por logs de transição de status 8. [ ] Verificar se notificação foi enviada (logs do backend)

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU | [ ] ⏭️ NÃO TESTADO
- **Observações**:
  ```
  [Anote aqui]
  ```

---

## 🔍 Teste 5: Validação de Console e Network

### Verificações Gerais:

1. **Console do Navegador**:

   - [ ] Não há **erros em vermelho** não tratados
   - [ ] Avisos (warnings) são apenas de desenvolvimento (React, etc.)
   - [ ] Logs customizados estão aparecendo conforme esperado

2. **Aba Network** (DevTools):

   - [ ] Abrir aba Network
   - [ ] Filtrar por "XHR" ou "Fetch"
   - [ ] Verificar chamadas API durante o uso:
     - [ ] `POST /api/v1/cases` - criação (status 201)
     - [ ] `GET /api/v1/cases/{id}` - busca do case (status 200)
     - [ ] `GET /api/v1/cases/{id}/documents` - listagem de docs (status 200)
     - [ ] `POST /api/v1/cases/{id}/documents` - registro de doc (status 200)
     - [ ] `GET /api/v1/cases/{id}/comments` - listagem de comentários (status 200)
     - [ ] `POST /api/v1/cases/{id}/comments` - criação de comentário (status 201 ou 200)
     - [ ] `GET /api/v1/cases/{id}/history` - busca de histórico (status 200)
     - [ ] `POST /api/v1/cases/{id}/summarize` - resumo IA (status 200)
     - [ ] `POST /api/v1/cases/{id}/risk-assessment` - avaliação de risco (status 200)

3. **Status HTTP**:
   - [ ] Todas as requisições bem-sucedidas retornam 200 ou 201
   - [ ] Não há requisições com status 400, 404, 500

**Resultado**:

- **Status**: [ ] ✅ PASSOU | [ ] ❌ FALHOU
- **Observações**:
  ```
  [Anote aqui]
  ```

---

## 📊 Resumo Final dos Testes

Preencha após completar todos os testes:

| Teste                  | Resultado            | Observações |
| ---------------------- | -------------------- | ----------- |
| 1. Criação de Case     | [ ] ✅ [ ] ❌        |             |
| 2.1. Aba Overview      | [ ] ✅ [ ] ❌        |             |
| 2.2. Aba Variáveis     | [ ] ✅ [ ] ❌        |             |
| 2.3. Aba Documentos    | [ ] ✅ [ ] ❌        |             |
| 2.4. Aba Comentários   | [ ] ✅ [ ] ❌        |             |
| 2.5. Aba Histórico     | [ ] ✅ [ ] ❌        |             |
| 2.6. Aba IA Insights   | [ ] ✅ [ ] ❌        |             |
| 3. Navegação/Listagem  | [ ] ✅ [ ] ❌        |             |
| 4. Transição de Status | [ ] ✅ [ ] ❌ [ ] ⏭️ |             |
| 5. Console/Network     | [ ] ✅ [ ] ❌        |             |

---

## 🐛 Bugs Encontrados

Se encontrou algum problema, documente aqui:

### Bug #1

- **Onde**: [Qual parte do sistema]
- **O que aconteceu**: [Descrição do problema]
- **Esperado**: [O que deveria acontecer]
- **Console/Network**: [Logs relevantes]
- **Severidade**: [ ] CRÍTICO [ ] ALTO [ ] MÉDIO [ ] BAIXO

### Bug #2

- **Onde**:
- **O que aconteceu**:
- **Esperado**:
- **Console/Network**:
- **Severidade**: [ ] CRÍTICO [ ] ALTO [ ] MÉDIO [ ] BAIXO

---

## ✅ Conclusão

**Data do Teste**: ******\_\_\_******  
**Testado por**: ******\_\_\_******

**Avaliação Geral**:

- [ ] Sistema está **100% funcional** - todos os testes passaram
- [ ] Sistema está **funcional com ressalvas** - alguns problemas menores encontrados
- [ ] Sistema tem **problemas críticos** - bugs bloqueadores encontrados

**Próximos Passos Sugeridos**:

```
[Liste aqui as próximas ações baseadas nos resultados]
```

---

## 📞 Suporte

Em caso de dúvidas ou problemas:

1. Verifique os logs do backend: `docker-compose logs -f backend`
2. Verifique se todos os serviços estão rodando: `docker-compose ps`
3. Reinicie o ambiente se necessário: `docker-compose restart`
4. Consulte os documentos:
   - `ESTADO-ATUAL.md` - Status do sistema
   - `e2e-test-findings.md` - Bugs conhecidos
   - `walkthrough.md` - Correções implementadas
