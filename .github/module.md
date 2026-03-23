# Module.md - Arvore Genealogica de Modularizacao do Novo FisioHub

Este documento define a base estrutural do novo sistema FisioHub. A escolha tecnica consolidada para a nova implementacao e:

- TypeScript como linguagem principal de todo o sistema
- HTML para estrutura de interface
- CSS/SCSS para apresentacao
- SQL para dados e consultas
- Python apenas como opcional para automacoes, relatorios avancados ou IA futura

O objetivo e manter a base funcional do sistema antigo, mas com organizacao muito superior, menor chance de bugs, escalabilidade real e manutencao simples.

## 1.0_HTML-Templates

Responsavel por toda a camada de estrutura visual em HTML.

### Estrutura

- 1.0/ master.html
- 1.1/ pages/
- 1.2/ components/
- 1.3/ layouts/

### Exemplos

- 1.1.1/ pages/home.html
- 1.1.2/ pages/evolucoes.html
- 1.1.3/ pages/financeiro.html
- 1.1.4/ pages/agendamentos.html
- 1.1.5/ pages/pacientes.html
- 1.2.1/ components/header.html
- 1.2.2/ components/sidebar.html
- 1.2.3/ components/footer.html
- 1.2.4/ components/modal-backup.html
- 1.3.1/ layouts/app-shell.html

## 2.0_CSS-Styles

Responsavel pela identidade visual, layout, responsividade e temas.

### Estrutura

- 2.0/ master.scss
- 2.1/ base/
- 2.2/ tokens/
- 2.3/ pages/
- 2.4/ components/
- 2.5/ utilities/

### Exemplos

- 2.1.1/ base/reset.scss
- 2.1.2/ base/typography.scss
- 2.1.3/ base/animations.scss
- 2.2.1/ tokens/colors.scss
- 2.2.2/ tokens/spacing.scss
- 2.2.3/ tokens/breakpoints.scss
- 2.3.1/ pages/home.scss
- 2.3.2/ pages/evolucoes.scss
- 2.3.3/ pages/financeiro.scss
- 2.3.4/ pages/agendamentos.scss
- 2.3.5/ pages/pacientes.scss
- 2.4.1/ components/header.scss
- 2.4.2/ components/sidebar.scss
- 2.4.3/ components/modal.scss
- 2.4.4/ components/notification.scss
- 2.5.1/ utilities/display.scss
- 2.5.2/ utilities/spacing.scss

## 3.0_TypeScript-Logic

Responsavel por toda a regra de negocio, estado, integracao e comunicacao entre modulos.

### Estrutura

- 3.0/ master.ts
- 3.1/ core/
- 3.2/ domain/
- 3.3/ application/
- 3.4/ infrastructure/
- 3.5/ ui/
- 3.6/ shared/

### Exemplos

- 3.1.1/ core/events.ts
- 3.1.2/ core/logger.ts
- 3.1.3/ core/theme-manager.ts
- 3.1.4/ core/notification-manager.ts
- 3.2.1/ domain/atendimento.ts
- 3.2.2/ domain/paciente.ts
- 3.2.3/ domain/evolucao.ts
- 3.2.4/ domain/backup.ts
- 3.2.5/ domain/status.ts
- 3.3.1/ application/data-analyzer.ts
- 3.3.2/ application/data-processor.ts
- 3.3.3/ application/backup-service.ts
- 3.3.4/ application/import-service.ts
- 3.3.5/ application/export-service.ts
- 3.3.6/ application/patient-service.ts
- 3.3.7/ application/finance-service.ts
- 3.3.8/ application/agendamento-service.ts
- 3.3.9/ application/evolucao-service.ts
- 3.4.1/ infrastructure/local-storage-adapter.ts
- 3.4.2/ infrastructure/indexeddb-adapter.ts
- 3.4.3/ infrastructure/sqlite-adapter.ts
- 3.4.4/ infrastructure/http-client.ts
- 3.5.1/ ui/app-shell.ts
- 3.5.2/ ui/sidebar-controller.ts
- 3.5.3/ ui/modules-controller.ts
- 3.5.4/ ui/modal-controller.ts
- 3.6.1/ shared/constants.ts
- 3.6.2/ shared/types.ts
- 3.6.3/ shared/utils.ts

## 4.0_(Backend)

Responsavel por servicos server-side, autenticacao futura, persistencia e integracoes.

### Estrutura

- 4.0/ master.ts
- 4.1/ api/
- 4.2/ services/
- 4.3/ repositories/
- 4.4/ jobs/
- 4.5/ middleware/

### Exemplos

- 4.1.1/ api/server.ts
- 4.1.2/ api/routes/backup.routes.ts
- 4.1.3/ api/routes/patients.routes.ts
- 4.1.4/ api/routes/atendimentos.routes.ts
- 4.2.1/ services/backup-orchestrator.ts
- 4.2.2/ services/report-service.ts
- 4.2.3/ services/audit-service.ts
- 4.3.1/ repositories/patient-repository.ts
- 4.3.2/ repositories/attendance-repository.ts
- 4.3.3/ repositories/backup-repository.ts
- 4.4.1/ jobs/auto-backup.job.ts
- 4.5.1/ middleware/error-handler.ts
- 4.5.2/ middleware/auth.ts

## 5.0_(SQL_Data)

Responsavel pela modelagem e manutencao da estrutura de dados.

### Estrutura

- 5.0/ schema.sql
- 5.1/ migrations/
- 5.2/ seeds/
- 5.3/ views/
- 5.4/ indexes/

### Tabelas principais sugeridas

- patients
- attendances
- evolutions
- backups
- settings
- logs
- users se houver autenticacao

## 6.0_(Python_Optional)

Camada opcional para funcionalidades futuras que nao precisem ficar no fluxo principal.

### Uso sugerido

- automacao de relatórios
- analise preditiva de faltas
- processamento inteligente de dados
- IA e auxiliares administrativos

### Estrutura

- 6.0/ master.py
- 6.1/ services/
- 6.2/ scripts/
- 6.3/ ml/

## 7.0_(Assets)

Responsavel por imagens, icones, fontes e recursos estaticos.

### Estrutura

- 7.0/ images/
- 7.1/ icons/
- 7.2/ fonts/
- 7.3/ illustrations/

## 8.0_(Tests)

Responsavel por garantir qualidade, previsibilidade e evolucao segura.

### Estrutura

- 8.0/ master.test.ts
- 8.1/ unit/
- 8.2/ integration/
- 8.3/ e2e/

### Foco dos testes

- parser de TXT
- processamento de dados
- merge de backups
- calculo financeiro
- persistencia de pacientes
- eventos entre modulos

## 9.0_(Regras_de_Arquitetura)

### Principios obrigatorios

- um arquivo por responsabilidade unica
- nomes descritivos e previsiveis
- separacao entre dominio, aplicacao e infraestrutura
- nada de logica de negocio espalhada em telas
- frontend fala com servicos, nunca com regra de negocio diretamente
- backup deve manter compatibilidade com o legado enquanto durar a migracao
- todo modulo deve ter master proprio

### Direcionamento tecnico

- TypeScript em tudo que for logica
- HTML para estrutura semantica
- SCSS para organizacao visual e escalabilidade de tema
- SQL para persistencia confiavel
- Python so entra se houver ganho real de automacao ou analise

## 10.0_(Mapa_do_Novo_Sistema)

### Fluxo ideal

1. HTML monta a estrutura da interface.
2. SCSS controla o visual e a responsividade.
3. TypeScript recebe eventos e executa a regra de negocio.
4. SQL guarda os dados de forma segura e indexada.
5. Backend integra, valida, expõe API e executa tarefas de suporte.
6. Python fica isolado para automacoes especificas.

### Resultado esperado

- menos bugs pequenos
- manutencao previsivel
- crescimento modular
- melhor testabilidade
- maior clareza para evolucao futura
- compatibilidade conceitual com o sistema antigo sem repetir os problemas dele

## 11.0_(Memoria_Tecnica)

Este arquivo e a referencia principal da arquitetura planejada do FisioHub.
Sempre que descobrirmos algo novo sobre o legado, este documento deve ser atualizado para manter a base viva para o novo sistema.