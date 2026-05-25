// ============================================================
// API — Supabase wrapper
// ============================================================

let client = null;

export function initClient() {
  if (client) return client;
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Libreria Supabase no cargada");
  }
  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
    throw new Error("config.js no cargo (SUPABASE_URL/KEY undefined)");
  }
  if (SUPABASE_URL.includes("YOUR-PROJECT") || SUPABASE_ANON_KEY.includes("PEGA_AQUI")) {
    throw new Error("config.js no configurado");
  }
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function sb() {
  if (!client) initClient();
  return client;
}

// --- Leads ---
export async function fetchLeads(limit = 1000) {
  const { data, error } = await sb()
    .from("leads")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// --- Conversations ---
export async function fetchConversationsForPhone(phone, limit = 200) {
  const { data, error } = await sb()
    .from("conversations")
    .select("*")
    .eq("phone", phone)
    .order("message_timestamp", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchRecentConversations(limit = 50) {
  const { data, error } = await sb()
    .from("conversations")
    .select("*")
    .order("message_timestamp", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function countMessagesSince(isoDate) {
  const { count, error } = await sb()
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .gte("message_timestamp", isoDate);
  if (error) throw error;
  return count || 0;
}

// --- Interactions ---
export async function fetchRecentInteractions(limit = 100) {
  const { data, error } = await sb()
    .from("interactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function fetchInteractionsForLead(leadId, limit = 100) {
  const { data, error } = await sb()
    .from("interactions")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// --- Send message via n8n webhook ---
export function isSendEnabled() {
  return typeof SEND_WEBHOOK_URL !== "undefined"
    && typeof SEND_AUTH_TOKEN !== "undefined"
    && SEND_WEBHOOK_URL && SEND_AUTH_TOKEN;
}

export async function sendMessage(phone, message) {
  if (!isSendEnabled()) {
    throw new Error("Envio desde dashboard no configurado (SEND_WEBHOOK_URL vacio en config.js)");
  }
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  const cleanMsg   = String(message || "").trim();
  if (!cleanPhone) throw new Error("Telefono invalido");
  if (!cleanMsg)   throw new Error("Mensaje vacio");

  const res = await fetch(SEND_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: SEND_AUTH_TOKEN,
      phone: cleanPhone,
      message: cleanMsg
    })
  });

  if (res.status === 401) throw new Error("Token de autenticacion invalido");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${text || "no se pudo enviar"}`);
  }
  return res.json().catch(() => ({ status: "ok" }));
}
