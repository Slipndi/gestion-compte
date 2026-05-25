import { ctx } from './ctx.js';
import { state } from './state.js';
import { $, esc, errMsg, showToast, PALETTE, monthKey } from './utils.js';
import { k } from './calculations.js';

// ── Système modal ─────────────────────────────────────────────

let _escListener = null;

export function openModal(inner) {
  $("modal-root").innerHTML = `
    <div id="modal" class="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-t-3xl bg-slate-950 border-t border-slate-800 px-4 pb-6 pt-4 animate-[slideUp_0.25s_ease-out]">
        <div class="flex justify-center mb-2"><div class="h-1 w-10 rounded-full bg-slate-700"></div></div>
        ${inner}
      </div>
    </div>`;
  $("modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  _escListener = (e) => { if (e.key === "Escape") closeModal(); };
  document.addEventListener("keydown", _escListener);
}

export function closeModal() {
  $("modal-root").innerHTML = "";
  if (_escListener) { document.removeEventListener("keydown", _escListener); _escListener = null; }
}

// ── Modale foyer ──────────────────────────────────────────────

export function foyerModal() {
  const foyer = JSON.parse(localStorage.getItem("budget_foyer_config") || "null") || { adultes: ["Ludovic", "Marie-Laure"], enfants: 3 };
  openModal(`
    <h2 class="text-base font-semibold mb-3">Configuration du foyer</h2>
    <div class="space-y-3">
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Prénom adulte 1</label>
        <input id="foyer-a1" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${esc(foyer.adultes[0] || "")}" />
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Prénom adulte 2</label>
        <input id="foyer-a2" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${esc(foyer.adultes[1] || "")}" />
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Nombre d'enfants</label>
        <input id="foyer-enfants" type="number" min="0" max="10" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${foyer.enfants}" />
      </div>
      <button id="foyer-save" class="mt-2 w-full rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-fuchsia-400 active:scale-[0.98] transition">Enregistrer</button>
    </div>
  `);
  $("foyer-save").onclick = () => {
    const a1 = $("foyer-a1").value.trim();
    const a2 = $("foyer-a2").value.trim();
    const enfants = parseInt($("foyer-enfants").value) || 0;
    localStorage.setItem("budget_foyer_config", JSON.stringify({
      adultes: [a1 || "Adulte 1", a2 || "Adulte 2"],
      enfants,
    }));
    closeModal();
  };
}

// ── Modale dépense ────────────────────────────────────────────

export function depModal(d, afterSave) {
  const opts = state.categories.map(c =>
    `<option value="${c.id}" ${d && d.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`
  ).join("");
  openModal(`
    <h2 class="text-base font-semibold mb-3">${d ? "Modifier la dépense" : "Nouvelle dépense"}</h2>
    <div class="space-y-2">
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Nom</label>
        <input id="d-label" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${d ? esc(d.label) : ""}" placeholder="ex. Carrefour" />
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Montant (€)</label>
        <input id="d-amount" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${d ? d.amount : ""}" />
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Catégorie</label>
        <select id="d-cat" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"><option value="">Sans catégorie</option>${opts}</select>
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Date</label>
        <input id="d-date" type="date" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${d ? d.spent_on : new Date().toISOString().slice(0, 10)}" />
      </div>
      <button id="d-save" class="mt-2 w-full rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-fuchsia-400 active:scale-[0.98] transition">${d ? "Enregistrer" : "Ajouter"}</button>
    </div>
  `);
  $("d-save").onclick = async () => {
    const label  = $("d-label").value.trim();
    const amount = parseFloat($("d-amount").value.replace(",", "."));
    if (!label || isNaN(amount) || amount <= 0) return;
    const payload = { label, amount, category_id: $("d-cat").value || null, spent_on: $("d-date").value, month: k() };
    try {
      if (d) await ctx.sb.from("depenses").update(payload).eq("id", d.id);
      else   await ctx.sb.from("depenses").insert(payload);
      closeModal();
      afterSave();
    } catch { showToast(errMsg()); }
  };
}

// ── Modale récurrent ──────────────────────────────────────────

export function recModal(r, afterSave) {
  const ym = (s) => s ? s.slice(0, 7) : "";
  openModal(`
    <h2 class="text-base font-semibold mb-3">${r ? "Modifier le récurrent" : "Nouveau récurrent"}</h2>
    <div class="space-y-2">
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Libellé</label>
        <input id="r-label" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${r ? esc(r.label) : ""}" />
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Montant (€)</label>
        <input id="r-amount" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${r ? r.amount : ""}" />
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Jour de prélèvement (optionnel)</label>
        <input id="r-day" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="numeric" value="${r && r.day ? r.day : ""}" />
      </div>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Début</label>
          <input id="r-start" type="month" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${r ? ym(r.start_month) : monthKey(state.cur).slice(0, 7)}" />
        </div>
        <div class="flex-1">
          <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Fin (optionnel)</label>
          <input id="r-end" type="month" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${r ? ym(r.end_month) : ""}" />
        </div>
      </div>
      <button id="r-save" class="mt-2 w-full rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-fuchsia-400 active:scale-[0.98] transition">${r ? "Enregistrer" : "Ajouter"}</button>
    </div>
  `);
  $("r-save").onclick = async () => {
    const label  = $("r-label").value.trim();
    const amount = parseFloat($("r-amount").value.replace(",", "."));
    if (!label || isNaN(amount) || amount <= 0) return;
    let day = $("r-day").value === "" ? null : Math.min(31, Math.max(1, parseInt($("r-day").value, 10)));
    if (Number.isNaN(day)) day = null;
    const start   = ($("r-start").value || monthKey(state.cur).slice(0, 7)) + "-01";
    const end     = $("r-end").value ? $("r-end").value + "-01" : null;
    const payload = { label, amount, day, start_month: start, end_month: end };
    try {
      if (r) await ctx.sb.from("recurrents").update(payload).eq("id", r.id);
      else   await ctx.sb.from("recurrents").insert({ ...payload, active: true });
      closeModal();
      afterSave();
    } catch { showToast(errMsg()); }
  };
}

// ── Modale catégorie ──────────────────────────────────────────

export function catModal(c, afterSave) {
  const color = c ? c.color : PALETTE[0];
  openModal(`
    <h2 class="text-base font-semibold mb-3">${c ? "Modifier la catégorie" : "Nouvelle catégorie"}</h2>
    <div class="space-y-3">
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Nom</label>
        <input id="c-name" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" value="${c ? esc(c.name) : ""}" />
      </div>
      <div>
        <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Couleur</label>
        <div id="c-sw" class="mt-1 flex flex-wrap gap-2">${PALETTE.map(p => `<button type="button" class="h-7 w-7 rounded-full border-2 ${p === color ? "border-slate-50" : "border-transparent"}" style="background:${p}" data-c="${p}"></button>`).join("")}</div>
      </div>
      <button id="c-save" class="mt-2 w-full rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-fuchsia-400 active:scale-[0.98] transition">${c ? "Enregistrer" : "Ajouter"}</button>
    </div>
  `);
  let sel = color;
  $("c-sw").addEventListener("click", e => {
    const s = e.target.closest("[data-c]"); if (!s) return;
    sel = s.dataset.c;
    [...$("c-sw").children].forEach(x => x.classList.toggle("border-slate-50", x === s));
  });
  $("c-save").onclick = async () => {
    const name = $("c-name").value.trim(); if (!name) return;
    try {
      if (c) await ctx.sb.from("categories").update({ name, color: sel }).eq("id", c.id);
      else   await ctx.sb.from("categories").insert({ name, color: sel });
      closeModal();
      afterSave();
    } catch { showToast(errMsg()); }
  };
}
