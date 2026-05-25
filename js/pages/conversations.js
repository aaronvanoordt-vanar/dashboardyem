// ============================================================
// Conversaciones — Inbox estilo WhatsApp
// ============================================================
import { getState, subscribe } from "../state.js";
import { fetchConversationsForPhone, sendMessage, isSendEnabled } from "../api.js";
import { escapeHtml, formatRelative, formatDateTime, stageMeta, nameInitial, whatsappLink, debounce, toast } from "../utils.js";

let unsubscribe = null;
let selectedPhone = null;
let searchQuery = "";
let convoCache = new Map(); // phone -> messages[]
let convoTimer = null;

export function render() {
  document.getElementById("page-title").textContent = "Conversaciones";
  document.getElementById("page-subtitle").textContent = "Lee los chats del bot con cada padre en tiempo real";

  const container = document.getElementById("page-container");
  container.innerHTML = `
    <div class="inbox">
      <aside class="inbox-list">
        <div class="inbox-search">
          <input type="text" id="inbox-search" placeholder="Buscar nombre o teléfono..." />
        </div>
        <div class="inbox-items" id="inbox-items"></div>
      </aside>
      <section class="inbox-chat" id="inbox-chat">
        <div class="empty-state inbox-empty">
          <div class="empty-state-icon">💬</div>
          <div>Selecciona una conversación para ver los mensajes</div>
        </div>
      </section>
    </div>
  `;

  // Search
  document.getElementById("inbox-search").addEventListener("input", debounce(e => {
    searchQuery = e.target.value.toLowerCase();
    renderList(getState().leads);
  }, 150));

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe(state => {
    renderList(state.leads);
    if (selectedPhone) refreshOpenChat(state.leads);
  });

  renderList(getState().leads);

  // Si una URL viene con #/conversations?phone=XXX, abrir esa
  const hashParts = location.hash.split("?");
  if (hashParts.length > 1) {
    const params = new URLSearchParams(hashParts[1]);
    const ph = params.get("phone");
    if (ph) openChat(ph);
  }

  // Polling extra del chat abierto cada 15s (la página de fondo se refresca cada 30s)
  if (convoTimer) clearInterval(convoTimer);
  convoTimer = setInterval(() => {
    if (selectedPhone) reloadOpenChat();
  }, 15000);
}

function renderList(leads) {
  const items = document.getElementById("inbox-items");
  if (!items) return;
  const filtered = leads
    .filter(l => l.last_message_at) // solo los que tienen actividad
    .filter(l => {
      if (!searchQuery) return true;
      return (l.parent_name || "").toLowerCase().includes(searchQuery) ||
             (l.child_name  || "").toLowerCase().includes(searchQuery) ||
             (l.phone       || "").toLowerCase().includes(searchQuery);
    })
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
    .slice(0, 200);

  if (!filtered.length) {
    items.innerHTML = `<div class="empty-state" style="padding:var(--space-6);font-size:var(--fs-sm)"><div class="empty-state-icon" style="font-size:32px">🔍</div>Sin conversaciones${searchQuery ? " que coincidan" : " activas"}</div>`;
    return;
  }

  items.innerHTML = filtered.map(l => itemHtml(l)).join("");

  items.querySelectorAll("[data-phone]").forEach(el => {
    el.addEventListener("click", () => openChat(el.dataset.phone));
    if (el.dataset.phone === selectedPhone) el.classList.add("selected");
  });
}

function itemHtml(lead) {
  const name = lead.parent_name && lead.parent_name !== "Contacto" ? lead.parent_name : (lead.phone || "Sin nombre");
  const initial = nameInitial(lead.parent_name);
  const sm = stageMeta(lead.lead_stage);
  const stageDot = `<span class="inbox-stage-dot" style="background:${sm.color}" title="${escapeHtml(sm.label)}"></span>`;
  const subtitle = lead.child_age
    ? `${lead.child_age} años · ${escapeHtml(lead.program_interest) || sm.label}`
    : sm.label;
  const sel = lead.phone === selectedPhone ? "selected" : "";
  const hot = lead.lead_stage === "ready_for_human_close" || lead.lead_stage === "ready_to_enroll" ? "hot" : "";
  return `
    <div class="inbox-item ${sel} ${hot}" data-phone="${escapeHtml(lead.phone)}">
      <div class="inbox-avatar">${escapeHtml(initial)}</div>
      <div class="inbox-item-body">
        <div class="inbox-item-top">
          <span class="inbox-item-name">${escapeHtml(name)}</span>
          <span class="inbox-item-time">${formatRelative(lead.last_message_at)}</span>
        </div>
        <div class="inbox-item-sub">
          ${stageDot}
          <span>${subtitle}</span>
        </div>
      </div>
    </div>
  `;
}

async function openChat(phone) {
  selectedPhone = phone;
  // Actualizar URL para deep-link SIN disparar el router (replaceState)
  try {
    history.replaceState(null, "", `#/conversations?phone=${encodeURIComponent(phone)}`);
  } catch {}
  // Marcar como seleccionado en la lista
  document.querySelectorAll(".inbox-item").forEach(el => {
    el.classList.toggle("selected", el.dataset.phone === phone);
  });
  await loadChat(phone);
}

async function loadChat(phone) {
  const chat = document.getElementById("inbox-chat");
  if (!chat) return;
  const lead = getState().leads.find(l => l.phone === phone);
  if (!lead) {
    chat.innerHTML = `<div class="empty-state inbox-empty"><div class="empty-state-icon">⚠️</div>Lead no encontrado</div>`;
    return;
  }

  chat.innerHTML = chatShellHtml(lead) +
    `<div class="chat-messages" id="chat-messages"><div class="chat-loading">Cargando mensajes...</div></div>` +
    chatFooterHtml(lead);

  bindChatActions(lead);

  try {
    const msgs = await fetchConversationsForPhone(phone, 500);
    convoCache.set(phone, msgs);
    renderMessages(msgs);
  } catch (err) {
    document.getElementById("chat-messages").innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function reloadOpenChat() {
  if (!selectedPhone) return;
  try {
    const msgs = await fetchConversationsForPhone(selectedPhone, 500);
    const prev = convoCache.get(selectedPhone) || [];
    if (msgs.length !== prev.length) {
      convoCache.set(selectedPhone, msgs);
      renderMessages(msgs, /*autoScroll=*/true);
    }
  } catch (err) {
    console.warn("reload chat error", err);
  }
}

function refreshOpenChat(leads) {
  if (!selectedPhone) return;
  // Solo refrescar el header si el lead cambio (ej: nuevo stage)
  const lead = leads.find(l => l.phone === selectedPhone);
  if (!lead) return;
  const header = document.getElementById("chat-header-meta");
  if (header) header.innerHTML = chatHeaderMetaInner(lead);
}

function chatShellHtml(lead) {
  return `
    <header class="chat-header">
      <div class="chat-avatar">${escapeHtml(nameInitial(lead.parent_name))}</div>
      <div class="chat-header-info">
        <div class="chat-header-name">${escapeHtml(lead.parent_name) || "Sin nombre"}</div>
        <div class="chat-header-meta" id="chat-header-meta">${chatHeaderMetaInner(lead)}</div>
      </div>
      <div class="chat-header-actions">
        <a class="btn-ghost" href="${whatsappLink(lead.phone)}" target="_blank" rel="noopener" title="Abrir conversación en WhatsApp">
          💬 WhatsApp
        </a>
        <button class="btn-ghost" id="copy-phone" title="Copiar teléfono">📋 ${escapeHtml(lead.phone)}</button>
      </div>
    </header>
  `;
}

function chatHeaderMetaInner(lead) {
  const sm = stageMeta(lead.lead_stage);
  const peque = lead.child_age ? `${lead.child_age} años` : "";
  const programa = lead.program_interest ? ` · ${escapeHtml(lead.program_interest)}` : "";
  const peq = peque ? ` · ${peque}` : "";
  return `<span class="badge badge-stage-${lead.lead_stage || "new"}">${escapeHtml(sm.label)}</span>${peq}${programa}`;
}

function chatFooterHtml(lead) {
  // Si el envio desde dashboard NO esta configurado, mostramos el CTA viejo al WhatsApp.
  if (!isSendEnabled()) {
    return `
      <footer class="chat-footer">
        <a class="chat-reply-cta" href="${whatsappLink(lead.phone)}" target="_blank" rel="noopener">
          <span>↗</span>
          <span>Responder desde tu WhatsApp</span>
        </a>
        <small class="dim">Para responder directo desde aquí, configura SEND_WEBHOOK_URL en config.js</small>
      </footer>
    `;
  }
  // Input para enviar mensaje desde el dashboard
  return `
    <footer class="chat-footer chat-footer-input">
      <textarea
        id="chat-input"
        class="chat-input"
        placeholder="Escribí tu respuesta como Marcel..."
        rows="1"
      ></textarea>
      <button id="chat-send-btn" class="chat-send-btn" title="Enviar mensaje (Enter)">
        <span class="send-icon">➤</span>
      </button>
    </footer>
    <div class="chat-footer-note">
      <small class="dim">📤 Al enviar, el mensaje sale del WhatsApp de YEM y el bot se silencia para este lead. Shift+Enter = nueva línea.</small>
    </div>
  `;
}

function bindChatActions(lead) {
  const btn = document.getElementById("copy-phone");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(lead.phone);
        btn.textContent = "✓ Copiado";
        setTimeout(() => { btn.textContent = "📋 " + lead.phone; }, 1500);
      } catch {}
    });
  }

  // Input de envio de mensaje
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  if (input && sendBtn) {
    // Auto-resize del textarea segun contenido
    const autoSize = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 140) + "px";
    };
    input.addEventListener("input", autoSize);

    // Enter envia, Shift+Enter hace nueva linea
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(lead);
      }
    });
    sendBtn.addEventListener("click", () => handleSend(lead));
    input.focus();
  }
}

async function handleSend(lead) {
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  if (!input || !sendBtn) return;
  const text = input.value.trim();
  if (!text) return;

  sendBtn.disabled = true;
  sendBtn.classList.add("sending");

  // Optimistic UI: agregar el mensaje al chat ahora mismo
  const optimisticMsg = {
    role: "assistant",
    message_text: text,
    intent: "manual_marcel",
    message_timestamp: new Date().toISOString()
  };
  const cached = convoCache.get(lead.phone) || [];
  const next = [...cached, optimisticMsg];
  convoCache.set(lead.phone, next);
  renderMessages(next, true);

  try {
    await sendMessage(lead.phone, text);
    input.value = "";
    input.style.height = "auto";
    toast("Mensaje enviado ✓", "success");
    // Refrescar de la DB en 1s para obtener el mensaje real (no el optimistic)
    setTimeout(() => reloadOpenChat(), 1500);
  } catch (err) {
    // Rollback del optimistic
    convoCache.set(lead.phone, cached);
    renderMessages(cached, false);
    toast("Error al enviar: " + err.message, "error");
  } finally {
    sendBtn.disabled = false;
    sendBtn.classList.remove("sending");
    input.focus();
  }
}

function renderMessages(msgs, autoScroll = true) {
  const container = document.getElementById("chat-messages");
  if (!container) return;
  if (!msgs.length) {
    container.innerHTML = `<div class="empty-state inbox-empty"><div class="empty-state-icon">📭</div>Sin mensajes en este chat</div>`;
    return;
  }

  // Agrupar por fecha (Hoy / Ayer / fecha)
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  for (const m of msgs) {
    const day = (m.message_timestamp || "").slice(0, 10);
    if (day !== currentDate) {
      currentDate = day;
      currentGroup = { day, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(m);
  }

  container.innerHTML = groups.map(g => `
    <div class="chat-date-sep">${formatDayLabel(g.day)}</div>
    ${g.messages.map(m => bubbleHtml(m)).join("")}
  `).join("");

  if (autoScroll) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

function bubbleHtml(m) {
  const isUser = m.role === "user";
  const isBot = m.role === "assistant";
  const isSystem = !isUser && !isBot;

  if (isSystem) {
    return `<div class="chat-bubble-system">${escapeHtml(m.message_text)}</div>`;
  }

  const time = m.message_timestamp
    ? new Date(m.message_timestamp).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
    : "";
  const body = escapeHtml(m.message_text || "").replace(/\n/g, "<br>");
  const intentTag = m.intent && isUser ? ` <span class="bubble-intent">· ${escapeHtml(m.intent)}</span>` : "";

  return `
    <div class="chat-bubble-wrap ${isUser ? "from-user" : "from-bot"}">
      <div class="chat-bubble ${isUser ? "bubble-user" : "bubble-bot"}">
        <div class="bubble-body">${body}</div>
        <div class="bubble-meta">${time}${intentTag}</div>
      </div>
    </div>
  `;
}

function formatDayLabel(day) {
  if (!day) return "";
  const d = new Date(day + "T00:00:00");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yest = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  if (day === today) return "Hoy";
  if (day === yest) return "Ayer";
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
