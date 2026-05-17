// ============================================================
// Analytics Page
// ============================================================
import { getState, subscribe } from "../state.js";
import { escapeHtml, stageMeta, daysAgo } from "../utils.js";

let charts = {};
let unsubscribe = null;
let period = 30;

export function render() {
  document.getElementById("page-title").textContent = "Analytics";
  document.getElementById("page-subtitle").textContent = "Métricas profundas y desempeño del bot";

  const container = document.getElementById("page-container");
  container.innerHTML = `
    <div class="filters-bar">
      <span>Período:</span>
      <select id="a-period">
        <option value="7">Últimos 7 días</option>
        <option value="30" selected>Últimos 30 días</option>
        <option value="90">Últimos 90 días</option>
        <option value="365">Último año</option>
      </select>
      <span class="filters-spacer"></span>
    </div>

    <div class="kpi-grid" id="a-kpis"></div>

    <div class="grid-2">
      <div class="chart-card">
        <h3>Evolución de leads</h3>
        <canvas id="a-chart-leads"></canvas>
      </div>
      <div class="chart-card">
        <h3>Embudo de conversión</h3>
        <canvas id="a-chart-funnel"></canvas>
      </div>
    </div>

    <div class="grid-2">
      <div class="chart-card">
        <h3>Distribución de intent (agente router)</h3>
        <canvas id="a-chart-intent"></canvas>
      </div>
      <div class="chart-card">
        <h3>Carga por agente</h3>
        <canvas id="a-chart-agent"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">📊 Resumen por programa</div>
      </div>
      <div id="a-program-table"></div>
    </div>
  `;

  document.getElementById("a-period").addEventListener("change", e => {
    period = Number(e.target.value);
    update(getState());
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe(update);
  update(getState());
}

function update(state) {
  const since = daysAgo(period).getTime();
  const leadsInPeriod = state.leads.filter(l => l.created_at && new Date(l.created_at).getTime() >= since);
  renderKPIs(leadsInPeriod, state);
  renderLeadsChart(leadsInPeriod);
  renderFunnel(leadsInPeriod);
  renderIntentChart(state.recentInteractions);
  renderAgentChart(state.recentInteractions);
  renderProgramTable(state.leads);
}

function renderKPIs(periodLeads, state) {
  const total = periodLeads.length;
  const hot = periodLeads.filter(l => l.lead_stage === "ready_for_human_close" || l.lead_stage === "ready_to_enroll").length;
  const human = periodLeads.filter(l => l.human_required).length;
  const escalRate = state.recentInteractions.length
    ? Math.round(state.recentInteractions.filter(i => i.agent === "escalation_agent").length / state.recentInteractions.length * 100)
    : 0;
  const convRate = total ? Math.round((hot / total) * 1000) / 10 : 0;

  document.getElementById("a-kpis").innerHTML = `
    <div class="kpi">
      <div class="kpi-accent"></div>
      <div class="kpi-label">Leads (${period}d)</div>
      <div class="kpi-value">${total}</div>
    </div>
    <div class="kpi kpi--hot">
      <div class="kpi-accent"></div>
      <div class="kpi-label">Hot leads</div>
      <div class="kpi-value">${hot}</div>
    </div>
    <div class="kpi kpi--success">
      <div class="kpi-accent"></div>
      <div class="kpi-label">Tasa conversión</div>
      <div class="kpi-value">${convRate}%</div>
    </div>
    <div class="kpi">
      <div class="kpi-accent" style="background:var(--accent)"></div>
      <div class="kpi-label">Tasa escalation</div>
      <div class="kpi-value">${escalRate}%</div>
    </div>
    <div class="kpi kpi--human">
      <div class="kpi-accent"></div>
      <div class="kpi-label">A humanos</div>
      <div class="kpi-value">${human}</div>
    </div>
  `;
}

function renderLeadsChart(periodLeads) {
  const ctx = document.getElementById("a-chart-leads");
  if (!ctx) return;
  const days = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = daysAgo(i);
    days.push(d.toISOString().slice(0, 10));
  }
  const newLeads = days.map(d => periodLeads.filter(l => l.created_at && l.created_at.slice(0, 10) === d).length);
  const hotLeads = days.map(d => periodLeads.filter(l =>
    l.last_message_at && l.last_message_at.slice(0, 10) === d &&
    (l.lead_stage === "ready_for_human_close" || l.lead_stage === "ready_to_enroll")
  ).length);

  if (charts.leads) charts.leads.destroy();
  charts.leads = new Chart(ctx, {
    type: "line",
    data: {
      labels: days.map(d => d.slice(5)),
      datasets: [
        { label: "Nuevos", data: newLeads, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.1)", fill: true, tension: 0.3, pointRadius: 0 },
        { label: "Hot", data: hotLeads, borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", fill: true, tension: 0.3, pointRadius: 0 }
      ]
    },
    options: axisOpts({ legend: true })
  });
}

function renderFunnel(periodLeads) {
  const ctx = document.getElementById("a-chart-funnel");
  if (!ctx) return;
  const stages = ["new", "qualifying", "active", "ready_for_human_close", "ready_to_enroll"];
  const counts = stages.map(s => periodLeads.filter(l => l.lead_stage === s).length);
  const labels = stages.map(s => stageMeta(s).label);

  if (charts.funnel) charts.funnel.destroy();
  charts.funnel = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: ["#3b82f6","#8b5cf6","#06b6d4","#f59e0b","#10b981"],
        borderRadius: 6
      }]
    },
    options: { ...axisOpts({}), indexAxis: "y" }
  });
}

function renderIntentChart(interactions) {
  const ctx = document.getElementById("a-chart-intent");
  if (!ctx) return;
  const counts = {};
  for (const i of interactions) {
    const k = i.intent || "unknown";
    counts[k] = (counts[k] || 0) + 1;
  }
  if (charts.intent) charts.intent.destroy();
  charts.intent = new Chart(ctx, donutCfg(Object.keys(counts), Object.values(counts)));
}

function renderAgentChart(interactions) {
  const ctx = document.getElementById("a-chart-agent");
  if (!ctx) return;
  const counts = {};
  for (const i of interactions) {
    const k = i.agent || "unknown";
    counts[k] = (counts[k] || 0) + 1;
  }
  if (charts.agent) charts.agent.destroy();
  charts.agent = new Chart(ctx, donutCfg(Object.keys(counts), Object.values(counts)));
}

function renderProgramTable(allLeads) {
  const container = document.getElementById("a-program-table");
  const groups = {};
  for (const l of allLeads) {
    const p = l.program_interest || "sin definir";
    if (!groups[p]) groups[p] = { total: 0, hot: 0, human: 0 };
    groups[p].total++;
    if (l.lead_stage === "ready_for_human_close" || l.lead_stage === "ready_to_enroll") groups[p].hot++;
    if (l.human_required) groups[p].human++;
  }
  const rows = Object.entries(groups).sort((a,b) => b[1].total - a[1].total);
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">Sin datos</div>`;
    return;
  }
  container.innerHTML = `
    <div class="table-wrap" style="border:none;background:transparent">
      <table class="table">
        <thead>
          <tr>
            <th>Programa</th>
            <th>Total</th>
            <th>Hot</th>
            <th>A humanos</th>
            <th>Tasa hot</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(([p, g]) => `
            <tr>
              <td><strong>${escapeHtml(p)}</strong></td>
              <td>${g.total}</td>
              <td>${g.hot}</td>
              <td>${g.human}</td>
              <td><strong>${Math.round((g.hot / g.total) * 1000) / 10}%</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function axisOpts(opts = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: !!opts.legend, position: "bottom", labels: { color: "#cbd5e1", boxWidth: 10, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: "#94a3b8", font: { size: 10 } }, grid: { color: "rgba(148,163,184,0.06)" } },
      y: { ticks: { color: "#94a3b8", precision: 0, font: { size: 10 } }, grid: { color: "rgba(148,163,184,0.06)" }, beginAtZero: true }
    }
  };
}

function donutCfg(labels, values) {
  const colors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#84cc16","#64748b"];
  return {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#cbd5e1", boxWidth: 10, font: { size: 11 } } }
      }
    }
  };
}
