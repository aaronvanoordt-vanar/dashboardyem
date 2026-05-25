// ============================================================
// Pipeline (Kanban) Page
// ============================================================
import { getState, subscribe } from "../state.js";
import { escapeHtml, formatRelative, stageMeta, PIPELINE_COLUMNS } from "../utils.js";
import { open as openLead } from "./lead-detail.js";

let unsubscribe = null;

export function render() {
  document.getElementById("page-title").textContent = "Pipeline";
  document.getElementById("page-subtitle").textContent = "Vista Kanban del recorrido de cada lead";

  const container = document.getElementById("page-container");
  container.innerHTML = `<div class="kanban" id="kanban"></div>`;

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe(update);
  update(getState());
}

function update(state) {
  // Guard: si la pagina ya no esta montada, no updatear
  const kanban = document.getElementById("kanban");
  if (!kanban) return;
  const leads = state.leads;
  const byStage = {};
  for (const stage of PIPELINE_COLUMNS) byStage[stage] = [];
  for (const l of leads) {
    const s = byStage[l.lead_stage] ? l.lead_stage : "new";
    byStage[s].push(l);
  }
  kanban.innerHTML = PIPELINE_COLUMNS.map(stage => {
    const list = byStage[stage] || [];
    const meta = stageMeta(stage);
    return `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <div>
            <div class="kanban-col-title" style="color:${meta.color}">
              ${meta.icon} ${escapeHtml(meta.label)}
            </div>
            ${meta.desc ? `<div class="kanban-col-desc">${escapeHtml(meta.desc)}</div>` : ""}
          </div>
          <span class="kanban-col-count">${list.length}</span>
        </div>
        <div class="kanban-col-body">
          ${list.length ? list.slice(0, 50).map(l => cardHtml(l)).join("") : `
            <div class="empty-state" style="padding:var(--space-5)">
              <div class="dim">Sin leads</div>
            </div>
          `}
        </div>
      </div>
    `;
  }).join("");
  kanban.querySelectorAll("[data-lead-id]").forEach(el => {
    el.addEventListener("click", () => {
      const lead = leads.find(x => x.id === el.dataset.leadId);
      if (lead) openLead(lead);
    });
  });
}

function cardHtml(lead) {
  const tags = [];
  if (lead.child_age) tags.push(`${lead.child_age}a`);
  if (lead.program_interest) tags.push(escapeHtml(lead.program_interest));
  if (lead.human_required) tags.push('<span class="badge badge-human">👤</span>');
  return `
    <div class="kanban-card" data-lead-id="${lead.id}">
      <div class="kanban-card-name">${escapeHtml(lead.parent_name) || '<span class="dim">Sin nombre</span>'}</div>
      <div class="kanban-card-meta">${tags.join(" · ") || '<span class="dim">sin info</span>'}</div>
      <div class="kanban-card-foot">
        <span class="mono">${escapeHtml(lead.phone)}</span>
        <span>${formatRelative(lead.last_message_at)}</span>
      </div>
    </div>
  `;
}
