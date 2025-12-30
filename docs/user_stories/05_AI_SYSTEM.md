# Histórias de Usuário: Sistema de IA (AI Agent)

**Persona:** `AI Agent / Sistema Inteligente`
**Descrição:** Módulo de inteligência artificial que atua como um assistente proativo, automatizando tarefas cognitivas e enriquecendo os dados com predições.

---

## 1. Processamento de Linguagem Natural (NLP)

### US-AI-01: Geração de Resumo Executivo

**Como** Usuário (Leitor),
**Quero** ler um parágrafo conciso gerado pela IA que sintetize o objetivo do case,
**Para** entender rapidamente o contexto sem precisar ler todos os campos detalhados.

- **Critérios de Aceite:**
  - Trigger automático na criação ou edição do case (Debounce de 5s).
  - Resumo deve capturar: Objetivo, Cliente e Impacto.
  - Botão para regenerar o resumo manualmente.

### US-AI-02: Análise de Sentimento em Comentários

**Como** Moderador,
**Quero** que o sistema sinalize threads de comentários que estão ficando "quentes" (sentimento negativo/conflito),
**Para** intervir antes que a situação escale.

- **Critérios de Aceite:**
  - Ícone visual (ex: chama ou alerta) em threads com sentimento negativo detectado.
  - Score de sentimento interno (-1 a +1).

### US-AI-03: Chatbot Assistente (Q&A)

**Como** Solicitante,
**Quero** fazer perguntas em linguagem natural sobre o preenchimento do case (ex: "Qual a diferença entre Lag D-1 e D-0?"),
**Para** obter ajuda imediata sem abrir chamado de suporte.

- **Critérios de Aceite:**
  - Janela de chat flutuante ou integrada.
  - Respostas baseadas na base de conhecimento (Glossário/FAQ) da empresa.

---

## 2. Recomendação e Matching

### US-AI-04: Sugestão Automática de Tabela (Semantic Search)

**Como** Solicitante ou Curador,
**Quero** que o sistema sugira a tabela mais provável para uma variável baseada na descrição textual,
**Para** encontrar o dado correto mesmo sem saber o nome técnico.

- **Critérios de Aceite:**
  - Busca vetorial (Embeddings) comparando descrição da variável com metadados do catálogo.
  - Lista top-k (3 a 5) sugestões ordenadas por score de similaridade.
  - Feedback de "Match Correto" retroalimenta o modelo.

### US-AI-05: Detecção de Duplicidade de Variáveis

**Como** Curador,
**Quero** que a IA alerte se a variável sendo criada parece ser duplicada (semanticamente idêntica) a outra já existente no case,
**Para** evitar redundância.

- **Critérios de Aceite:**
  - Alerta "Parece que você já pediu isso: [Variável X]".
  - Comparação semântica, não apenas de string exata.

---

## 3. Predição e Risco

### US-AI-06: Avaliação de Risco Preditiva

**Como** Gestor,
**Quero** ver um score de risco (0-100) para cada case, calculado com base em dados históricos (ex: cases similares que atrasaram),
**Para** focar minha atenção nos projetos com maior chance de falha.

- **Critérios de Aceite:**
  - Fatores considerados: Complexidade, Orçamento, Histórico do Solicitante, Clareza da Descrição.
  - Exibição dos "Top Fatores de Risco" (explanabilidade).

### US-AI-07: Estimativa de Prazo de Entrega

**Como** Solicitante,
**Quero** ter uma estimativa de quando meu case será aprovado baseada na fila atual e performance histórica dos moderadores,
**Para** alinhar expectativas.

- **Critérios de Aceite:**
  - Mensagem: "Estimativa de aprovação: 3 dias úteis".
  - Cálculo baseado na mediana de tempo de aprovação dos últimos 30 dias.

---

## 4. Aprendizado Contínuo (RLHF)

### US-AI-08: Captura de Feedback de Decisão

**Como** Cientista de Dados (Mantenedor da IA),
**Quero** que todas as aceitações ou rejeições de sugestões da IA sejam logadas estruturadamente,
**Para** criar um dataset de "Reinforcement Learning from Human Feedback" (RLHF).

- **Critérios de Aceite:**
  - Tabela de `ai_feedback_logs` contendo: Input, Output Sugerido, Ação do Usuário (Aceitou/Editou/Rejeitou), Valor Final.
  - Sem impacto perceptível na performance do usuário.

---

**Fim das Histórias de IA**
