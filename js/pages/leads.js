// ============================================================
// Leads Page — tabla con filtros, sort y export
// ============================================================
import { getState, subscribe } from "../state.js";
import { escapeHtml, formatRelative, stageMeta, debounce, leadsToCsv, downloadFile, toast } from "../utils.js";
import { open as openLead } from "./lead-detail.js";

let unsubscribe = null;
let filters = { search: "", stage: "", program: "", humanOnly: false };
let sort = { key: "last_message_at", dir: "desc" };

export function render() {
  document.getElementById("page-title").textContent = "Leads";
  document.getElementById("page-subtitle").textContent = "Listado completo con filtros, búsqueda y exportación";

  const container = document.getElementById("page-container");
  container.innerHTML = `
    <div class="filters-bar">
      <input type="text" class="search" id="f-search" placeholder="Buscar por nombre, teléfono o peque..." />
      <select id="f-stage">
        <option value="">Todas las etapas</option>
      </select>
      <select id="f-program">
        <option value="">Todos los programas</option>
      </select>
      <label class="filter-count" style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="f-human" /> Solo humano
      </label>
      <span class="filters-spacer"></span>
      <span class="filter-count" id="f-count">—</span>
      <button class="btn-ghost" id="f-export">📥 Exportar CSV</button>
    </div>
    <div class="table-wrap">
      <table class="table" id="leads-table">
        <thead>
          <tr>
            <th class="sortable" data-sort="last_message_at">Última act.</th>
            <th class="sortable" data-sort="parent_name">Padre</th>
            <th class="sortable" data-sort="child_name">Peque</th>
            <th class="sortable" data-sort="child_age">Edad</th>
            <th class="sortable" data-sort="program_interest">Programa</th>
            <th class="sortable" data-sort="lead_stage">Etapa</th>
            <th class="sortable" data-sort="lead_score">Score</th>
            <th>Teléfono</th>
            <th>Humano</th>
          </tr>
        </thead>
        <tbody id="leads-tbody"></tbody>
      </table>
    </div>
  `;

  // Bind filters
  document.getElementById("f-search").addEventListener("input", debounce((e) => {
    filters.search = e.target.value.toLowerCase();
    update(getState());
  }, 180));
  document.getElementById("f-stage").addEventListener("change", e => {
    filters.stage = e.target.value;
    update(getState());
  });
  document.getElementById("f-program").addEventListener("change", e => {
    filters.program = e.target.value;
    update(getState());
  });
  document.getElementById("f-human").addEventListener("change", e => {
    filters.humanOnly = e.target.checked;
    update(getState());
  });
  document.getElementById("f-export").addEventListener("click", () => {
    const data = currentFiltered(getState().leads);
    const csv = leadsToCsv(data);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`yem-leads-${stamp}.csv`, csv, "text/csv");
    toast(`Exportados ${data.length} leads`, "success");
  });

  // Sort handlers
  document.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sort.key === key) sort.dir = sort.dir === "asc" ? "desc" : "asc";
      else { sort.key = key; sort.dir = "desc"; }
      update(getState());
    });
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribe(update);
  update(getState());
}

function update(state) {
  // Guard: si la pagina ya no esta montada, no updatear
  if (!document.getElementById("leads-tbody")) return;
  populateSelects(state.leads);
  const filtered = currentFiltered(state.leads);
  document.getElementById("f-count").textContent = `${filtered.length} de ${state.leads.length}`;
  renderTable(filtered);
  // Sort indicator
  document.querySelectorAll("th.sortable").forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sort === sort.key) th.classList.add("sort-" + sort.dir);
  });
}

function currentFiltered(leads) {
  let out = leads.slice();
  if (filters.stage)   out = out.filter(l => l.lead_stage === filters.stage);
  if (filters.program) out = out.filter(l => l.program_interest === filters.program);
  if (filters.humanOnly) out = out.filter(l => l.human_required);
  if (filters.search) {
    const s = filters.search;
    out = out.filter(l =>
      (l.parent_name || "").toLowerCase().includes(s) ||
      (l.child_name  || "").toLowerCase().includes(s) ||
      (l.phone       || "").toLowerCase().includes(s)
    );
  }
  // Sort
  out.sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (sort.key.endsWith("_at") || sort.key === "created_at") {
      return (new Date(av) - new Date(bv)) * (sort.dir === "asc" ? 1 : -1);
    }
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * (sort.dir === "asc" ? 1 : -1);
    }
    return String(av).localeCompare(String(bv)) * (sort.dir === "asc" ? 1 : -1);
  });
  return out;
}

function populateSelects(leads) {
  const stages = [...new Set(leads.map(l => l.lead_stage).filter(Boolean))].sort();
  const progs  = [...new Set(leads.map(l => l.program_interest).filter(Boolean))].sort();

  const stageSel = document.getElementById("f-stage");
  const progSel = document.getElementById("f-program");
  if (!stageSel || !progSel) return;
  const prev1 = stageSel.value, prev2 = progSel.value;
  stageSel.innerHTML = '<option value="">Todas las etapas</option>' +
    stages.map(s => `<option value="${escapeHtml(s)}" ${s===prev1?"selected":""}>${escapeHtml(stageMeta(s).label)}</option>`).join("");
  progSel.innerHTML = '<option value="">Todos los programas</option>' +
    progs.map(p => `<option value="${escapeHtml(p)}" ${p===prev2?"selected":""}>${escapeHtml(p)}</option>`).join("");
}

function renderTable(filtered) {
  const tbody = document.getElementById("leads-tbody");
  if (!tbody) return;
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">Sin leads que coincidan con los filtros</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.slice(0, 300).map(l => `
    <tr data-lead-id="${l.id}">
      <td>${formatRelative(l.last_message_at)}</td>
      <td>${escapeHtml(l.parent_name) || '<span class="dim">—</span>'}</td>
      <td>${escapeHtml(l.child_name) || '<span class="dim">—</span>'}</td>
      <td>${l.child_age ?? '<span class="dim">—</span>'}</td>
      <td>${escapeHtml(l.program_interest) || '<span class="dim">—</span>'}</td>
      <td><span class="badge badge-stage-${l.lead_stage || "new"}">${escapeHtml(stageMeta(l.lead_stage).label)}</span></td>
      <td>${l.lead_score ?? 0}</td>
      <td class="col-phone">${escapeHtml(l.phone)}</td>
      <td>${l.human_required ? '<span class="badge badge-human">👤</span>' : ""}</td>
    </tr>
  `).join("");
  tbody.querySelectorAll("[data-lead-id]").forEach(tr => {
    tr.addEventListener("click", () => {
      const lead = getState().leads.find(x => x.id === tr.dataset.leadId);
      if (lead) openLead(lead);
    });
  });
}
