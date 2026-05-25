// ============================================================
// MAIN — entry point
// ============================================================
import { initClient, fetchLeads, countMessagesSince, fetchRecentInteractions } from "./api.js";
import { getState, setState } from "./state.js";
import { registerRoute, start as startRouter } from "./router.js";
import { toast } from "./utils.js";

import * as overview      from "./pages/overview.js";
import * as pipeline      from "./pages/pipeline.js";
import * as leads         from "./pages/leads.js";
import * as conversations from "./pages/conversations.js";
import * as analytics     from "./pages/analytics.js";
import * as leadDetail    from "./pages/lead-detail.js";

const REFRESH_INTERVAL_MS = 30000;
let refreshTimer = null;

// ---------- Boot ----------
function boot() {
  bindGate();

  // Auto-skip gate if previously authed
  if (sessionStorage.getItem("yem_dash_ok") === "1") {
    enterApp();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// ---------- Gate ----------
function bindGate() {
  const form  = document.getElementById("gate-form");
  const btn   = document.getElementById("gate-btn");
  const input = document.getElementById("gate-pwd");

  const submit = (e) => {
    if (e) e.preventDefault();
    checkPassword();
  };
  form  && form.addEventListener("submit", submit);
  btn   && btn.addEventListener("click", submit);
  input && input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit(e);
  });
}

function checkPassword() {
  const pwdInput = document.getElementById("gate-pwd");
  const errEl    = document.getElementById("gate-err");
  if (typeof DASHBOARD_PASSWORD === "undefined") {
    errEl.textContent = "config.js no se cargo. Revisa la consola.";
    return;
  }
  if (pwdInput.value === DASHBOARD_PASSWORD) {
    sessionStorage.setItem("yem_dash_ok", "1");
    enterApp();
  } else {
    errEl.textContent = "Clave incorrecta";
  }
}

// ---------- Enter app ----------
function enterApp() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  try {
    initClient();
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
    return;
  }

  // Lead detail (drawer) init
  leadDetail.init();

  // Topbar refresh button
  document.getElementById("refresh-btn").addEventListener("click", () => {
    loadAll(true);
  });
  // Logout
  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("yem_dash_ok");
    location.reload();
  });

  // Register routes
  registerRoute("overview",      overview.render);
  registerRoute("pipeline",      pipeline.render);
  registerRoute("conversations", conversations.render);
  registerRoute("leads",         leads.render);
  registerRoute("analytics",     analytics.render);
  startRouter();

  // Inicial load
  loadAll();
  // Polling
  refreshTimer && clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadAll(false), REFRESH_INTERVAL_MS);
}

// ---------- Data loader ----------
async function loadAll(showToast = false) {
  const btn = document.getElementById("refresh-btn");
  if (btn) btn.classList.add("loading");
  setStatusDot("loading");
  setState({ loading: true, error: null });

  try {
    const since24h = new Date(Date.now() - 86400000).toISOString();
    const [leadsData, msgs24, interactions] = await Promise.all([
      fetchLeads(1000),
      countMessagesSince(since24h),
      fetchRecentInteractions(150)
    ]);
    setState({
      leads: leadsData,
      msgs24Count: msgs24,
      recentInteractions: interactions,
      lastLoadedAt: new Date(),
      loading: false
    });
    setStatusDot("live");
    updateLastUpdate();
    updateNavBadge(leadsData.length);
    if (showToast) toast("Datos actualizados", "success");
  } catch (err) {
    console.error(err);
    setState({ loading: false, error: err.message });
    setStatusDot("error");
    if (showToast) toast("Error: " + err.message, "error");
  } finally {
    if (btn) btn.classList.remove("loading");
  }
}

function setStatusDot(kind) {
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");
  if (!dot || !txt) return;
  dot.classList.remove("live", "error");
  if (kind === "live")    { dot.classList.add("live");  txt.textContent = "en vivo"; }
  if (kind === "error")   { dot.classList.add("error"); txt.textContent = "error"; }
  if (kind === "loading") { txt.textContent = "cargando..."; }
}

function updateLastUpdate() {
  const el = document.getElementById("last-update");
  if (!el) return;
  const ts = getState().lastLoadedAt;
  if (!ts) return;
  el.textContent = `Actualizado ${ts.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

function updateNavBadge(count) {
  const el = document.getElementById("nav-leads-count");
  if (el) el.textContent = count;
}
