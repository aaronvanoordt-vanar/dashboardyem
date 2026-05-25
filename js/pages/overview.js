// ============================================================
// Overview Page
// ============================================================
import { getState, subscribe } from "../state.js";
import { escapeHtml, formatRelative, formatDateTime, stageMeta, isHotStage, daysAgo } from "../utils.js";
import { open as openLead } from "./lead-detail.js";

let charts = { timeline: null, stage: null, program: null };
let unsubscribe = null;

export function render() {
  document.getElementById("page-title").textContent = "Overview";
  document.getElementById("page-subtitle").textContent = "Estado general del pipeline en tiempo real";

  const container = document.getElementById("page-container");
  container.innerHTML = `
    <div class="kpi-grid" id="kpi-grid"></div>

    <div class="grid-2">
      <div class="chart-card">
        <h3>Leads nuevos por día (últimos 30)</h3>
        <canvas id="chart-timeline"></canvas>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔥 Leads que necesitan atención</div>
        </div>
        <div id="hot-leads" class="hot-leads-list"></div>
      </div>
    </div>

    <div class="grid-3" style="margin-bottom: var(--space-6);">
      <div class="chart-card">
        <h3>Distribución por etapa</h3>
        <canvas id="chart-stage"></canvas>
      </div>
      <div class="chart-card">
        <h3>Interés por programa</h3>
        <canvas id="chart-program"></canvas>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">📡 Salud del bot</div></div>
        <div id="bot-health" class="info-grid"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">⚡ Actividad reciente</div>
        <a class="card-action" href="#/leads">Ver todos →</a>
      </div>
      <div id="activity-feed" class="activity-feed"></div>
    </div>
  `;

  // Unsubscribe del render anterior si existia
  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe(update);
  update(getState());
}

function update(state) {
  // Guard: si la pagina overview ya no esta montada (usuario navego a otra),
  // no intentar updatear el DOM — esto evita TypeError null cuando los
  // elementos ya no existen.
  if (!document.getElementById("kpi-grid")) return;
  if (!state.leads.length && state.loading) {
    return; // espera
  }
  renderKPIs(state);
  renderTimeline(state.leads);
  renderHotLeads(state.leads);
  renderStageChart(state.leads);
  renderProgramChart(state.leads);
  renderBotHealth(state);
  renderActivity(state);
}

function renderKPIs(state) {
  const leads = state.leads;
  const total = leads.length;
  const sevenDaysAgo = daysAgo(7).getTime();
  const active = leads.filter(l => l.last_message_at && new Date(l.last_message_at).getTime() >= sevenDaysAgo).length;
  const hot = leads.filter(l => isHotStage(l.lead_stage)).length;
  const human = leads.filter(l => l.human_required).length;
  const enrolled = leads.filter(l => l.lead_stage === "ready_to_enroll").length;
  const conv = total ? Math.round((enrolled / total) * 1000) / 10 : 0;

  document.getElementById("kpi-grid").innerHTML = `
    <div class="kpi">
      <div class="kpi-accent"></div>
      <div class="kpi-label">Total leads</div>
      <div class="kpi-value">${total}</div>
      <div class="kpi-delta neutral">desde el inicio</div>
    </div>
    <div class="kpi">
      <div class="kpi-accent" style="background:var(--info)"></div>
      <div class="kpi-label">Activos 7d</div>
      <div class="kpi-value">${active}</div>
      <div class="kpi-delta neutral">${total ? Math.round(active/total*100) : 0}% del total</div>
    </div>
    <div class="kpi kpi--hot">
      <div class="kpi-accent"></div>
      <div class="kpi-label">Hot leads 🔥</div>
      <div class="kpi-value">${hot}</div>
      <div class="kpi-delta neutral">listos para cerrar</div>
    </div>
    <div class="kpi kpi--human">
      <div class="kpi-accent"></div>
      <div class="kpi-label">En humano 👤</div>
      <div class="kpi-value">${human}</div>
      <div class="kpi-delta neutral">esperando a Marcel</div>
    </div>
    <div class="kpi kpi--success">
      <div class="kpi-accent"></div>
      <div class="kpi-label">Conversión</div>
      <div class="kpi-value">${conv}%</div>
      <div class="kpi-delta neutral">${enrolled} de ${total}</div>
    </div>
  `;
}

function renderTimeline(leads) {
  const ctx = document.getElementById("chart-timeline");
  if (!ctx) return;
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    days.push(d.toISOString().slice(0, 10));
  }
  const counts = days.map(d => leads.filter(l => l.created_at && l.created_at.slice(0, 10) === d).length);
  if (charts.timeline) charts.timeline.destroy();
  charts.timeline = new Chart(ctx, {
    type: "line",
    data: {
      labels: days.map(d => d.slice(5)),
      datasets: [{
        label: "Leads",
        data: counts,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.15)",
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: chartOpts({ axes: true })
  });
}

function renderHotLeads(leads) {
  const hot = leads
    .filter(l => isHotStage(l.lead_stage) || l.human_required)
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
    .slice(0, 6);
  const container = document.getElementById("hot-leads");
  if (!hot.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✨</div>Sin leads urgentes ahora</div>`;
    return;
  }
  container.innerHTML = hot.map(l => `
    <div class="hot-lead-row" data-lead-id="${l.id}">
      <div>
        <div class="hot-lead-name">${escapeHtml(l.parent_name) || '<span class="dim">Sin nombre</span>'}</div>
        <div class="hot-lead-meta">
          ${l.child_age ? `Peque ${l.child_age} años · ` : ""}
          ${escapeHtml(l.program_interest) || "programa por definir"}
          · <span class="badge badge-stage-${l.lead_stage}">${stageMeta(l.lead_stage).label}</span>
        </div>
      </div>
      <div class="hot-lead-time">${formatRelative(l.last_message_at)}</div>
    </div>
  `).join("");
  container.querySelectorAll("[data-lead-id]").forEach(el => {
    el.addEventListener("click", () => {
      const lead = leads.find(x => x.id === el.dataset.leadId);
      if (lead) openLead(lead);
    });
  });
}

function renderStageChart(leads) {
  const ctx = document.getElementById("chart-stage");
  if (!ctx) return;
  const stages = {};
  for (const l of leads) {
    const s = l.lead_stage || "new";
    stages[s] = (stages[s] || 0) + 1;
  }
  if (charts.stage) charts.stage.destroy();
  charts.stage = new Chart(ctx, donutCfg(Object.keys(stages).map(stageLabel), Object.values(stages)));
  function stageLabel(s) { return stageMeta(s).label; }
}

function renderProgramChart(leads) {
  const ctx = document.getElementById("chart-program");
  if (!ctx) return;
  const progs = {};
  for (const l of leads) {
    const p = l.program_interest || "sin definir";
    progs[p] = (progs[p] || 0) + 1;
  }
  if (charts.program) charts.program.destroy();
  charts.program = new Chart(ctx, donutCfg(Object.keys(progs), Object.values(progs)));
}

function renderBotHealth(state) {
  const inter = state.recentInteractions || [];
  const total = inter.length;
  const escalCount = inter.filter(i => i.agent === "escalation_agent").length;
  const escalRate = total ? Math.round((escalCount / total) * 100) : 0;
  const avgConf = total ? (inter.reduce((s,i) => s + (Number(i.confidence) || 0), 0) / total).toFixed(2) : "—";

  const leads = state.leads;
  const totalMsgs = state.msgs24Count || 0;
  const avgMsgsPerLead = leads.length ? (totalMsgs / Math.max(1, leads.filter(l => {
    return l.last_message_at && (new Date() - new Date(l.last_message_at)) < 86400000;
  }).length || 1)).toFixed(1) : "—";

  document.getElementById("bot-health").innerHTML = `
    <dt>Mensajes 24h</dt>      <dd><strong>${totalMsgs}</strong></dd>
    <dt>Interacciones recent.</dt> <dd>${total}</dd>
    <dt>Tasa escalation</dt>   <dd>${escalRate}% <span class="dim">(${escalCount}/${total})</span></dd>
    <dt>Confianza media</dt>   <dd>${avgConf}</dd>
    <dt>Msgs / lead (24h)</dt>  <dd>${avgMsgsPerLead}</dd>
  `;
}

function renderActivity(state) {
  const container = document.getElementById("activity-feed");
  // Mezclar interactions + leads creados recientes en una lista temporal
  const events = [];
  for (const i of state.recentInteractions.slice(0, 20)) {
    events.push({
      ts: i.created_at,
      kind: "interaction",
      lead_id: i.lead_id,
      phone: i.phone,
      intent: i.intent,
      agent: i.agent
    });
  }
  for (const l of state.leads.slice(0, 30)) {
    if (l.created_at) {
      events.push({
        ts: l.created_at,
        kind: "lead_created",
        lead_id: l.id,
        phone: l.phone,
        name: l.parent_name
      });
    }
  }
  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const top = events.slice(0, 15);
  if (!top.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div>Sin actividad reciente</div>`;
    return;
  }
  container.innerHTML = top.map(e => {
    if (e.kind === "lead_created") {
      return `
        <div class="activity-item" data-lead-id="${e.lead_id}">
          <div class="activity-icon" style="background:var(--primary-soft);color:var(--primary)">🆕</div>
          <div class="activity-body">
            <div class="activity-title">Lead nuevo · ${escapeHtml(e.name) || '<span class="dim">Sin nombre</span>'}</div>
            <div class="activity-meta mono">${escapeHtml(e.phone)}</div>
          </div>
          <div class="activity-time">${formatRelative(e.ts)}</div>
        </div>
      `;
    }
    const icon = e.agent === "escalation_agent" ? "👤" :
                 e.agent === "commercial_agent" ? "🔥" :
                 e.agent === "informational_agent" ? "ℹ️" :
                 e.agent === "qualification_agent" ? "🔍" : "🤖";
    return `
      <div class="activity-item" data-lead-id="${e.lead_id}">
        <div class="activity-icon">${icon}</div>
        <div class="activity-body">
          <div class="activity-title">
            ${escapeHtml(e.agent || "agente")} · intent <em>${escapeHtml(e.intent || "—")}</em>
          </div>
          <div class="activity-meta mono">${escapeHtml(e.phone || "—")}</div>
        </div>
        <div class="activity-time">${formatRelative(e.ts)}</div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-lead-id]").forEach(el => {
    el.addEventListener("click", () => {
      const lead = state.leads.find(x => x.id === el.dataset.leadId);
      if (lead) openLead(lead);
    });
  });
}

// ---------- Chart helpers ----------
function chartOpts(opts = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: opts.axes ? {
      x: {
        ticks: { color: "#94a3b8", maxRotation: 0, font: { size: 10 } },
        grid: { color: "rgba(148,163,184,0.06)" }
      },
      y: {
        ticks: { color: "#94a3b8", precision: 0, font: { size: 10 } },
        grid: { color: "rgba(148,163,184,0.06)" },
        beginAtZero: true
      }
    } : undefined
  };
}

function donutCfg(labels, values) {
  const colors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16","#64748b"];
  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#cbd5e1", boxWidth: 10, font: { size: 11 }, padding: 8 }
        }
      }
    }
  };
}
