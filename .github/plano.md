# Plano de Base do Sistema Antigo FisioHub

Este documento consolida tudo o que foi entendido sobre a versão antiga do sistema localizada em `_oldversion`. A intenção é que ele funcione como memória técnica permanente para orientar futuras análises, manutenção, refatoração e reconstrução do novo sistema FisioHub.

## 1. Visão Geral

O sistema antigo não era apenas uma aplicação web isolada. Ele era um ecossistema composto por:

- Um painel principal em navegador para processamento e consulta de dados.
- Um backend Node.js/Express com SQLite, usado principalmente para backup e restauração.
- Uma extensão Chrome chamada Zenfisio Collector, responsável por coletar dados da agenda da Zenfisio e exportar TXT.
- Uma segunda extensão Chrome, Zenfisio Presence Notifier, responsável por monitorar alterações e enviar mensagens automáticas ao Google Chat.
- Um conjunto de páginas dedicadas para módulos de negócio, como evoluções, financeiro, agendamentos e pacientes.

O coração operacional do sistema antigo estava no frontend. O backend existia, mas a maior parte da regra de negócio rodava no navegador e persistia em `localStorage`.

## 2. Identidade Do Produto

O sistema era apresentado como Auto Gerenciamento ZenFisio no legado, com foco em automatizar a rotina de uma clínica de fisioterapia. A proposta principal era reduzir digitação manual, organizar dados de atendimentos e criar um banco local de pacientes e histórico clínico-financeiro.

Pontos de identidade observados:

- Nome do projeto: Zenfisio Auto Gerenciamento.
- Versão do pacote principal: 1.4.9 no `package.json` da base antiga, embora o frontend exiba versão 1.5.0 em algumas telas.
- Público-alvo: clínica de fisioterapia da ESEFID/UFRGS.
- Proposta: automação local, privacidade e organização operacional.
- Estética: tema escuro padrão, detalhes em verde Zenfisio e UI densa em informação.

## 3. Arquitetura Macro

### 3.1 Camadas principais

O sistema antigo pode ser entendido em quatro blocos:

1. Frontend principal.
2. Backend de apoio.
3. Extensão de coleta.
4. Extensão de notificação.

### 3.2 Relação entre as camadas

- O Collector capturava dados da agenda da Zenfisio e os exportava em TXT.
- O painel principal importava o TXT, processava o conteúdo e distribuía os dados por módulos.
- O frontend mantinha o estado local em `localStorage` e atualizava automaticamente as páginas por eventos customizados.
- O backend Express servia rotas de backup/importação e operava com SQLite para persistência auxiliar.
- O Presence Notifier monitorava status e enviava mensagens automáticas ao Google Chat quando havia confirmação de presença ou cancelamento.

### 3.3 Dependência real

Na prática, a lógica mais importante não estava concentrada em um servidor. Ela estava distribuída entre:

- `src/js/core/dataProcessor.js`
- `src/js/core/dataAnalyzer.js`
- `src/js/components/backup-manager.js`
- `src/js/pages/*.js`
- `zenfisio-collector/collector.js`
- `zenfisio-presence-notifier/src/background/*.js`

Isso significa que a versão antiga era fortemente orientada a navegador e automação, não a backend centralizado.

## 4. Estrutura De Pastas E Função De Cada Bloco

### 4.1 Raiz do projeto

- `index.html`: painel principal da aplicação.
- `orchestrate.js`: inicialização do backend.
- `config.js`: configurações do backend principal.
- `package.json`: dependências e scripts.
- `README.md`: documentação comercial e funcional.
- `assets/icons/logo.svg`: identidade visual principal.

### 4.2 Pasta `src`

Contém o frontend antigo principal.

- `src/js/app.js`: bootstrap da aplicação.
- `src/js/config.js`: configurações globais do frontend.
- `src/js/core/`: módulos centrais de comportamento (DataProcessor, DataAnalyzer, ThemeManager, LogManager, NotificationManager).
- `src/js/components/`: componentes de interface (Sidebar, BackupManager, Header, Footer, modais).
- `src/js/pages/`: páginas de módulos.
- `src/js/utils/utilities.js`: utilidades compartilhadas.
- `src/pages/`: páginas HTML dedicadas aos módulos.
- `src/styles/`: design system, componentes e páginas.

### 4.3 Pasta `modules`

Contém um backend mais estruturado em camadas:

- `modules/backend/api/server.js`: servidor HTTP.
- `modules/backend/api/routes/backup.js`: rotas de backup.
- `modules/backend/business/services/backup-service.js`: lógica de backup.
- `modules/backend/data/services/database.js`: SQLite e transações.
- `modules/backend/data/repositories/export-repository.js`: exportação de dados.
- `modules/backend/data/repositories/import-repository.js`: importação e restauração.
- `modules/backend/utils/logger.js`: logging.
- `modules/core/config/backup.js`: configuração de backup.
- `modules/frontend/`: uma camada paralela de frontend com roteamento e página de backup, aparentando ser uma estrutura de evolução/reaproveitamento.
- `modules/tests/`: suíte de testes do backend, principalmente backup.

### 4.4 Pastas das extensões

- `zenfisio-collector/`: extensão de coleta de dados da agenda.
- `zenfisio-presence-notifier/`: extensão de automação de mensagens no Google Chat.

## 5. Frontend Principal

### 5.1 Papel do `index.html`

O arquivo principal carregava tudo por scripts e estilos estáticos. Ele concentrava:

- Header com logo e toggle de tema.
- Sidebar com data, importação e processamento de texto.
- Área de módulos.
- Modais de backup, limpeza, versão, termos e ajuda.
- Footer com análise, versão e termos.

### 5.2 Organização visual

O layout principal era composto por:

- Uma sidebar grande para entrada e processamento de dados.
- Uma área de módulos com botões grandes para navegação.
- Um conjunto de modais para tarefas auxiliares.
- Um footer com ações institucionais e analíticas.

### 5.3 Scripts principais carregados

O `index.html` carregava:

- `src/js/core/logManager.js`
- `src/js/core/theme.js`
- `src/js/core/dataAnalyzer.js`
- `src/js/core/dataProcessor.js`
- `src/js/core/notificationManager.js`
- `src/js/utils/utilities.js`
- `src/js/config.js`
- `src/js/components/header.js`
- `src/js/components/footer.js`
- `src/js/components/version-modal.js`
- `src/js/components/sidebar-new.js`
- `src/js/components/modules.js`
- `src/js/components/backup-manager.js`
- `src/js/components/terms-modal.js`
- `src/js/components/how-to-use-modal.js`
- `src/js/components/analyze-modal.js`
- `src/js/app.js`

Isso mostra uma arquitetura de composição por script solto, com inicialização automática em `window`.

## 6. Fluxo De Dados

### 6.1 Entrada principal

A entrada de dados acontecia de duas formas:

- Colagem direta no textarea principal.
- Importação de arquivo TXT gerado pelo Zenfisio Collector.

### 6.2 Processamento

O processamento era conduzido pelo `DataProcessor`.

Ele fazia as seguintes etapas:

1. Recebia dados novos via evento `contentprocess`.
2. Corrigia dados com base no banco de pacientes (`zenfisio-pacientes-db`).
3. Calculava valores faltantes pela frequência semanal (1x/2x/3x).
4. Validava e normalizava os registros.
5. Mesclava com dados antigos no LocalStorage sem duplicações.
6. Salvava o banco principal de atendimentos (`zenfisio-atendimentos-db`).
7. Distribuía os dados por eventos específicos de cada página (`evolucoes-data`, `financeiro-data`, `agendamentos-data`, `pacientes-data`).
8. Atualizava o banco de pacientes automaticamente (preservando `editadoManualmente`).

### 6.3 Eventos e sincronização entre módulos

- `DataProcessor` publica events e todas as páginas escutam.
- `EvolucoesPage` filtra e remove já realizadas.
- `PacientesPage` mantém cadastro normalizado e histórico de edição.
- `Financeiro` calcula receita e contagens (pagantes/isentos).

## 7. Banco Local E Chaves Importantes

O sistema antigo dependia fortemente de `localStorage`.

Chaves relevantes identificadas:

- `zenfisio-atendimentos-db`
- `zenfisio-pacientes-db`
- `zenfisio-evolucoes-realizadas`
- `zenfisio-valores-padrao`
- `zenfisio-data-selecionada`
- `zenfisio-data-selecionada-formatted`
- `zenfisio-theme`
- `zenfisio-logs`
- `zenfisio-backups-importados`

### 7.1 Significado funcional

- `zenfisio-atendimentos-db`: banco principal de atendimentos (esqueleto cronológico).
- `zenfisio-pacientes-db`: cadastro mestre de pacientes (uso de referência + auto-completar).
- `zenfisio-evolucoes-realizadas`: marcação de evoluções já completadas para evitar duplicidade.
- `zenfisio-valores-padrao`: configuração de preços de 1x/2x/3x.
- `zenfisio-data-selecionada`: data de referência corrente para filtros.
- `zenfisio-theme`: tema atual, dark/light.
- `zenfisio-backups-importados`: histórico de importações realizadas.

## 8. Regras De Negócio Detectadas

### 8.1 Normalização de status

O sistema tratava variações de grafia e acentuação. Os status relevantes eram:

- presença confirmada
- atendido
- não atendido
- faltou
- cancelado
- agendado

### 8.2 Especialização por módulo

- Evoluções: apenas `presença confirmada` e filtros de pendência.
- Financeiro: `presença confirmada` e `atendido` na receita.
- Agendamentos: estado de presença.
- Pacientes: cadastro e big data de referências.

### 8.3 Regras financeiras

Valor calculado baseado em frequência de procedimento no texto:

- 1x semana = R$ 25,00
- 2x semana = R$ 20,00
- 3x semana = R$ 15,00

Isentos recebem `valor = 0`.

### 8.4 Detecção de isentos

Palavras-chave:

- isento
- isenção
- hospital público
- sus
- gratuito
- cortesia
- encaminhamento público
- baixa renda
- bolsa família
- cadastro único
- atleta

## 9. Backup e Importação

### 9.1 `src/js/components/backup-manager.js`

- Rotas botões: exportar/importar.
- Três modos: full/database/dados.
- Merge inteligente via `mergeInteligenteBackup` + funcoes específicas.
- conserva histórico (`historicoAlteracoes`, `ultimaAtualizacao`).
- Depois de importação, pergunta para recarregar página.

### 9.2 Repositório/serviço backend

- `modules/backend/business/services/backup-service.js`: `generateBackup()` e `processRestore()`.
- `modules/backend/data/repositories/export-repository.js`: lê tabelas e gera JSON.
- `modules/backend/data/repositories/import-repository.js`: restaura via `DELETE` + `INSERT` (risky, mas simples).
- `modules/backend/data/services/database.js`: SQLite + transação.

### 9.3 API de backup

- GET `/api/backup/export` e `/export-tables`.
- POST `/api/backup/import` e `/import-tables`.

## 10. Extensões e integrações externas

### 10.1 Zenfisio Collector

- Coleta dados da agenda za Zenfisio.
- Exporta TXT estruturado.
- O `sidebar-new.js` parseia o TXT e produz registros para DataProcessor.

### 10.2 Zenfisio Presence Notifier

- Escuta mudanças na agenda (Google Chat etc).
- Encaminha mensagens automáticas ou alertas.

## 11. Riscos e melhorias identificadas

- Código misturado sem módulos ESM circulares (bundler manual). Reescrever com arquitetura `src/modules`.
- Validação de backup frágil (mesmo filename, checar fields melhores).
- `mergeInteligenteBackup` precisa de testes unitários robustos.
- Base em `localStorage` não escalar para multi-usuário; migrar para IndexedDB / backend.

## 12. Próximos passos do plano de reconstrução

1. Definir profile de arquitetura `1.0/2.0` (maestro em HTML/CSS/JS/Assets).
2. Implementar componente base de parser em `core/dataAnalyzer` com tests.
3. Reescrever `DataProcessor` mantendo regras 1x/2x/3x + isenção + banco pacientes.
4. Modularizar UI por página (`Evolucoes`, `Financeiro`, `Agendamentos`, `Pacientes`).
5. Manter API de eventos, mas incluir state manager (Redux/Mobx/observables).
6. Backup como microserviço opcional (API + localStorage sync).

## 13. Nota de memorização

Este arquivo é referência canônica. Toda vez que descobrirmos nova regra no `_oldversion`, atualizaremos aqui (e no sistema de memória persistente).


---

### Resumo rápido para leitura em 3 pontos:
1. O frontend é o núcleo; o backend apenas backup em SQLite.
2. `DataProcessor` + `DataAnalyzer` contêm toda lógica de negócio de atendimento.
3. O sistema é modular, usa eventos custom para comunicação entre páginas e suporta backup merge inteligente.


### 8.5 Proteção de dados editados manualmente

Pacientes editados manualmente recebiam um flag `editadoManualmente` para não serem sobrescritos por novos processamentos automáticos.

## 9. Página Inicial

### 9.1 Sidebar de entrada

A sidebar principal tinha:

- Botão de como usar.
- Seletor de data com dia anterior, próximo dia, mês anterior e hoje.
- Mensagem explicativa da data selecionada.
- Área de texto para processar dados.
- Importação TXT do Collector.
- Seletor de status quando a linha estava vazia.
- Botões de processar e limpar.

### 9.2 Modais e ações

O painel principal tinha modais para:

- Exportar backup.
- Importar backup.
- Limpeza parcial.
- Limpeza total.
- Histórico de versão.
- Termos de uso.
- Guia de uso.
- Análise rápida.

### 9.3 Área de módulos

Os módulos principais eram quatro:

- Evoluções Pendentes
- Análise Financeira
- Agendamentos
- Lista dos Pacientes

Além disso havia ações de:

- Exportar Backup
- Importar Backup
- Limpar Todos os Dados

## 10. Páginas Dedicadas

### 10.1 Evoluções

O módulo de evoluções em [src/pages/evolucoes.html](_oldversion/src/pages/evolucoes.html#L1) e [src/js/pages/evolucoes.js](_oldversion/src/js/pages/evolucoes.js#L1) tinha:

- Cards de total de pacientes e total de evoluções.
- Filtros por período.
- Abas de pacientes e especialidades.
- Busca global.
- Ordenação por nome e quantidade.
- Modal de detalhes.

Ele também reaproveitava a informação de evoluções já realizadas para remover itens concluídos.

### 10.2 Financeiro

O módulo financeiro em [src/pages/financeiro.html](_oldversion/src/pages/financeiro.html#L1) e [src/js/pages/financeiro.js](_oldversion/src/js/pages/financeiro.js#L1) tinha:

- Cards de pagantes, isentos e receita total.
- Abas de pacientes, procedimentos e especialidades gerais.
- Busca global.
- Ordenação por nome, valor e quantidade.
- Filtros rápidos e específicos por período.
- Modal de detalhes do paciente.

### 10.3 Agendamentos

O módulo de agendamentos em [src/pages/agendamentos.html](_oldversion/src/pages/agendamentos.html#L1) e [src/js/pages/agendamentos.js](_oldversion/src/js/pages/agendamentos.js#L1) tinha:

- Cards de atendidos, faltas e total.
- Tabs de pacientes atendidos e faltas.
- Ordenação por múltiplos critérios.
- Busca.
- Modal de filtros por período.
- Modal de detalhes com histórico individual.

O módulo tratava a data de referência do calendário como base para todos os filtros.

### 10.4 Pacientes

O módulo de pacientes em [src/pages/pacientes.html](_oldversion/src/pages/pacientes.html#L1) e [src/js/pages/pacientes.js](_oldversion/src/js/pages/pacientes.js#L1) era o banco mestre local.

Ele oferecia:

- Total de pacientes.
- Total de pagantes.
- Total de isentos.
- Busca por nome.
- Ordenação por nome e recência.
- Modal de visualização e edição.
- Remoção com confirmação.

## 11. Backup E Restauração

### 11.1 Frontend

O backup no frontend era mais completo e inteligente que a API backend.

Características:

- Exportação completa.
- Exportação apenas do banco de pacientes.
- Exportação apenas de dados sem pacientes.
- Importação completa com merge inteligente.
- Importação apenas de pacientes.
- Importação apenas de dados.
- Registro de histórico de backups importados.
- Preservação de dados editados manualmente e evoluções realizadas.

### 11.2 Backend

O backend tinha rotas para:

- Exportar backup.
- Exportar tabelas.
- Importar backup.
- Importar tabelas.

O serviço backend restaurava dados por transação e apagava conteúdo anterior antes de inserir o novo.

### 11.3 Observação importante

A lógica de backup do frontend era mais avançada que a do backend. Isso sugere que o backend estava mais para compatibilidade, segurança adicional e exportação serializada do que para ser a fonte principal de verdade.

## 12. Banco SQLite

O banco SQLite do backend criava tabelas para:

- users
- patients
- appointments
- clinics
- settings

Isso indica uma modelagem genérica de sistema clínico, mas não necessariamente totalmente integrada ao fluxo de operação diária do frontend.

## 13. Logger E Diagnóstico

O sistema tinha um logger local em [modules/backend/utils/logger.js](_oldversion/modules/backend/utils/logger.js#L1) e também um `LogManager` avançado no frontend.

O `LogManager` fazia:

- Interceptação de console.
- Rastreamento de erros globais.
- Rastreamento de eventos do usuário.
- Rastreamento de navegação.
- Rastreamento de rede.
- Salvamento periódico em localStorage.

Isso mostra uma preocupação alta com observabilidade da aplicação na máquina do usuário.

## 14. Tema E Interface

### 14.1 Tema

O sistema usava:

- Tema escuro como padrão.
- Alternância clara/escura persistida em `zenfisio-theme`.

### 14.2 Visual

Padrões visuais observados:

- Fundo escuro com elementos de brilho verde.
- Cards com sombras e bordas sutis.
- Botões com gradientes e feedback ao hover.
- Densidade visual alta.
- Hierarquia muito forte para operação rápida.

### 14.3 Tokens visuais

O design system usava variáveis centralizadas para:

- Cores de fundo.
- Cores de texto.
- Accent principal e secundário.
- Sombras.
- Espaçamentos.
- Tipografia.
- Border radius.

## 15. Componentes Relevantes

### 15.1 Header

O header tinha:

- Logo.
- Nome da aplicação.
- Toggle de tema.

### 15.2 Footer

O footer tinha:

- Análise.
- Versão.
- Termos.

### 15.3 Modais importantes

- VersionModal: histórico de atualizações.
- TermsModal: termos de uso e restrições.
- HowToUseModal: guia operacional com passos.
- AnalyzeModal: diagnóstico rápido do sistema.
- NotificationManager: toasts e modal de confirmação customizado.

### 15.4 Sidebar

A sidebar era o componente mais importante de entrada operacional, com seleção de data, importação TXT e processamento.

## 16. Análise Do Collector

O Zenfisio Collector era uma extensão de coleta para Chrome que:

- Monitorava o DOM da Zenfisio em segundo plano.
- Detectava popups e janelas de detalhes de agendamento.
- Extraía horário, paciente, fisioterapeuta, convênio, status, procedimento e valor.
- Tinha anti-duplicação por ID único e por lista recente.
- Exportava TXT formatado para importação no sistema principal.

O Collector tinha atalhos, feedback visual no navegador e persistência de estado para ficar ativo entre sessões.

## 17. Análise Do Presence Notifier

O Zenfisio Presence Notifier era uma extensão separada que:

- Trabalhava com `manifest v3`.
- Tinha service worker em background.
- Guardava estado de ativação em storage.
- Acompanhava uma aba do Google Chat ou Gmail/Chat.
- Enviava mensagens de presença confirmada ou cancelamento.
- Usava fila para entregas pendentes quando a aba ainda não estava pronta.

Ela tinha uma arquitetura mais moderna e mais fragmentada do que o resto do sistema antigo.

## 18. Contratos Técnicos Que Devem Ser Preservados No Rebuild

Estes pontos são especialmente importantes para o futuro sistema:

1. Chaves de localStorage já consolidadas.
2. Status normalizados e suas regras de consumo por módulo.
3. Banco de pacientes como fonte de correção e auto-preenchimento.
4. Marcações de evoluções realizadas por chave composta.
5. Merge inteligente de backups sem duplicar dados.
6. Exportação TXT do Collector como fonte de entrada primária.
7. Filtros por data de referência do calendário.
8. Integração por eventos customizados entre módulos.
9. Proteção de edições manuais do paciente.
10. Comunicação com Google Chat via extensão separada.

## 19. O Que A Base Antiga Não Mostra Completamente

Mesmo com a análise profunda, ainda há limites naturais do material antigo:

- Nem todas as funções do `sidebar-new.js` foram lidas integralmente.
- Alguns arquivos estavam truncados pela própria extensão do conteúdo disponível.
- Os testes antigos encontrados eram poucos e muito concentrados em backup.
- Parte da documentação do README tem tom mais comercial do que técnico.

Isso não impede a reconstrução, mas significa que algumas decisões terão que ser inferidas a partir do comportamento dominante e não de cada linha individual.

## 20. Resumo Final De Aprendizado

O sistema antigo era um conjunto operacional de clínica com estas características centrais:

- Entrada manual e importada de dados.
- Processamento local no navegador.
- Persistência local com `localStorage`.
- Banco auxiliar em SQLite no backend.
- Módulos separados por função clínica.
- Backup com merge inteligente.
- Coleta externa por extensão Chrome.
- Notificação externa por extensão Chrome.
- Forte foco em privacidade, autonomia e rapidez de operação.

Esse documento deve ser usado como base histórica para qualquer nova implementação do FisioHub.
