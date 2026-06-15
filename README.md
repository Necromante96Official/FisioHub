# FisioHub

Sistema local para organizar dados operacionais da Clinica de Fisioterapia ESEFID/UFRGS, com apoio de extensoes Chrome para coleta e notificacoes do ZenFisio.

## Uso Local

```powershell
npm install
npm run dev
```

Abra `http://127.0.0.1:4173/index.html#/home`.

Rotas principais:

- `index.html#/home`
- `index.html#/pacientes`
- `index.html#/evolucoes`
- `index.html#/agendamentos`
- `index.html#/financeiro`
- `index.html#/registro`

## Validacao

```powershell
npm run check
npm run test
npm run check:extension
```

`npm run check` roda typecheck e build do app principal. `npm run test` valida parsers, regras pequenas e o nucleo do coletor. `npm run check:extension` valida, testa e compila a extensao de notificacoes.

## GitHub Pages

O deploy deve manter `index.html` na raiz. A aplicacao usa rotas por hash, entao a GitHub Pages nao precisa de configuracao especial para cada tela.

Antes de publicar:

```powershell
npm run check
npm run test
npm run check:extension
```

Depois confirme que a raiz contem `index.html` e que os assets estao em `assets/images`.

## Extensoes Chrome

### `zenfisio-ColetorDeDados`

Extensao de coleta dos dados de agendamentos do ZenFisio.

Validacao automatizada:

```powershell
npm run test
```

Para carregar no Chrome:

1. Abra `chrome://extensions`.
2. Ative o modo do desenvolvedor.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `zenfisio-ColetorDeDados`.

### `zenfisio-NotificarMensagens`

Extensao que monitora status no ZenFisio e auxilia no envio de mensagens no Google Chat.

Para preparar:

```powershell
npm --prefix zenfisio-NotificarMensagens install
npm --prefix zenfisio-NotificarMensagens run test
npm --prefix zenfisio-NotificarMensagens run build
```

Para carregar no Chrome, selecione a pasta `zenfisio-NotificarMensagens` em `Carregar sem compactacao`.

## Smoke Test Manual

Antes de publicar ou entregar uma nova versao:

- Abrir `index.html#/home` e confirmar titulo, rodape e versao.
- Navegar para `Pacientes`, `Evolucoes`, `Agendamentos`, `Financeiro` e `Registro`.
- Importar um conjunto pequeno de dados reais ou anonimizados.
- Conferir se Pacientes mostra contagens e detalhes corretamente.
- Abrir detalhes de paciente e testar o link do WhatsApp quando houver celular valido.
- Conferir Evolucoes Pendentes e Agendamentos com a data de referencia.
- Conferir Financeiro e gerar Analise.
- Testar backup/exportacao e importacao de backup.
- Recarregar as duas extensoes no Chrome e verificar se os manifests mostram a versao atual.

