# Histórias de Usuário - Sistema de Gestão de Cases 2.0

> **Nota do PM:** Este documento detalha exaustivamente as jornadas dos usuários atendidas pelo sistema. O foco é capturar não apenas a funcionalidade ("o quê"), mas a motivação ("por quê") e o valor entregue ("para que").

---

## 1. Persona: Solicitante (Requester)

**Perfil:** Consultor, analista ou gerente de negócios que precisa iniciar uma nova iniciativa (Case) e garantir que ela tenha os dados e aprovações corretos.

### Épico: Criação e Definição do Case

- **US-01: Cadastro Inicial de Case**

  - **Como** solicitante,
  - **Quero** preencher um formulário estruturado com título, cliente, descrição, datas e orçamento,
  - **Para** formalizar o início de uma nova iniciativa e obter um ID único de rastreamento no sistema.
  - _Critérios de Aceite:_ Campos obrigatórios validados; criação em estado 'Rascunho'; feedback visual de sucesso.

- **US-02: Definição de Necessidades (Contexto e Impacto)**

  - **Como** solicitante,
  - **Quero** detalhar o contexto (ex: "Problema de Churn"), a necessidade (ex: "Análise de Retenção") e o impacto esperado (ex: "Redução de 5% no churn"),
  - **Para** que os aprovadores e o sistema compreendam a relevância estratégica do case e priorizem corretamente.

- **US-03: Adição de Variáveis Dinâmicas**

  - **Como** solicitante,
  - **Quero** adicionar variáveis específicas (ex: "Lista de Clientes", "Taxa de Juros") ao case, definindo seus conceitos e tipos,
  - **Para** especificar exatamente quais dados e insumos serão necessários para a execução do projeto.
  - _Critérios de Aceite:_ Suporte a múltiplos tipos (texto, número, data); modal de adição intuitivo; prevenção de duplicatas na listagem.

- **US-04: Upload de Documentação de Suporte**
  - **Como** solicitante,
  - **Quero** anexar arquivos (PDFs, PPTs, Excels) diretamente ao case,
  - **Para** fornecer evidências, briefings ou materiais de referência que ajudem na compreensão e execução do mesmo.

### Épico: Acompanhamento e Colaboração

- **US-05: Monitoramento de Status em Tempo Real**

  - **Como** solicitante,
  - **Quero** visualizar claramente em qual etapa do fluxo (Rascunho, Em Revisão, Aprovado) meu case se encontra,
  - **Para** gerenciar as expectativas dos stakeholders e saber quando agir.

- **US-06: Interação via Comentários**

  - **Como** solicitante,
  - **Quero** trocar mensagens e responder dúvidas dos moderadores na própria página do case,
  - **Para** centralizar a comunicação e evitar o uso de e-mails dispersos que perdem o histórico.

- **US-07: Solicitação de Aprovação (Submissão)**
  - **Como** solicitante,
  - **Quero** enviar meu case para revisão apenas quando eu considerar que ele está completo,
  - **Para** evitar que rascunhos incompletos sejam avaliados prematuramente.

---

## 2. Persona: Moderador (Reviewer/Moderator)

**Perfil:** Profissional sênior ou líder de equipe responsável pela governança, qualidade dos dados e aprovação técnica dos cases.

### Épico: Governança e Revisão

- **US-08: Fila de Pendências de Revisão**

  - **Como** moderador,
  - **Quero** ter uma visão centralizada (Dashboard ou Lista) de todos os cases que aguardam minha revisão com status "Submetido" ou "Em Revisão",
  - **Para** organizar meu trabalho e garantir que nenhum case fique parado além do SLA permitido.

- **US-09: Análise Detalhada do Case**

  - **Como** moderador,
  - **Quero** acessar a visão completa do case (incluindo variáveis, metadados e documentos) em uma única tela,
  - **Para** avaliar a viabilidade técnica e a clareza da solicitação antes de aprovar.

- **US-10: Aprovação ou Rejeição com Justificativa**

  - **Como** moderador,
  - **Quero** aprovar o case para a próxima fase ou rejeitá-lo, sendo obrigado a fornecer um motivo claro em caso de rejeição,
  - **Para** garantir a qualidade do pipeline e dar feedback construtivo ao solicitante para correções.

- **US-11: Atribuição de Responsáveis (Owner/Curator)**
  - **Como** moderador,
  - **Quero** definir quem será o "Dono" técnico ou o "Curador" responsável por aquele case ou variáveis específicas,
  - **Para** garantir que haja accountability clara sobre a entrega dos dados.

---

## 3. Persona: Curador (Curator)

**Perfil:** Especialista em dados, Data Steward ou Arquiteto de Dados que conhece profundamente as tabelas e o catálogo de dados da organização.

### Épico: Qualidade e Match de Dados

- **US-12: Correção de Sugestões de Tabelas**

  - **Como** curador,
  - **Quero** revisar as tabelas sugeridas (pelo sistema ou pelo solicitante) para atender a uma variável e corrigi-las se necessário,
  - **Para** garantir que o dado consumido seja o "Golden Record" oficial e não uma cópia desatualizada.

- **US-13: Enriquecimento de Metadados da Variável**

  - **Como** curador,
  - **Quero** adicionar informações técnicas às variáveis (ex: nome físico da tabela, link para catálogo Atlan, Owner do dado),
  - **Para** facilitar o trabalho dos engenheiros de dados e analistas que irão consumir essa informação.

- **US-14: Validação de Disponibilidade de Dados**
  - **Como** curador,
  - **Quero** sinalizar se um dado solicitado já existe ou se precisará ser construído (nova ingestão),
  - **Para** alinhar expectativas de prazo e esforço com o solicitante.

---

## 4. Persona: Administrador do Sistema (Admin)

**Perfil:** DevOps ou Gerente Técnico que cuida da configuração da plataforma.

### Épico: Configuração e Controle

- **US-15: Gestão de Hierarquia e Permissões**

  - **Como** administrador,
  - **Quero** configurar a árvore hierárquica da organização e os papéis de cada usuário (Admin, Manager, User),
  - **Para** garantir que o fluxo de aprovação respeite a cadeia de comando correta e que usuários tenham acesso apenas ao que é pertinente.

- **US-16: Configuração de Delegação**

  - **Como** administrador,
  - **Quero** configurar regras de delegação de aprovação (ex: em caso de férias do gerente, quem aprova),
  - **Para** evitar gargalos no processo quando aprovadores principais estão indisponíveis.

- **US-17: Acesso a Logs de Auditoria**
  - **Como** administrador,
  - **Quero** acessar um histórico imutável de todas as ações críticas (quem alterou o quê e quando),
  - **Para** atender a requisitos de compliance e auditoria interna (LGPD/Segurança).

---

## 5. Persona: Agente de IA / Sistema (AI Agent)

**Perfil:** Componente de inteligência artificial integrado ao backend.

### Épico: Automação Cognitiva

- **US-18: Geração Automática de Resumos**

  - **Como** sistema,
  - **Quero** analisar o texto descritivo do case e gerar um resumo executivo conciso,
  - **Para** que moderadores e executivos entendam rapidamente o propósito do case sem ler todo o detalhe.

- **US-19: Avaliação de Riscos (Risk Assessment)**

  - **Como** sistema,
  - **Quero** analisar os parâmetros do case (orçamento alto, prazo curto, complexidade de dados) e atribuir um score de risco,
  - **Para** alertar preventivamente os gestores sobre cases que têm alta chance de falhar ou atrasar.

- **US-20: Sugestão Automática de Tabelas (Matching)**
  - **Como** sistema,
  - **Quero** comparar o conceito da variável solicitada com o catálogo de metadados e sugerir automaticamente a tabela mais provável,
  - **Para** reduzir o trabalho manual do Curador e acelerar o preenchimento técnico.

---

## 6. Histórias Técnicas / Não-Funcionais (Enablers)

- **US-21: Performance de Carregamento**
  - **Como** usuário, quero que as listagens de cases carreguem em menos de 200ms, para que meu fluxo de trabalho não seja interrompido.
- **US-22: Segurança de Acesso**
  - **Como** CISO, quero que todas as rotas de API sejam protegidas por tokens JWT e validação de Role, para impedir acesso não autorizado.
- **US-23: Confiabilidade de Upload**
  - **Como** sistema, quero garantir que uploads de arquivos grandes não bloqueiem o servidor principal (uso de Presigned URLs), para manter a estabilidade da API.

---

## 7. Histórias Complementares e de Usabilidade

- **US-24: Operações em Massa (Bulk Actions)**

  - **Como** solicitante,
  - **Quero** selecionar múltiplas variáveis e cancelá-las ou editá-las de uma vez,
  - **Para** economizar tempo quando preciso fazer ajustes em grandes listas de requisitos.

- **US-25: Notificações Multicanais**

  - **Como** usuário,
  - **Quero** receber notificações por E-mail e Teams quando houver uma atualização relevante no meu case,
  - **Para** que eu não precise ficar entrando no sistema para checar status (polling manual).

- **US-26: Histórico de Decisões para Treinamento de IA**

  - **Como** cientista de dados,
  - **Quero** que o sistema registre estruturadamente todas as decisões de aprovação/rejeição e correções de curadoria,
  - **Para** usar esses dados como "Ground Truth" para retreinar e melhorar os modelos de sugestão do agente no futuro.

- **US-27: Busca e Filtragem Avançada**
  - **Como** usuário,
  - **Quero** filtrar a lista de cases por status, data, cliente ou palavras-chave,
  - **Para** encontrar rapidamente iniciativas antigas ou verificar se já existe um case similar cadastrado (evitar duplicidade).

---

**Fim do Documento**
