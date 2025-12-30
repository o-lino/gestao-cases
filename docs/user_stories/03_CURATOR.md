# Histórias de Usuário: Curador (Curator)

**Persona:** `Curador`
**Descrição:** Engenheiro de Dados, Arquiteto de Dados ou Data Steward responsável por traduzir requisitos de negócio em especificações técnicas de dados, garantindo uso correto das tabelas e conformidade.

---

## 1. Identificação e Seleção de Dados

### US-CUR-01: Análise de Solicitações Técnicas

**Como** Curador,
**Quero** receber uma lista de variáveis aprovadas que necessitam de "De-Para" técnico,
**Para** saber exatamente quais dados preciso localizar no Data Lake/Warehouse.

- **Critérios de Aceite:**
  - Fila de trabalho filtrada por "Aguardando Curadoria".
  - Detalhes da variável mostram conceito, periodicidade e exemplos fornecidos pelo solicitante.

### US-CUR-02: Busca no Catálogo de Dados (Integração)

**Como** Curador,
**Quero** buscar tabelas existentes no catálogo (ex: Atlan/Glue) diretamente pela interface do sistema,
**Para** encontrar a melhor fonte de dados sem precisar alternar entre ferramentas.

- **Critérios de Aceite:**
  - Campo de busca conectado à API de Metadados.
  - Resultados exibem nome da tabela, schema, description e owner.
  - Visualização de amostra de dados (se permissão permitir) para validar conteúdo.

### US-CUR-03: Aprovação de Match Sugerido (IA)

**Como** Curador,
**Quero** validar ou corrigir a sugestão automática de tabela feita pelo Agente de IA,
**Para** acelerar o processo aproveitando a pré-análise da máquina, mas mantendo a decisão final humana.

- **Critérios de Aceite:**
  - Interface mostra "Variável Solicitada" vs "Tabela Sugerida" lado a lado.
  - Botões rápidos: "Aceitar Match", "Rejeitar/Editar".
  - Score de confiança da IA visível.

---

## 2. Enriquecimento e Qualidade

### US-CUR-04: Definição de Metadados Técnicos

**Como** Curador,
**Quero** preencher os campos técnicos finais da variável (Nome Físico, Caminho S3, Tipo de Dado SQL),
**Para** que os engenheiros de ingestão ou analistas saibam exatamente o que consultar.

- **Critérios de Aceite:**
  - Campos para: `table_name`, `column_name`, `data_type`, `partition_key`.
  - Link para documentação oficial da tabela.

### US-CUR-05: Sinalização de Qualidade de Dado

**Como** Curador,
**Quero** marcar o nível de qualidade ou certificação da tabela selecionada (ex: Gold, Silver, Bronze, Legacy),
**Para** alertar o solicitante sobre a confiabilidade do dado que ele vai usar.

- **Critérios de Aceite:**
  - Badges visuais de qualidade.
  - Aviso obrigatório se selecionar uma tabela "Legacy" ou "Deprecated".

### US-CUR-06: Cadastro de Nova Necessidade de Ingestão

**Como** Curador,
**Quero** sinalizar que não existe tabela pronta para atender aquela variável e que uma nova ingestão é necessária,
**Para** disparar um fluxo de trabalho para a equipe de Engenharia de Dados.

- **Critérios de Aceite:**
  - Opção "Tabela não encontrada".
  - Formulário para descrever a fonte original do dado (Sistema X, API Y) e requisitos de ingestão.
  - Status da variável muda para "PENDING_INGESTION".

---

## 3. Gestão e Manutenção

### US-CUR-08: Rastreamento de Lineage (Linhagem)

**Como** Curador,
**Quero** visualizar quais cases estão utilizando uma determinada tabela,
**Para** analisar impacto antes de fazer alterações ou descontinuar uma tabela no Data Lake.

- **Critérios de Aceite:**
  - Busca reversa: Input Tabela -> Output Lista de Cases/Variáveis.
  - Alerta de "Alto Impacto" se tabela for usada em muitos cases críticos.

### US-CUR-09: Notificação de Depreciação

**Como** Curador,
**Quero** notificar automaticamente os donos de cases quando uma tabela vinculada for marcada como depreciada,
**Para** que eles atualizem seus processos proativamente.

- **Critérios de Aceite:**
  - Ação de "Marcar como Depreciada" dispara e-mails para todos os `Requesters` afetados.

---

**Fim das Histórias de Curador**
