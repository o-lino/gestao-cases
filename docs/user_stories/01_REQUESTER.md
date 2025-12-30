# Histórias de Usuário: Solicitante (Requester)

**Persona:** `Solicitante`
**Descrição:** Profissional de negócios, consultor ou analista que identifica uma necessidade de projeto/estudo e inicia o processo no sistema. Seu foco é a agilidade na aprovação e a garantia de que a entrega final atenderá aos requisitos de negócio.

---

## 1. Gestão do Ciclo de Vida do Case

### US-REQ-01: Criação de Novo Case

**Como** Solicitante,
**Quero** iniciar um novo case preenchendo um formulário guiado,
**Para** formalizar uma demanda de negócio e obter um ID único para rastreamento.

- **Critérios de Aceite:**
  - O sistema deve gerar um ID sequencial único automaticamente.
  - Campos obrigatórios (Título, Cliente, Descrição) devem ter validação visual.
  - O case deve ser salvo imediatamente como "DRAFT" (Rascunho) ao ser criado.
  - O usuário deve ser redirecionado para a página de detalhes do case após a criação.

### US-REQ-02: Edição de Rascunho (Draft)

**Como** Solicitante,
**Quero** editar livremente todos os campos de um case enquanto ele estiver no status "DRAFT",
**Para** refinar as informações e corrigir erros antes de submeter para aprovação.

- **Critérios de Aceite:**
  - Todos os campos (incluindo variáveis e documentos) devem ser editáveis.
  - O sistema deve salvar as alterações automaticamente (autosave) ou via botão explícito.
  - Não deve ser possível editar cases que já foram submetidos (status > DRAFT), exceto se rejeitados.

### US-REQ-03: Submissão para Aprovação

**Como** Solicitante,
**Quero** enviar meu case para o fluxo de revisão através de uma ação explícita de "Submeter",
**Para** sinalizar que a definição está completa e iniciar o SLA de atendimento.

- **Critérios de Aceite:**
  - O botão "Submeter" só deve estar habilitado se todos os campos obrigatórios estiverem preenchidos.
  - O status do case deve transitar de "DRAFT" para "SUBMITTED".
  - O sistema deve exibir um modal de confirmação antes de efetivar a ação.
  - O solicitante deve receber um feedback visual (toast) de sucesso.

### US-REQ-04: Cancelamento de Case

**Como** Solicitante,
**Quero** cancelar um case que não faz mais sentido,
**Para** evitar desperdício de tempo dos moderadores e limpar minha lista de iniciativas.

- **Critérios de Aceite:**
  - Permitido apenas para cases que ainda não foram aprovados ou iniciados.
  - Exige uma justificativa curta para o cancelamento.
  - O status deve mudar para "CANCELED".
  - Cases cancelados devem ficar ocultos por padrão na lista, mas acessíveis via filtro.

---

## 2. Definição de Variáveis e Dados

### US-REQ-05: Adição de Variáveis de Dados

**Como** Solicitante,
**Quero** adicionar variáveis ao case descrevendo o conceito de negócio (ex: "Faturamento Bruto por Loja"),
**Para** especificar os dados necessários para a análise sem precisar saber o nome técnico da tabela.

- **Critérios de Aceite:**
  - Deve ser possível adicionar múltiplas variáveis.
  - Deve suportar diferentes tipos: Numérico, Texto, Data, Lista.
  - Deve permitir descrição detalhada (Conceito) e periodicidade desejada (Lag).

### US-REQ-06: Ações em Massa nas Variáveis (Bulk Actions)

**Como** Solicitante,
**Quero** selecionar várias variáveis de uma vez para remover ou duplicar,
**Para** agilizar o preenchimento de cases complexos com dezenas de variáveis similares.

- **Critérios de Aceite:**
  - Checkbox de seleção múltipla na lista de variáveis.
  - Botão "Selecionar Todos".
  - Ações disponíveis: "Remover Selecionados", "Duplicar Selecionados".
  - Feedback de confirmação antes de exclusão em massa.

### US-REQ-07: Importação de Lista de Variáveis

**Como** Solicitante,
**Quero** importar uma lista de variáveis a partir de um arquivo Excel/CSV,
**Para** economizar tempo evitando a digitação manual de variáveis que já tenho documentadas externamente.

- **Critérios de Aceite:**
  - O sistema deve fornecer um template de planilha para download.
  - Validação de formato e campos obrigatórios no upload.
  - Feedback de erro linha a linha caso a importação falhe parcial ou totalmente.

---

## 3. Acompanhamento e Comunicação

### US-REQ-08: Dashboard de "Meus Cases"

**Como** Solicitante,
**Quero** visualizar uma lista de todos os casos que criei, filtrados por status,
**Para** ter uma visão geral do meu portfólio de solicitações e identificar gargalos.

- **Critérios de Aceite:**
  - Colunas: ID, Título, Status, Data Criação, Última Atualização.
  - Filtros rápidos: "Rascunhos", "Em Análise", "Aprovados".
  - Ordenação por data (decrescente por padrão).
  - Indicadores visuais (cores) para os diferentes status.

### US-REQ-09: Notificações de Progresso

**Como** Solicitante,
**Quero** ser notificado (E-mail/Teams) sempre que houver mudança de status ou novos comentários em meus cases,
**Para** responder rapidamente a solicitações de informação e não atrasar o fluxo.

- **Critérios de Aceite:**
  - Notificação imediata ao transitar status (Ex: Aprovado, Rejeitado).
  - Notificação quando um moderador posta um comentário.
  - Link direto para o case no corpo da notificação.

### US-REQ-10: Chat Contextual (Comentários)

**Como** Solicitante,
**Quero** conversar com o moderador dentro da página do case,
**Para** esclarecer dúvidas específicas sobre requisitos sem sair do contexto da aplicação.

- **Critérios de Aceite:**
  - Histórico cronológico de mensagens.
  - Identificação visual clara de quem enviou (Avatar/Nome).
  - Suporte a formatação básica de texto (negrito, itálico) é desejável.
  - Timestamps precisos nas mensagens.

---

## 4. Funcionalidades Avançadas

### US-REQ-11: Clonagem de Case (Template)

**Como** Solicitante,
**Quero** criar um novo case a partir de uma cópia de um case existente,
**Para** reaproveitar estruturas de dados e definições de projetos recorrentes (ex: "Relatório Mensal de Vendas").

- **Critérios de Aceite:**
  - Botão "Duplicar" na tela de detalhes do case.
  - O novo case deve nascer como "DRAFT".
  - Todas as variáveis devem ser copiadas.
  - Arquivos anexos _não_ devem ser copiados por padrão (decisão de segurança/volume), ou deve haver opção de escolha.
  - Histórico e comentários _não_ devem ser copiados.

### US-REQ-12: Exportação de Detalhes (PDF/Excel)

**Como** Solicitante,
**Quero** exportar os detalhes do case e a lista de variáveis para um documento,
**Para** compartilhar com stakeholders que não têm acesso ao sistema ou anexar em contratos formais.

- **Critérios de Aceite:**
  - Botão "Exportar" visível.
  - Layout de impressão amigável (PDF) contendo cabeçalho e tabelas legíveis.
  - Opção CSV para a lista de variáveis.

---

**Fim das Histórias de Solicitante**
