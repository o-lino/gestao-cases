# Histórias de Usuário: Moderador (Reviewer)

**Persona:** `Moderador`
**Descrição:** Gestor, Tech Lead ou membro da equipe de Governança de Dados responsável por avaliar a viabilidade técnica e financeira dos cases, além de garantir o alinhamento estratégico.

---

## 1. Gestão da Fila de Solicitações

### US-MOD-01: Visualização de Fila de Pendências

**Como** Moderador,
**Quero** um dashboard que liste prioritariamente os cases com status "SUBMITTED" ou "REVIEW",
**Para** identificar rapidamente onde minha ação é necessária e evitar gargalos no pipeline.

- **Critérios de Aceite:**
  - Listagem deve destacar o tempo decorrido desde a submissão (SLA counter).
  - Casos atribuídos a mim devem aparecer no topo.
  - Indicadores visuais de "Novo" para cases nunca abertos.

### US-MOD-02: Filtros Avançados de Moderação

**Como** Moderador,
**Quero** filtrar a fila por Cliente, Solicitante ou Complexidade (Score de Risco),
**Para** agrupar tarefas similares (ex: revisar todos os cases de um mesmo cliente de uma vez).

- **Critérios de Aceite:**
  - Filtro por intervalo de datas.
  - Filtro por intervalo de orçamento.
  - Busca textual por título ou ID.

### US-MOD-03: Auto-atribuição de Revisão

**Como** Moderador,
**Quero** atribuir um case a mim mesmo ("Pegar para revisar"),
**Para** sinalizar aos outros moderadores que já estou trabalhando naquela demanda e evitar colisão de esforços.

- **Critérios de Aceite:**
  - Botão "Iniciar Revisão" na lista ou detalhe.
  - Ao clicar, status muda para "REVIEW" e o campo `assigned_to` recebe meu ID.
  - Outros moderadores devem ver esse case como "Em Progresso por [Meu Nome]".

### US-MOD-04: Reatribuição de Case

**Como** Moderador,
**Quero** transferir a responsabilidade de revisão para outro colega,
**Para** balancear a carga de trabalho ou encaminhar para um especialista no assunto do case.

- **Critérios de Aceite:**
  - Seletor de usuários (filtrado por role=MODERATOR/ADMIN).
  - Notificação automática enviada ao novo responsável.
  - Entrada no log de auditoria registrando a transferência.

---

## 2. Processo de Revisão e Aprovação

### US-MOD-05: Análise Completa de Requisitos

**Como** Moderador,
**Quero** visualizar todas as informações do case (Metadados, Variáveis, Documentos) em uma view consolidada,
**Para** julgar a viabilidade técnica sem precisar navegar por múltiplas telas.

- **Critérios de Aceite:**
  - Layout otimizado para leitura (Read-only mode inicialmente).
  - Acesso rápido aos anexos (visualização ou download).
  - Destaque para variáveis que não possuem match automático claro.

### US-MOD-06: Solicitação de Correções (Request Changes)

**Como** Moderador,
**Quero** devolver o case para o solicitante pedindo ajustes específicos sem rejeitá-lo definitivamente,
**Para** manter o fluxo vivo e criar um ciclo iterativo de melhoria.

- **Critérios de Aceite:**
  - Recurso de comentários obrigatório.
  - Status muda para "CHANGES_REQUESTED" (ou volta para DRAFT com flag).
  - Solicitante é notificado.

### US-MOD-07: Aprovação de Case

**Como** Moderador,
**Quero** aprovar formalmente o case que atende a todos os critérios,
**Para** liberar a iniciativa para a próxima fase (Desenvolvimento/Curadoria Técnica).

- **Critérios de Aceite:**
  - Ação irreversível (ou requer privilégio Admin para reverter).
  - Geração de registro de aprovação com timestamp e responsável.
  - Status muda para "APPROVED".

### US-MOD-08: Rejeição de Case

**Como** Moderador,
**Quero** rejeitar e encerrar um case inviável,
**Para** impedir o uso de recursos em iniciativas sem retorno ou alinhamento.

- **Critérios de Aceite:**
  - Obrigatoriedade de preencher "Motivo da Rejeição" (Texto ou Select list).
  - Status muda para "REJECTED".
  - Arquivamento do case.

---

## 3. Alocação e Curadoria

### US-MOD-09: Designação de Curador Técnico

**Como** Moderador,
**Quero** indicar qual Engenheiro de Dados ou Curador será responsável por disponibilizar as tabelas aprovadas,
**Para** garantir que a execução técnica tenha um dono nomeado.

- **Critérios de Aceite:**
  - Campo "Curador Responsável" na fase de aprovação.
  - Curador recebe notificação de nova tarefa.

### US-MOD-10: Priorização de Solicitações

**Como** Moderador,
**Quero** definir o nível de prioridade (Alta, Média, Baixa) do case aprovado,
**Para** orientar a fila de backlog da equipe técnica.

- **Critérios de Aceite:**
  - Flag visual de prioridade na lista de tarefas técnicas.

---

## 4. Auditoria e Rastreabilidade

### US-MOD-11: Visualização de Histórico de Mudanças

**Como** Moderador,
**Quero** ver o "Diff" do que mudou desde a última vez que olhei o case,
**Para** focar minha revisão apenas nas novidades e não reler tudo (especialmente em ciclos de correção).

- **Critérios de Aceite:**
  - Log de auditoria acessível na aba "Histórico".
  - Destaque visual das alterações recentes.

---

**Fim das Histórias de Moderador**
