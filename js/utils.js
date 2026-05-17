// ============================================================
// Utility helpers
// ============================================================

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

export function formatRelative(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMin = (now - d) / 60000;
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return Math.floor(diffMin) + "m";
  if (diffMin < 1440) return Math.floor(diffMin / 60) + "h";
  if (diffMin < 10080) return Math.floor(diffMin / 1440) + "d";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysAgo(n) {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

// Stage display & meta
export const STAGE_META = {
  new:                    { label: "New",          color: "var(--stage-new)",        icon: "🆕" },
  qualifying:             { label: "Qualifying",   color: "var(--stage-qualifying)", icon: "🔍" },
  info_sent:              { label: "Info Sent",    color: "var(--stage-info)",       icon: "📄" },
  active:                 { label: "Active",       color: "var(--success)",          icon: "💬" },
  ready_for_human_close:  { label: "Trial Slot",   color: "var(--stage-hot)",        icon: "🔥" },
  ready_to_enroll:        { label: "Ready Enroll", color: "var(--stage-ready)",      icon: "✅" },
  requires_human:         { label: "Human",        color: "var(--stage-human)",      icon: "👤" }
};

export function stageMeta(stage) {
  return STAGE_META[stage] || { label: stage || "—", color: "var(--stage-other)", icon: "•" };
}

// Pipeline columns order
export const PIPELINE_COLUMNS = [
  "new",
  "qualifying",
  "active",
  "ready_for_human_close",
  "ready_to_enroll",
  "requires_human"
];

export function isHotStage(stage) {
  return stage === "ready_for_human_close" || stage === "ready_to_enroll";
}

// Download text as a file
export function downloadFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export function leadsToCsv(leads) {
  const cols = [
    "phone", "parent_name", "child_name", "child_age", "program_interest",
    "lead_stage", "lead_score", "human_required", "last_intent", "last_agent",
    "last_message_at", "created_at", "notes"
  ];
  const header = cols.join(",");
  const rows = leads.map(l =>
    cols.map(c => {
      const v = l[c];
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

// Toast manager
export function toast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => { el.remove(); }, 4500);
}

// Debounce
export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Open WhatsApp Web with a phone number
export function whatsappLink(phone) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
