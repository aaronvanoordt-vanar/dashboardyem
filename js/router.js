// ============================================================
// Mini hash router
// ============================================================

const routes = new Map();
let currentRoute = null;

export function registerRoute(name, handler) {
  routes.set(name, handler);
}

export function navigate(name) {
  if (location.hash !== "#/" + name) {
    location.hash = "/" + name;
  } else {
    render();
  }
}

export function start() {
  window.addEventListener("hashchange", render);
  render();
}

function render() {
  // El hash puede tener query: #/conversations?phone=51999...
  // Sacamos solo el nombre de la ruta, ignorando el query string.
  let raw = (location.hash || "").replace(/^#\//, "");
  let name = raw.split("?")[0] || "overview";
  if (!routes.has(name)) name = "overview";
  currentRoute = name;
  // Highlight sidebar
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.route === name);
  });
  const handler = routes.get(name);
  handler && handler();
}

export function getCurrent() { return currentRoute; }
