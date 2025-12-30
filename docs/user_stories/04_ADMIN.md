# Histórias de Usuário: Administrador (Admin)

**Persona:** `Administrador`
**Descrição:** Profissional de TI, DevOps ou "Super User" responsável pela configuração global, segurança, integridade do sistema e gestão de acessos.

---

## 1. Gestão de Usuários e Acessos

### US-ADM-01: Gestão de Papéis (RBAC)

**Como** Administrador,
**Quero** atribuir papéis específicos (Requester, Moderator, Curator, Admin) aos usuários,
**Para** garantir que cada pessoa tenha acesso apenas às funcionalidades pertinentes à sua função (Princípio do Menor Privilégio).

- **Critérios de Aceite:**
  - Interface de busca de usuário por e-mail/LDAP.
  - Checkbox para múltiplos papéis (um usuário pode ser Requester e Moderator).
  - Log de auditoria de quem alterou a permissão de quem.

### US-ADM-02: Configuração de Hierarquia Organizacional

**Como** Administrador,
**Quero** configurar a árvore de aprovação (quem é gerente de quem ou qual área responde a qual superintendência),
**Para** que o workflow de aprovação encaminhe os cases para as pessoas corretas automaticamente.

- **Critérios de Aceite:**
  - Visualização gráfica ou em árvore da estrutura.
  - CRUD de Áreas/Departamentos.
  - Definição de "Head" ou "Approver" por área.

### US-ADM-03: Delegação de Aprovação (Proxy)

**Como** Administrador,
**Quero** configurar delegações temporárias de aprovação em nome de gestores ausentes (férias/licença),
**Para** destravar processos parados.

- **Critérios de Aceite:**
  - Definição de período (Data Início - Data Fim).
  - Usuário Delegado herda permissões de aprovação do Delegante apenas nesse período.
  - Histórico mostra "Aprovado por [Delegado] em nome de [Delegante]".

---

## 2. Configuração do Sistema

### US-ADM-04: Parametrização de SLAs

**Como** Administrador,
**Quero** definir os tempos limites (SLA) para cada etapa do processo (ex: Revisão = 2 dias),
**Para** que o sistema possa calcular atrasos e gerar alertas de coloração (Amarelo/Vermelho).

- **Critérios de Aceite:**
  - Configuração global ou por tipo de case.
  - Definição de dias úteis vs corridos.

### US-ADM-05: Gestão de Integrações (API Keys)

**Como** Administrador,
**Quero** gerenciar as chaves de API e conexões com serviços externos (OpenAI, Atlan, SMTP),
**Para** manter o sistema conectado e seguro.

- **Critérios de Aceite:**
  - Armazenamento seguro de secrets (mascarado na tela).
  - Teste de conectividade ("Ping") para cada integração.
  - Toggle para ativar/desativar integrações específicas (Feature Flag).

### US-ADM-06: Configuração de Templates de E-mail

**Como** Administrador,
**Quero** editar o texto e layout dos e-mails transacionais enviados pelo sistema,
**Para** adequar a comunicação a mudanças de tom de voz ou rebranding da empresa.

- **Critérios de Aceite:**
  - Editor HTML básico ou suporte a variáveis (ex: `{{case_title}}`).
  - Pré-visualização do e-mail.

---

## 3. Segurança e Auditoria

### US-ADM-07: Auditoria Global (System Logs)

**Como** Administrador,
**Quero** acessar um log completo de todas as ações de todos os usuários,
**Para** investigar incidentes de segurança ou erros operacionais.

- **Critérios de Aceite:**
  - Filtro por Ator, Ação, Data e Recurso Afetado.
  - Exportação para CSV/JSON para análise externa.
  - Logs devem ser imutáveis (Write-once).

### US-ADM-08: Gestão de Sessões Ativas

**Como** Administrador,
**Quero** visualizar e derrubar sessões de usuários ativos,
**Para** forçar logout em casos de suspeita de comprometimento de conta.

- **Critérios de Aceite:**
  - Lista de usuários online.
  - Botão "Revogar Sessão".

---

## 4. Monitoramento Técnico

### US-ADM-09: Dashboard de Saúde do Sistema

**Como** Administrador,
**Quero** ver métricas de saúde da aplicação (Latência, Erros 5xx, Fila de Jobs),
**Para** agir proativamente antes que os usuários finais percebam lentidão.

- **Critérios de Aceite:**
  - Integração com Health Checks da API.
  - Status dos containers/serviços (DB, Redis, Worker).

---

**Fim das Histórias de Administrador**
