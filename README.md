# CCB Agenda (Deploy completo)

Este projeto:
- Serve o seu HTML (layout original) na rota `/`
- Expõe uma API `/api/events` que lê os eventos do Google Sheets (via CSV publicado)
- Expõe uma API `/api/admin` que encaminha create/update/delete para o Apps Script (sem CORS no browser)
- Inclui PWA (manifest + service worker + ícones do seu logo)

## 1) Pré-requisitos
- Node.js 18+ (recomendado)
- A planilha deve ter cabeçalho com: `DATA`, `HORA`, `EVENTO`, `DESTAQUE` e (recomendado) `DEPARTAMENTO`

## 2) Publicar CSV da planilha (somente leitura)
No Google Sheets:
Arquivo → Compartilhar/ Publicar na web → selecione a aba **Agenda** → formato **CSV**.

Depois copie a URL gerada (CSV) e coloque em `SHEET_CSV_URL`.

## 3) Configurar variáveis de ambiente
Crie `.env.local` na raiz (ou configure no Vercel) com base em `.env.example`:

- `SHEET_CSV_URL`
- `APPS_SCRIPT_URL`
- `ADMIN_KEY`

## 4) Rodar local
```bash
npm install
npm run dev
```

## 5) Deploy na Vercel
- Importe o repositório/projeto na Vercel
- Em **Project Settings → Environment Variables**, configure as 3 variáveis:
  - `SHEET_CSV_URL`
  - `APPS_SCRIPT_URL`
  - `ADMIN_KEY`
- Deploy

Docs oficiais (Vercel env vars): https://vercel.com/docs/projects/environment-variables

## 6) Admin no celular
No seu app (site), use o botão/área de admin que já existe no HTML para criar/editar/excluir.
A API `/api/admin` injeta a `ADMIN_KEY` automaticamente.

## Referências confiáveis
- Web App no Apps Script: https://developers.google.com/apps-script/guides/web
- Authorization no Apps Script: https://developers.google.com/apps-script/guides/services/authorization
- PWA instalável (MDN): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Web App Manifest (MDN): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
