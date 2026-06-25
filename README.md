# DigChat — Chatbot WhatsApp da FIBRON

Plataforma de atendimento via **WhatsApp Cloud API (Meta)** com fluxos visuais,
inbox com handoff humano e integração com o ERP **IXC**.

**Stack:** Laravel 12 · Inertia.js + React 18 + TypeScript · Tailwind + shadcn/ui ·
Laravel Reverb (realtime) · MariaDB · React Flow (editor de fluxos).

## Requisitos

- PHP 8.2+, Node 20+, MariaDB. Composer é usado **localmente** (`composer.phar`).

## Instalação

```bash
# Dependências
php composer.phar install
npm install

# Ambiente
cp .env.example .env        # já versionado com chaves; ajuste credenciais
php artisan key:generate

# Banco (cria o schema e o usuário admin + fluxo de exemplo)
php artisan migrate:fresh --seed
```

Login inicial: **admin@fibron.com.br / password**

## Executando (4 processos)

```bash
npm run dev                 # Vite (assets)
php artisan serve           # App HTTP
php artisan queue:work      # Processa webhooks (fila 'database')
php artisan reverb:start    # WebSocket (inbox em tempo real)
```

## Configuração do WhatsApp (Meta)

No `.env`:

```
WHATSAPP_PHONE_NUMBER_ID=...   # número de teste do painel Meta
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=digchat-verify
WHATSAPP_APP_SECRET=...         # opcional; valida assinatura do webhook
```

1. Exponha o app: `ngrok http 8000`.
2. No painel Meta (WhatsApp > Configuration), cadastre o webhook:
   - **Callback URL:** `https://SEU-NGROK/api/webhooks/whatsapp`
   - **Verify token:** o mesmo de `WHATSAPP_VERIFY_TOKEN`
   - Assine o campo **messages**.
3. Adicione números de teste autorizados (modo sandbox da Meta).

## Configuração do IXC

```
IXC_HOST=https://SEU-IXC          # base do servidor IXC
IXC_TOKEN=1:hash_do_token         # formato "id:hash" (Basic auth)
```

Ações disponíveis nos nós de fluxo: consultar cliente, 2ª via de boleto,
status de conexão, desbloqueio em confiança e abrir chamado/OS.

## Estrutura

- **Papéis:** admin, gestor, atendente (`role:` middleware). Cadastro só interno.
- **Atendimento** (`/inbox`): lista + thread + handoff (assumir/devolver/encerrar), realtime via Reverb.
- **Fluxos** (`/flows`): editor visual (React Flow). Motor de execução em `app/Services/Flow/FlowEngine.php`.
- **WhatsApp:** `app/Services/WhatsApp/`, webhook em `app/Http/Controllers/WhatsAppWebhookController.php`,
  processamento em `app/Jobs/ProcessInboundMessage.php`.
- **IXC:** `app/Services/Ixc/`.

## Testes

```bash
php artisan test
```
# digchat
