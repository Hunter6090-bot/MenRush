type PersonCard = {
  id: string;
  name: string;
  age: number;
  bioSnippet: string;
  distanceKm: number;
  interests: string[];
  online: boolean;
};

type WidgetPayload = {
  snapshotId: string;
  mode: string;
  people: PersonCard[];
};

type WidgetMeta = {
  peopleById?: Record<
    string,
    {
      id: string;
      name: string;
      age: number;
      bio: string;
      distanceKm: number;
      interests: string[];
      online: boolean;
      lastSeen?: string | null;
    }
  >;
  delivery?: {
    recipientId: string;
    recipientName?: string;
    message: string;
    sentAt: string;
  };
};

type ToolResultMessage = {
  structuredContent?: WidgetPayload;
  _meta?: WidgetMeta;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

declare global {
  interface Window {
    openai?: {
      toolOutput?: WidgetPayload;
      toolResponseMetadata?: WidgetMeta;
      widgetState?: { selectedPersonId?: string; draft?: string };
      setWidgetState?: (state: { selectedPersonId?: string; draft?: string }) => void;
      callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      sendFollowUpMessage?: (input: {
        prompt: string;
        scrollToBottom?: boolean;
      }) => Promise<void>;
      theme?: string;
    };
  }
}

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app root");
}

const state = {
  payload: (window.openai?.toolOutput ?? null) as WidgetPayload | null,
  meta: (window.openai?.toolResponseMetadata ?? null) as WidgetMeta | null,
  selectedPersonId: window.openai?.widgetState?.selectedPersonId ?? "",
  draft: window.openai?.widgetState?.draft ?? "",
  sending: false,
  lastSentText: ""
};

const pendingRequests = new Map<number, PendingRequest>();
let nextRpcId = 1;

function persistState(): void {
  window.openai?.setWidgetState?.({
    selectedPersonId: state.selectedPersonId,
    draft: state.draft
  });
}

function selectedPerson() {
  return state.meta?.peopleById?.[state.selectedPersonId] ?? null;
}

function rpcRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = nextRpcId++;
    pendingRequests.set(id, { resolve, reject });
    window.parent.postMessage(
      {
        jsonrpc: "2.0",
        id,
        method,
        params
      },
      "*"
    );
  });
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (window.openai?.callTool) {
    return window.openai.callTool(name, args);
  }

  return rpcRequest("tools/call", {
    name,
    arguments: args
  });
}

function render(): void {
  const payload = state.payload;
  const people = payload?.people ?? [];
  const selected = selectedPerson();
  const modeBadge = payload?.mode === "api" ? "Live API" : "Mock data";
  const cardMarkup = people
    .map((person) => {
      const isSelected = person.id === state.selectedPersonId;
      const interests = person.interests.slice(0, 3).map((interest) => `<span class="tag">${interest}</span>`).join("");
      return `
        <button class="card ${isSelected ? "card-active" : ""}" data-person-id="${person.id}" type="button">
          <div class="card-top">
            <div>
              <strong>${person.name}, ${person.age}</strong>
              <span>${person.distanceKm.toFixed(1)} km away</span>
            </div>
            <span class="presence ${person.online ? "presence-online" : "presence-away"}">
              ${person.online ? "Online" : "Recently active"}
            </span>
          </div>
          <p>${person.bioSnippet}</p>
          <div class="tags">${interests}</div>
        </button>
      `;
    })
    .join("");

  const detailMarkup = selected
    ? `
      <section class="detail">
        <div class="detail-header">
          <div>
            <h2>${selected.name}, ${selected.age}</h2>
            <p>${selected.distanceKm.toFixed(1)} km away</p>
          </div>
          <span class="presence ${selected.online ? "presence-online" : "presence-away"}">
            ${selected.online ? "Online now" : "Last seen " + formatRelative(selected.lastSeen)}
          </span>
        </div>
        <p class="detail-bio">${selected.bio}</p>
        <label class="composer">
          <span>Intro message</span>
          <textarea id="intro-draft" rows="4" maxlength="280" placeholder="Say something specific about what you noticed.">${escapeHtml(state.draft)}</textarea>
        </label>
        <div class="detail-actions">
          <button id="send-intro" class="primary" type="button" ${state.sending ? "disabled" : ""}>
            ${state.sending ? "Sending…" : "Send intro"}
          </button>
          <button id="ask-chatgpt" class="ghost" type="button">Ask ChatGPT to draft one</button>
        </div>
        ${
          state.lastSentText
            ? `<p class="notice">Sent to ${selected.name}: ${escapeHtml(state.lastSentText)}</p>`
            : ""
        }
      </section>
    `
    : `
      <section class="detail detail-empty">
        <h2>Pick a profile</h2>
        <p>Select a nearby person to see the full bio and send an intro without leaving ChatGPT.</p>
      </section>
    `;

  root.innerHTML = `
    <style>
      :root {
        color: #121212;
        font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(255, 194, 122, 0.35), transparent 42%),
          linear-gradient(160deg, #fff7ec 0%, #fffdf7 52%, #f3f7ff 100%);
      }
      .shell {
        padding: 16px;
        display: grid;
        gap: 16px;
      }
      .hero {
        border-radius: 20px;
        padding: 18px;
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(20, 33, 61, 0.08);
        box-shadow: 0 20px 50px rgba(33, 54, 88, 0.10);
      }
      .hero-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .eyebrow {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: #152238;
        color: #fff4df;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h1, h2, p { margin: 0; }
      .hero p {
        margin-top: 10px;
        color: #465064;
      }
      .grid {
        display: grid;
        gap: 14px;
      }
      .card,
      .detail {
        width: 100%;
        text-align: left;
        border-radius: 18px;
        border: 1px solid rgba(20, 33, 61, 0.10);
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 14px 32px rgba(33, 54, 88, 0.08);
      }
      .card {
        padding: 14px;
        cursor: pointer;
      }
      .card-active {
        border-color: #ef8e2f;
        transform: translateY(-1px);
      }
      .card-top,
      .detail-header,
      .detail-actions {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }
      .card strong,
      .detail h2 {
        display: block;
        font-size: 18px;
      }
      .card span,
      .detail p,
      .detail label span {
        color: #5c6577;
      }
      .card p {
        margin-top: 10px;
        color: #2f3642;
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .tag,
      .presence {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 12px;
      }
      .tag {
        background: #f2f4f8;
        color: #384053;
      }
      .presence-online {
        background: #dff8ea;
        color: #0a7a4b;
      }
      .presence-away {
        background: #f7eadc;
        color: #8d5919;
      }
      .detail {
        padding: 18px;
      }
      .detail-bio {
        margin-top: 12px;
        color: #273042;
        line-height: 1.5;
      }
      .composer {
        margin-top: 16px;
        display: grid;
        gap: 8px;
      }
      textarea {
        width: 100%;
        border: 1px solid #d5dbe5;
        border-radius: 14px;
        padding: 12px;
        resize: vertical;
        font: inherit;
        background: #ffffff;
      }
      .detail-actions {
        margin-top: 12px;
      }
      button.primary,
      button.ghost {
        border-radius: 999px;
        padding: 10px 14px;
        font: inherit;
        cursor: pointer;
      }
      button.primary {
        border: none;
        background: #152238;
        color: white;
      }
      button.ghost {
        border: 1px solid #d5dbe5;
        background: transparent;
        color: #152238;
      }
      .notice {
        margin-top: 12px;
        color: #0a7a4b;
        font-size: 14px;
      }
      .detail-empty {
        padding: 22px;
      }
      @media (min-width: 720px) {
        .shell {
          grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
          align-items: start;
        }
        .hero {
          grid-column: 1 / -1;
        }
      }
    </style>
    <main class="shell">
      <section class="hero">
        <div class="hero-top">
          <span class="eyebrow">NearNow</span>
          <span class="tag">${modeBadge}</span>
        </div>
        <h1>${people.length ? `${people.length} nearby people ready to review` : "No nearby people yet"}</h1>
        <p>Start with a short shortlist, then open one profile and send a focused intro from the widget.</p>
      </section>
      <section class="grid">${cardMarkup || `<div class="card"><p>No profiles matched the current filters.</p></div>`}</section>
      ${detailMarkup}
    </main>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-person-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPersonId = button.dataset.personId ?? "";
      state.lastSentText = "";
      persistState();
      render();
    });
  });

  const draftEl = root.querySelector<HTMLTextAreaElement>("#intro-draft");
  draftEl?.addEventListener("input", () => {
    state.draft = draftEl.value;
    persistState();
  });

  root.querySelector<HTMLButtonElement>("#ask-chatgpt")?.addEventListener("click", async () => {
    const person = selectedPerson();
    if (!person) {
      return;
    }

    await window.openai?.sendFollowUpMessage?.({
      prompt: `Draft a short, warm intro message for ${person.name}. Mention one of these interests if it fits naturally: ${person.interests.join(", ")}.`,
      scrollToBottom: true
    });
  });

  root.querySelector<HTMLButtonElement>("#send-intro")?.addEventListener("click", async () => {
    const payload = state.payload;
    const person = selectedPerson();
    if (!payload || !person || state.sending) {
      return;
    }

    state.sending = true;
    render();

    try {
      const response = (await callTool("send_intro_message", {
        snapshotId: payload.snapshotId,
        recipientId: person.id,
        message: state.draft
      })) as ToolResultMessage;

      state.lastSentText =
        response?.structuredContent && "message" in response.structuredContent
          ? String((response.structuredContent as Record<string, unknown>).message ?? state.draft)
          : state.draft;
      state.draft = "";
      persistState();
      render();
    } catch (error) {
      console.error("Failed to send intro message:", error);
      state.lastSentText = "Unable to send. Check server logs.";
      render();
    } finally {
      state.sending = false;
      render();
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRelative(value?: string | null): string {
  if (!value) {
    return "recently";
  }

  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window.parent) {
      return;
    }

    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") {
      return;
    }

    if (typeof message.id === "number") {
      const pending = pendingRequests.get(message.id);
      if (!pending) {
        return;
      }
      pendingRequests.delete(message.id);
      if (message.error) {
        pending.reject(message.error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method === "ui/notifications/tool-result") {
      const toolResult = message.params as ToolResultMessage;
      if (toolResult.structuredContent?.people) {
        state.payload = toolResult.structuredContent;
      }
      if (toolResult._meta) {
        state.meta = toolResult._meta;
      }
      render();
    }
  },
  { passive: true }
);

if (!state.selectedPersonId && state.payload?.people?.[0]?.id) {
  state.selectedPersonId = state.payload.people[0].id;
}

render();
