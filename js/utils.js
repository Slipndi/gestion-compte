// ── Formatters ────────────────────────────────────────────────
export const fmt  = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const fmt0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const esc  = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const monthLabel = (d) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);

// ── Helpers DOM ───────────────────────────────────────────────
export const $ = (id) => document.getElementById(id);

// ── Helpers dates ─────────────────────────────────────────────
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const monthKey     = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
export const shiftMonth   = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

// ── UI helpers ────────────────────────────────────────────────
export function showLoading() {
  document.getElementById("app").innerHTML =
    `<div class="flex items-center justify-center py-24 text-slate-700"><span class="text-3xl" style="display:inline-block;animation:spin 1s linear infinite">↻</span></div>`;
}

export function errMsg() {
  return !navigator.onLine ? "Pas de connexion internet." : "Une erreur s'est produite. Réessayer.";
}

export function showToast(msg, isError = true) {
  const el = document.createElement("div");
  el.className = `fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-4 py-2 text-[12px] font-medium shadow-lg whitespace-nowrap ${isError ? "bg-rose-500 text-white" : "bg-slate-700 text-slate-100"}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Constantes application ────────────────────────────────────
export const PALETTE = [
  "#22c55e", "#0ea5e9", "#a855f7", "#f97316",
  "#eab308", "#22d3ee", "#f43f5e", "#14b8a6", "#38bdf8", "#6366f1",
];

export const SEED_CATS = [
  ["Course", "#22c55e"], ["Essence", "#f97316"], ["Loisirs", "#a855f7"], ["Habits", "#0ea5e9"],
  ["Enfants", "#eab308"], ["Santé", "#f43f5e"], ["Maison", "#38bdf8"], ["Autres", "#64748b"],
];

export const SEED_RECS = [
  ["Maison (prêt)", 960, null], ["Prêt voiture", 555, 4], ["Wegovy", 190, null], ["Crédit conso", 180, 4],
  ["Cantines", 160, null], ["EDF", 120, null], ["GMF", 120, null], ["Panneaux solaires", 110, null],
  ["Mutuelle", 107, null], ["Enfants", 97, null], ["Taxe foncière", 88, 15], ["Drawer", 80, null],
  ["iPhone", 75, null], ["CBP", 56, null], ["Veolia (eau)", 56, null], ["SFR", 54, null], ["Coiffeur", 50, null],
  ["Assurance vie", 20, null], ["Deezer", 19, null], ["Cb", 18, null], ["Netflix", 14, null], ["Amazon Prime", 7, null],
];

export const FOYER_DEFAULTS = { adultes: ["Ludovic", "Marie-Laure"], enfants: 3 };

export function getFoyerConfig() {
  try { return JSON.parse(localStorage.getItem("budget_foyer_config")) || FOYER_DEFAULTS; }
  catch { return FOYER_DEFAULTS; }
}
