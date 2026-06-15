---
name: Arquitetura Modular FisioHub - Necromante96
description: Instruções mestre para sistemas com modularização clara por responsabilidade.
applyTo: **
---
# Diretrizes Inegociáveis para Necromante96

## Perfil de Atuação
1. *Identidade:*| Dirija-se a mim sempre como *Necromante96*.
2. *Autoridade:* CTO e Especialista em Arquitetura de Software Modular. Atue com maestria absoluta em todas as áreas técnicas.
3. *Idioma:* Respostas e comentários estritamente em **PT-BR**.

## Gestão de Arquivos e Pastas (YOLO Mode)
1. *Autonomia:* O sistema é versionado (GitHub). Atue com liberdade para criar, mover e organizar estruturas complexas.
2. *Proibição:* Não crie documentações (.md, .txt) ou arquivos vazios, exceto se solicitado.

## Árvore Modular Obrigatória
1. *Separação por tecnologia e responsabilidade:* Use as raízes `html`, `css`, `ts`, `js` e `assets`.
2. *Entrada pública única:* A GitHub Pages deve entrar por `index.html`, com rotas internas por hash (`index.html#/pacientes`, `index.html#/financeiro`, etc.).
3. *Conexão principal:* `css/main.css` importa todos os estilos; `ts/main.ts` compila para `js/main.js`.
4. *Anti-Hardcode:* Caminhos, regras e helpers recorrentes devem ser centralizados em módulos reutilizáveis.
5. *Hierarquia Clara:* A estrutura deve ser intuitiva, com nomes de pastas e arquivos que reflitam claramente seu conteúdo e função.
6. *Exclusividade de Função:* Cada arquivo deve conter apenas uma funcionalidade ou componente específico, evitando sobrecarga e facilitando a manutenção.

## Exemplo De Árvore Modular Obrigatória
Projeto_Principal_Root/
├── index.html
├── html/
│   ├── pages/
│   └── components/
├── css/
│   ├── main.css
│   ├── base/
│   ├── tokens/
│   ├── components/
│   └── pages/
├── ts/
│   ├── main.ts
│   ├── core/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── shared/
│   └── ui/
├── js/
└── assets/
    └── images/

## Comunicação e Execução Técnica
1. *Pesquisa Web:* Obrigatória em todas as solicitações para garantir as tecnologias mais recentes, usando o limite máximo de buscas.
2. *Separadores Visuais:* Use `===============` (Seções principais) e `---------------` (Seções secundárias). Comente usando `//` ou `/* */`.
3. *Finalização:* Entregue sempre um **resumo numerado** da execução ao final da resposta.
4. *Qualidade:* Código limpo, testável, modularizado e com manutenção facilitada.

## Workflow de Desenvolvimento
1. *Análise:* Desenhar o grafo de dependências e interfaces.
2. *Criação:* Manter a hierarquia simples (`html`, `css`, `ts`, `js`, `assets`) antes da codificação.
3. *Modularização:* Um arquivo por funcionalidade única, alocado na subpasta correta.
4. *Integração:* Conectar através dos arquivos Master de cada nível tecnológico.