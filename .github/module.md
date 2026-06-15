# Module.md - Arquitetura Modular Do FisioHub

Este documento define a base estrutural do sistema FisioHub. A escolha tecnica consolidada para a implementacao atual e:

- TypeScript como linguagem principal de todo o sistema
- HTML para estrutura de interface
- CSS/SCSS para apresentacao
- SQL para dados e consultas
- Python apenas como opcional para automacoes, relatorios avancados ou IA futura

O objetivo e manter a base funcional do sistema antigo, mas com organizacao muito superior, menor chance de bugs, escalabilidade real e manutencao simples.

## html

Responsavel por toda a camada de estrutura visual em HTML.

### Estrutura

- html/pages/
- html/components/
- html/components/layout/

### Exemplos

- html/pages/home.html
- html/pages/evolucoes.html
- html/pages/financeiro.html
- html/pages/agendamentos.html
- html/pages/pacientes.html
- html/components/layout/header.html
- html/components/layout/sidebar.html
- html/components/layout/footer.html

## css

Responsavel pela identidade visual, layout, responsividade e temas.

### Estrutura

- css/main.css
- css/base/
- css/tokens/
- css/pages/
- css/components/

### Exemplos

- css/base/reset.css
- css/base/typography.css
- css/tokens/colors.css
- css/tokens/spacing.css
- css/pages/home.css
- css/pages/evolucoes.css
- css/pages/financeiro.css
- css/pages/agendamentos.css
- css/pages/pacientes.css
- css/components/header.css
- css/components/sidebar.css
- css/components/footer.css

## ts

Responsavel por toda a regra de negocio, estado, integracao e comunicacao entre modulos.

### Estrutura

- ts/main.ts
- ts/core/
- ts/domain/
- ts/application/
- ts/infrastructure/
- ts/ui/
- ts/shared/

### Exemplos

- ts/core/theme-manager.ts
- ts/domain/fisiohub-models.ts
- ts/domain/appointment-parser.ts
- ts/domain/procedure-parser.ts
- ts/application/analysis-report.ts
- ts/infrastructure/template-loader.ts
- ts/shared/ui-feedback.ts
- ts/ui/home-controller.ts
- ts/ui/patients-controller.ts
- ts/ui/financeiro-controller.ts

## js

Responsavel pela saida compilada do TypeScript.

### Estrutura

- js/main.js
- js/core/
- js/domain/
- js/application/
- js/infrastructure/
- js/shared/
- js/ui/

## Backend Futuro

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

## SQL Data Futuro

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

## Python Optional Futuro

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

## assets

Responsavel por imagens, icones, fontes e recursos estaticos.

### Estrutura

- assets/images/
- assets/icons/
- assets/fonts/

## Tests Futuro

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