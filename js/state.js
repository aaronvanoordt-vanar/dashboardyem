// ============================================================
// Estado global con pub/sub minimalista
// ============================================================

const subscribers = new Set();

const state = {
  leads: [],
  recentMessages: [],
  recentInteractions: [],
  msgs24Count: 0,
  lastLoadedAt: null,
  loading: false,
  error: null
};

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of subscribers) {
    try { fn(state); } catch (e) { console.error(e); }
  }
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
