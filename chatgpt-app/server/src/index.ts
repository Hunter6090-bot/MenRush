import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import { findNearbyPeople, sendIntroMessage } from "./nearnowAdapter.js";
import type { NearbySearchInput, SnapshotRecord } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const widgetBundlePath = path.resolve(projectRoot, "web", "dist", "widget.js");

const PORT = Number(process.env.PORT ?? "8787");
const MCP_PATH = "/mcp";
const TEMPLATE_URI = "ui://widget/nearnow-nearby-v1.html";
const widgetDomain = process.env.CHATGPT_APP_WIDGET_DOMAIN;

const snapshots = new Map<string, SnapshotRecord>();

function loadWidgetBundle(): string {
  return readFileSync(widgetBundlePath, "utf8");
}

function buildWidgetHtml(): string {
  const widgetJs = loadWidgetBundle();
  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />",
    "  <title>NearNow Nearby</title>",
    "</head>",
    "<body>",
    "  <div id=\"app\"></div>",
    `  <script type="module">${widgetJs}</script>`,
    "</body>",
    "</html>"
  ].join("\n");
}

function saveSnapshot(search: NearbySearchInput, result: Awaited<ReturnType<typeof findNearbyPeople>>): SnapshotRecord {
  const snapshot: SnapshotRecord = {
    id: `snapshot-${randomUUID()}`,
    createdAt: new Date().toISOString(),
    search,
    result
  };
  snapshots.set(snapshot.id, snapshot);
  return snapshot;
}

function getSnapshotOrThrow(snapshotId: string): SnapshotRecord {
  const snapshot = snapshots.get(snapshotId);
  if (!snapshot) {
    throw new Error(`Unknown snapshot: ${snapshotId}`);
  }
  return snapshot;
}

function toSummaryText(snapshot: SnapshotRecord): string {
  if (!snapshot.result.people.length) {
    return "No nearby profiles matched the current filters.";
  }

  const first = snapshot.result.people[0];
  return `Found ${snapshot.result.people.length} nearby profiles. Closest match is ${first.name}, ${first.age}, about ${first.distanceKm.toFixed(1)} km away.`;
}

function createStructuredSnapshot(snapshot: SnapshotRecord) {
  return {
    snapshotId: snapshot.id,
    mode: snapshot.result.mode,
    origin: snapshot.result.origin,
    people: snapshot.result.people.map((person) => ({
      id: person.id,
      name: person.name,
      age: person.age,
      bioSnippet: person.bioSnippet,
      distanceKm: person.distanceKm,
      interests: person.interests,
      online: person.online
    }))
  };
}

function createWidgetMeta(snapshot: SnapshotRecord) {
  return {
    peopleById: Object.fromEntries(
      snapshot.result.people.map((person) => [person.id, person])
    ),
    snapshotCreatedAt: snapshot.createdAt,
    sourceMode: snapshot.result.mode
  };
}

function createAppServer(): McpServer {
  const server = new McpServer(
    { name: "nearnow-chatgpt-app", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  registerAppResource(
    server,
    "nearnow-nearby-widget",
    TEMPLATE_URI,
    {},
    async () => ({
      contents: [
        {
          uri: TEMPLATE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: buildWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: []
              },
              ...(widgetDomain ? { domain: widgetDomain } : {})
            },
            "openai/widgetDescription":
              "Shows nearby NearNow profiles in an interactive card stack with intro-message actions."
          }
        }
      ]
    })
  );

  registerAppTool(
    server,
    "find_nearby_people",
    {
      title: "Find nearby people",
      description:
        "Use this when you need a concise, read-only snapshot of NearNow profiles near a location before deciding whether to render the widget.",
      inputSchema: {
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: z.number().min(1).max(50).default(5),
        minAge: z.number().int().min(18).max(99).optional(),
        maxAge: z.number().int().min(18).max(99).optional(),
        interests: z.array(z.string().min(1)).max(6).optional(),
        limit: z.number().int().min(1).max(12).default(6)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      },
      _meta: {
        "openai/toolInvocation/invoking": "Checking nearby profiles…",
        "openai/toolInvocation/invoked": "Nearby snapshot ready."
      }
    },
    async ({ lat, lng, radiusKm = 5, minAge, maxAge, interests, limit = 6 }) => {
      const search: NearbySearchInput = {
        lat,
        lng,
        radiusKm,
        minAge,
        maxAge,
        interests,
        limit
      };
      const result = await findNearbyPeople(search);
      const snapshot = saveSnapshot(search, result);

      return {
        structuredContent: createStructuredSnapshot(snapshot),
        content: [{ type: "text", text: toSummaryText(snapshot) }],
        _meta: createWidgetMeta(snapshot)
      };
    }
  );

  registerAppTool(
    server,
    "render_nearby_people",
    {
      title: "Render nearby people widget",
      description:
        "Use this when you already have a snapshot from find_nearby_people and want to show the interactive NearNow widget.",
      inputSchema: {
        snapshotId: z.string().min(1)
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      },
      _meta: {
        ui: { resourceUri: TEMPLATE_URI },
        "openai/outputTemplate": TEMPLATE_URI,
        "openai/toolInvocation/invoking": "Opening nearby profiles…",
        "openai/toolInvocation/invoked": "Nearby profiles ready."
      }
    },
    async ({ snapshotId }) => {
      const snapshot = getSnapshotOrThrow(snapshotId);
      return {
        structuredContent: createStructuredSnapshot(snapshot),
        content: [{ type: "text", text: toSummaryText(snapshot) }],
        _meta: createWidgetMeta(snapshot)
      };
    }
  );

  registerAppTool(
    server,
    "send_intro_message",
    {
      title: "Send intro message",
      description:
        "Use this when the widget user has chosen a nearby profile and wants to send a short introductory message without leaving ChatGPT.",
      inputSchema: {
        snapshotId: z.string().min(1),
        recipientId: z.string().min(1),
        message: z.string().min(1).max(280)
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/toolInvocation/invoking": "Sending intro…",
        "openai/toolInvocation/invoked": "Intro sent."
      }
    },
    async ({ snapshotId, recipientId, message }) => {
      const snapshot = getSnapshotOrThrow(snapshotId);
      const recipient = snapshot.result.people.find((person) => person.id === recipientId);
      if (!recipient) {
        throw new Error(`Recipient ${recipientId} is not part of snapshot ${snapshotId}`);
      }

      const sent = await sendIntroMessage(recipientId, message, recipient.name);
      return {
        structuredContent: {
          snapshotId,
          recipientId,
          recipientName: sent.recipientName ?? recipient.name,
          message: sent.message,
          sentAt: sent.sentAt,
          mode: sent.mode
        },
        content: [
          {
            type: "text",
            text: `Sent an intro message to ${sent.recipientName ?? recipient.name}.`
          }
        ],
        _meta: {
          delivery: sent
        }
      };
    }
  );

  return server;
}

function writeCorsHeaders(res: import("node:http").ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
}

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const isMcpPath = url.pathname === MCP_PATH || url.pathname.startsWith(`${MCP_PATH}/`);

  if (req.method === "OPTIONS" && isMcpPath) {
    writeCorsHeaders(res);
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("NearNow ChatGPT app server");
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, mcpPath: MCP_PATH }));
    return;
  }

  if (isMcpPath && req.method && ["GET", "POST", "DELETE"].includes(req.method)) {
    writeCorsHeaders(res);

    const server = createAppServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Failed to handle MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

httpServer.listen(PORT, () => {
  console.log(`NearNow ChatGPT app listening on http://localhost:${PORT}${MCP_PATH}`);
});
