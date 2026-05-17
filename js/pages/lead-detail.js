// ============================================================
// Lead Detail Drawer
// ============================================================
import { fetchConversationsForPhone, fetchInteractionsForLead } from "../api.js";
import { escapeHtml, formatDateTime, formatRelative, whatsappLink, stageMeta, toast } from "../utils.js";

let openLead = null;

export function init() {
  // Close handlers
  document.querySelectorAll("[data-close-drawer]").forEach(el => {
    el.addEventListener("click", close);
  });
  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  // Keyboard ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("lead-drawer").classList.contains("hidden")) {
      close();
    }
  });
}

export async function open(lead) {
  openLead = lead;
  document.getElementById("drawer-name").textContent = lead.parent_name || "Sin nombre";
  document.getElementById("drawer-meta").innerHTML = `
    <span class="mono">${escapeHtml(lead.phone)}</span>
    · ${stageBadge(lead.lead_stage)}
    ${lead.human_required ? ' · <span class="badge badge-human">👤 Humano</span>' : ""}
  `;
  document.getElementById("lead-drawer").classList.remove("hidden");
  switchTab("conversation");
  renderInfo(lead);
  renderActions(lead);
  await loadConversation(lead);
  await loadActivity(lead);
}

export function close() {
  document.getElementById("lead-drawer").classList.add("hidden");
  openLead = null;
}

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + name));
}

function stageBadge(stage) {
  const m = stageMeta(stage);
  return `<span class="badge badge-stage-${stage || "new"}">${escapeHtml(m.label)}</span>`;
}

function renderInfo(lead) {
  const panel = document.getElementById("tab-info");
  panel.innerHTML = `
    <dl class="info-grid">
      <dt>Teléfono</dt>          <dd><span class="mono">${escapeHtml(lead.phone)}</span></dd>
      <dt>Nombre padre</dt>      <dd>${escapeHtml(lead.parent_name) || '<span class="dim">—</span>'}</dd>
      <dt>Nombre peque</dt>      <dd>${escapeHtml(lead.child_name) || '<span class="dim">—</span>'}</dd>
      <dt>Edad peque</dt>        <dd>${lead.child_age ?? '<span class="dim">—</span>'}</dd>
      <dt>Programa interés</dt>  <dd>${escapeHtml(lead.program_interest) || '<span class="dim">—</span>'}</dd>
      <dt>Etapa</dt>             <dd>${stageBadge(lead.lead_stage)}</dd>
      <dt>Lead score</dt>        <dd>${lead.lead_score ?? 0}</dd>
      <dt>Idioma</dt>            <dd>${escapeHtml(lead.language) || "es"}</dd>
      <dt>Último intent</dt>     <dd>${escapeHtml(lead.last_intent) || '<span class="dim">—</span>'}</dd>
      <dt>Último agente</dt>     <dd>${escapeHtml(lead.last_agent) || '<span class="dim">—</span>'}</dd>
      <dt>Humano activo</dt>     <dd>${lead.human_required ? "Sí" : "No"}</dd>
      <dt>Último mensaje</dt>    <dd>${formatDateTime(lead.last_message_at)}</dd>
      <dt>Creado</dt>            <dd>${formatDateTime(lead.created_at)}</dd>
      <dt>Notas internas</dt>    <dd>${lead.notes ? escapeHtml(lead.notes) : '<span class="dim">Sin notas</span>'}</dd>
    </dl>
  `;
}

function renderActions(lead) {
  const el = document.getElementById("drawer-actions");
  const wa = whatsappLink(lead.phone);
  el.innerHTML = `
    <a class="btn btn-primary" href="${wa}" target="_blank" rel="noopener">
      💬 Abrir WhatsApp
    </a>
    <button class="btn-secondary" id="copy-phone-btn">
      📋 Copiar teléfono
    </button>
    <button class="btn-secondary" id="copy-summary-btn">
      📋 Copiar resumen
    </button>
  `;
  el.querySelector("#copy-phone-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(lead.phone);
      toast("Teléfono copiado al portapapeles", "success");
    } catch { toast("No se pudo copiar", "error"); }
  });
  el.querySelector("#copy-summary-btn").addEventListener("click", async () => {
    const sum = [
      `Lead: ${lead.parent_name || "sin nombre"}`,
      `Teléfono: ${lead.phone}`,
      `Peque: ${lead.child_name || "—"} (${lead.child_age || "?"} años)`,
      `Programa: ${lead.program_interest || "—"}`,
      `Etapa: ${lead.lead_stage}`,
      `Último mensaje: ${formatDateTime(lead.last_message_at)}`,
      lead.notes ? `Notas: ${lead.notes}` : ""
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(sum);
      toast("Resumen copiado al portapapeles", "success");
    } catch { toast("No se pudo copiar", "error"); }
  });
}

async function loadConversation(lead) {
  const panel = document.getElementById("tab-conversation");
  panel.innerHTML = '<div class="empty-state"><div class="skel" style="width:60%;height:20px"></div></div>';
  try {
    const convo = await fetchConversationsForPhone(lead.phone, 300);
    if (!convo.length) {
      panel.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div>Sin mensajes registrados</div>';
      return;
    }
    panel.innerHTML = convo.map(m => `
      <div class="msg msg-${m.role}">
        <div class="msg-head">
          <strong>${m.role === "user" ? "👤 Padre" : m.role === "assistant" ? "🤖 Bot" : "🛠 Sistema"}</strong>
          · ${formatDateTime(m.message_timestamp)}
          ${m.intent ? `· <em>${escapeHtml(m.intent)}</em>` : ""}
        </div>
        <div class="msg-body">${escapeHtml(m.message_text).replace(/\n/g, "<br>")}</div>
      </div>
    `).join("");
    // Auto-scroll al final
    panel.scrollTop = panel.scrollHeight;
  } catch (err) {
    panel.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function loadActivity(lead) {
  const panel = document.getElementById("tab-activity");
  panel.innerHTML = '<div class="empty-state"><div class="skel" style="width:60%;height:20px"></div></div>';
  try {
    const items = await fetchInteractionsForLead(lead.id || lead.lead_id, 100);
    if (!items.length) {
      panel.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div>Sin eventos de actividad</div>';
      return;
    }
    panel.innerHTML = `
      <div class="timeline">
        <div class="timeline-item">
          <div class="timeline-dot primary"></div>
          <div class="timeline-title">Lead creado</div>
          <div class="timeline-time">${formatDateTime(lead.created_at)}</div>
        </div>
        ${items.map(it => {
          const dotClass = it.agent === "escalation_agent" ? "danger" :
                           it.agent === "commercial_agent" ? "warning" :
                           it.action_taken === "responded" ? "success" : "";
          return `
            <div class="timeline-item">
              <div class="timeline-dot ${dotClass}"></div>
              <div class="timeline-title">
                <strong>${escapeHtml(it.agent || "agente")}</strong>
                respondió · intent <em>${escapeHtml(it.intent || "—")}</em>
                ${it.confidence != null ? `· conf ${Number(it.confidence).toFixed(2)}` : ""}
              </div>
              <div class="timeline-time">${formatDateTime(it.created_at)}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } catch (err) {
    panel.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
  }
}
