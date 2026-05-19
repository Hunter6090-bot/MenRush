# NearNow ChatGPT App

This subtree adds a docs-aligned ChatGPT Apps SDK scaffold for NearNow's nearby discovery flow.

## Archetype

Primary archetype: `interactive-decoupled`

Why:

- NearNow has repeated interaction around nearby profiles.
- The widget should stay mounted while a user reviews multiple people.
- The write action (`send_intro_message`) should stay UI-initiated and not force the model to remount the widget.

## Tool Plan

- `find_nearby_people`
  - Read-only data tool.
  - Returns a concise shortlist plus a `snapshotId`.
- `render_nearby_people`
  - Read-only render tool.
  - Takes a `snapshotId` and mounts the widget once.
- `send_intro_message`
  - UI-only write tool.
  - Sends a bounded message to a selected nearby profile.

## Repo Shape

```text
chatgpt-app/
├── package.json
├── README.md
├── server/
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── mockData.ts
│       ├── nearnowAdapter.ts
│       └── types.ts
└── web/
    ├── tsconfig.json
    └── src/
        └── widget.ts
```

## Modes

The server can run in two modes:

- `mock` (default): returns built-in sample nearby profiles so the app can run without the full NearNow backend.
- `api`: calls the existing NearNow REST API.

### Environment

```bash
PORT=8787
NEARNOW_SOURCE_MODE=mock
NEARNOW_API_BASE_URL=http://localhost:3000
NEARNOW_BEARER_TOKEN=replace-with-jwt-for-api-mode
CHATGPT_APP_WIDGET_DOMAIN=https://your-app.example.com
```

Only `PORT` is needed in mock mode.

## Local Run

Install dependencies:

```bash
cd chatgpt-app
npm install
```

Build:

```bash
npm run build
```

Run in dev mode:

```bash
npm run dev
```

Run compiled server:

```bash
npm run start
```

Health checks:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/
```

## ChatGPT Developer Mode

1. Start the app locally on `http://localhost:8787/mcp`.
2. Expose it with a public HTTPS tunnel, for example:

```bash
ngrok http 8787
```

3. In ChatGPT, enable **Settings → Apps & Connectors → Advanced settings → Developer Mode**.
4. Create a new app using `https://<your-tunnel>.ngrok.app/mcp`.
5. Refresh the app after tool or metadata changes.

Suggested prompt:

```text
Find nearby people around 51.5074, -0.1278 within 5 km, then show the NearNow widget.
```

## Validation Ladder

Target checks for this scaffold:

- Level 0: repo contract review
- Level 1: `npm run typecheck`
- Level 2: `npm run build` and `curl /health`
- Level 3: MCP Inspector and ChatGPT Developer Mode via HTTPS tunnel

This repo includes the scripts and routes needed for all four levels, but only the levels actually run should be reported in the final handoff.

## Docs Used

- https://developers.openai.com/apps-sdk/build/mcp-server/
- https://developers.openai.com/apps-sdk/build/chatgpt-ui/
- https://developers.openai.com/apps-sdk/build/examples/
- https://developers.openai.com/apps-sdk/plan/tools/
- https://developers.openai.com/apps-sdk/reference/
- https://developers.openai.com/apps-sdk/quickstart/
