import { ctx } from './ctx.js';
import { state } from './state.js';
import { $, esc, fmt, fmt0, monthLabel, showLoading, errMsg, showToast, shiftMonth, SEED_RECS, monthKey } from './utils.js';
import { k, income, recsForMonth, recTotal, depTotal, reste } from './calculations.js';
import { loadMonth, reloadRecs, reloadCats } from './data.js';
import { depModal, recModal, catModal, foyerModal } from './modals.js';
import { copierPromptIA } from './ai.js';

// ── Dispatcher principal ──────────────────────────────────────

export function render() {
  const nav = $("nav");
  nav.querySelectorAll("[data-tab]").forEach(b => {
    const on = b.dataset.tab === state.tab;
    b.classList.toggle("text-fuchsia-400", on);
    b.classList.toggle("text-slate-400", !on);
  });
  if      (state.tab === "mois")       renderMois();
  else if (state.tab === "recurrents") renderRecurrents();
  else if (state.tab === "categories") renderCategories();
  else if (state.tab === "revenus")    renderRevenus();
}

// ── Header commun ─────────────────────────────────────────────

function tabName() {
  return { recurrents: "Récurrents", categories: "Catégories", revenus: "Revenus" }[state.tab] || "";
}

function header(extra = "") {
  return `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <button id="m-prev" class="h-8 w-8 rounded-xl border border-slate-800 bg-slate-900/70 flex items-center justify-center text-slate-400 text-sm hover:text-fuchsia-400 hover:border-fuchsia-500/50 transition">‹</button>
        <div>
          <p class="text-[11px] uppercase tracking-[0.16em] text-slate-500">${state.tab === "mois" ? "Vue mensuelle" : tabName()}</p>
          <h2 class="text-lg font-semibold leading-tight capitalize">${state.tab === "mois" ? monthLabel(state.cur) : tabName()}</h2>
        </div>
      </div>
      <button id="m-next" class="h-8 w-8 rounded-xl border border-slate-800 bg-slate-900/70 flex items-center justify-center text-slate-400 text-sm hover:text-fuchsia-400 hover:border-fuchsia-500/50 transition">${state.tab === "mois" ? "›" : ""}</button>
    </div>
    ${extra}
  `;
}

function wireHeader() {
  const prev = $("m-prev"), next = $("m-next");
  if (state.tab === "mois") {
    prev.onclick = async () => { state.cur = shiftMonth(state.cur, -1); showLoading(); await loadMonth(); render(); };
    next.onclick = async () => { state.cur = shiftMonth(state.cur,  1); showLoading(); await loadMonth(); render(); };
  } else {
    prev.classList.add("opacity-0", "pointer-events-none");
    next.classList.add("opacity-0", "pointer-events-none");
  }
}

// ── Vue Mois ──────────────────────────────────────────────────

function depList() {
  if (!state.depenses.length)
    return `<div class="text-[12px] text-slate-500 text-center py-4 border border-dashed border-slate-800 rounded-2xl">Aucune dépense ce mois-ci.</div>`;
  return state.depenses.map(d => {
    const c = state.categories.find(x => x.id === d.category_id);
    return `<div class="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[12px]" data-id="${d.id}">
      <span class="h-2 w-2 rounded-full" style="background:${c ? c.color : "#64748b"}"></span>
      <div class="flex-1 min-w-0">
        <div class="truncate">${esc(d.label)}</div>
        <div class="text-[11px] text-slate-500">${c ? esc(c.name) : "Sans catégorie"} · ${d.spent_on?.slice(8, 10)}/${d.spent_on?.slice(5, 7)}</div>
      </div>
      <span class="text-[12px] font-medium">${fmt.format(d.amount)}</span>
      <button class="ml-1 rounded-xl border border-slate-800 px-2 py-1 text-[11px] text-slate-400 hover:text-fuchsia-400 hover:border-fuchsia-500/50 act-edit">Éditer</button>
      <button class="rounded-xl border border-slate-800 px-2 py-1 text-[11px] text-rose-400 hover:border-rose-500/70 act-del">Suppr.</button>
    </div>`;
  }).join("");
}

function wireDepList() {
  $("dep-list").addEventListener("click", async e => {
    const row = e.target.closest("[data-id]"); if (!row) return;
    const d = state.depenses.find(x => x.id === row.dataset.id);
    if (e.target.classList.contains("act-del")) {
      if (!confirm(`Supprimer « ${d.label} » (${fmt.format(d.amount)}) ?`)) return;
      try { await ctx.sb.from("depenses").delete().eq("id", d.id); await loadMonth(); render(); }
      catch { showToast(errMsg()); }
    } else if (e.target.classList.contains("act-edit")) {
      depModal(d, async () => { await loadMonth(); render(); });
    }
  });
}

function renderMois() {
  const inc  = income(), rec = recTotal(), dep = depTotal(), rst = reste();
  const engaged = inc > 0 ? Math.min(100, Math.round((rec + dep) / inc * 100)) : 0;
  const recPct  = inc > 0 ? Math.round(rec / inc * 100) : 0;

  const now        = new Date();
  const isCurrent  = now.getFullYear() === state.cur.getFullYear() && now.getMonth() === state.cur.getMonth();
  const daysInMonth = new Date(state.cur.getFullYear(), state.cur.getMonth() + 1, 0).getDate();
  const daysLeft   = isCurrent ? Math.max(1, daysInMonth - now.getDate() + 1) : daysInMonth;
  const perDay     = rst / daysLeft;

  const byCat = {};
  state.depenses.forEach(d => { const c = d.category_id || "∅"; byCat[c] = (byCat[c] || 0) + Number(d.amount); });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([cid, amt]) => { const c = state.categories.find(x => x.id === cid); return { name: c ? c.name : "Sans catégorie", color: c ? c.color : "#64748b", amt }; });
  const topHtml = top.length
    ? '<div class="mt-3 space-y-1.5">' +
      top.map(t =>
        '<div class="flex items-center justify-between text-[11px]">' +
          '<div class="flex items-center gap-2">' +
            `<span class="h-2 w-2 rounded-full" style="background:${t.color}"></span>` +
            `<span>${esc(t.name)}</span>` +
          '</div>' +
          `<span class="font-medium">${fmt.format(t.amt)}</span>` +
        '</div>'
      ).join("") +
      '</div>'
    : "";

  $("app").innerHTML = header(`
    <section class="space-y-3">
      <div class="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 px-4 py-4 shadow-xl">
        <p class="text-[11px] uppercase tracking-[0.18em] text-slate-400">Reste à dépenser</p>
        <p class="mt-1 text-[30px] font-semibold leading-none tracking-tight ${rst < 0 ? "text-rose-400" : "text-fuchsia-400"}">${fmt.format(rst)}</p>
        <div class="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
          <div>
            <p class="text-[10px] uppercase tracking-[0.16em] text-slate-500">Revenus</p>
            <p class="font-medium text-slate-100">${fmt.format(inc)}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-[0.16em] text-slate-500">Récurrents</p>
            <p class="font-medium text-slate-100">-${fmt.format(rec)}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-[0.16em] text-slate-500">Dépenses</p>
            <p class="font-medium text-slate-100">-${fmt.format(dep)}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
          <p class="text-[10px] uppercase tracking-[0.16em] text-slate-500">Engagé</p>
          <p class="mt-1 text-xl font-semibold">${engaged}%</p>
          <div class="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full bg-fuchsia-500" style="width:${engaged}%"></div>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
          <p class="text-[10px] uppercase tracking-[0.16em] text-slate-500">${isCurrent ? "Reste / jour" : "Disponible / jour"}</p>
          <p class="mt-1 text-xl font-semibold">${fmt0.format(perDay)}</p>
          <p class="mt-1 text-[11px] text-slate-400">${daysLeft} j ${isCurrent ? "restants" : ""}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
        <div class="flex items-center justify-between">
          <p class="text-[11px] text-slate-400">Poids des récurrents</p>
          <p class="text-sm font-medium">${recPct}%</p>
        </div>
        ${topHtml}
      </div>
    </section>

    <section class="mt-5">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-medium">Dépenses</h3>
        <button id="add-dep" class="inline-flex items-center rounded-full bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-medium text-fuchsia-400 border border-fuchsia-500/40 hover:bg-fuchsia-500/20 active:scale-[0.97] transition">+ Dépense</button>
      </div>
      <div id="dep-list" class="space-y-1.5">${depList()}</div>
    </section>

    <section class="mt-5 pb-6">
      <div class="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 px-4 py-4 flex items-start justify-between gap-3">
        <div class="flex-1">
          <p class="text-[12px] font-medium text-slate-300">Analyser avec une IA</p>
          <p class="text-[11px] text-slate-500 mt-0.5">Copie un prompt structuré avec graphiques à coller dans n'importe quelle IA.</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <button id="ouvrir-claude-btn" class="inline-flex items-center rounded-full bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-medium text-fuchsia-400 border border-fuchsia-500/40 hover:bg-fuchsia-500/20 active:scale-[0.97] transition whitespace-nowrap">
            Copier le prompt IA
          </button>
          <button id="foyer-config-btn" class="text-[10px] text-slate-500 hover:text-slate-300 transition">
            ⚙ Configurer le foyer
          </button>
        </div>
      </div>
    </section>
  `);

  wireHeader();
  $("add-dep").onclick = () => depModal(null, async () => { await loadMonth(); render(); });
  wireDepList();
  $("ouvrir-claude-btn")?.addEventListener("click", copierPromptIA);
  $("foyer-config-btn")?.addEventListener("click", foyerModal);
}

// ── Vue Récurrents ────────────────────────────────────────────

function renderRecurrents() {
  let body;
  if (!state.recurrents.length) {
    body = `<div class="text-[12px] text-slate-500 text-center py-6 border border-dashed border-slate-800 rounded-2xl">Aucun récurrent.<br/><button id="seed-rec" class="mt-3 rounded-full border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:border-fuchsia-500/60 hover:text-fuchsia-400">Importer le modèle</button></div>`;
  } else {
    body = state.recurrents.map(r => {
      const ends = r.end_month ? `fin ${r.end_month.slice(5, 7)}/${r.end_month.slice(0, 4)}` : "sans fin";
      return `<div class="flex items-center gap-2 rounded-2xl border ${r.active ? "border-slate-800 bg-slate-950/60" : "border-slate-800/60 bg-slate-950/30 opacity-60"} px-3 py-2 text-[12px]" data-id="${r.id}">
        <div class="flex-1 min-w-0">
          <div class="truncate">${esc(r.label)}</div>
          <div class="text-[11px] text-slate-500">${r.day ? `le ${r.day} · ` : ""}${ends}</div>
        </div>
        <span class="text-[12px] font-medium">${fmt.format(r.amount)}</span>
        <button class="ml-1 rounded-xl border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-fuchsia-400 hover:border-fuchsia-500/60 act-toggle">${r.active ? "Pause" : "Activer"}</button>
        <button class="rounded-xl border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-fuchsia-400 hover:border-fuchsia-500/60 act-edit">Éditer</button>
        <button class="rounded-xl border border-slate-700 px-2 py-1 text-[11px] text-rose-400 hover:border-rose-500/70 act-del">Suppr.</button>
      </div>`;
    }).join("");
  }

  $("app").innerHTML = header(`
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium">Paiements récurrents</h3>
        <button id="add-rec" class="inline-flex items-center rounded-full bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-medium text-fuchsia-400 border border-fuchsia-500/40 hover:bg-fuchsia-500/20 active:scale-[0.97] transition">+ Ajouter</button>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[12px] flex items-center justify-between">
        <span class="text-slate-400">Total actif ce mois (${recsForMonth().length})</span>
        <span class="font-medium">${fmt.format(recTotal())}</span>
      </div>
      <div id="rec-list" class="space-y-1.5">${body}</div>
    </section>
  `);

  wireHeader();
  $("add-rec").onclick = () => recModal(null, async () => { await reloadRecs(); render(); });

  if ($("seed-rec")) {
    $("seed-rec").onclick = async () => {
      try {
        const sm = monthKey(new Date());
        await ctx.sb.from("recurrents").insert(
          SEED_RECS.map(([label, amount, day]) => ({ label, amount, day, start_month: sm, end_month: null, active: true }))
        );
        await reloadRecs(); render();
      } catch { showToast(errMsg()); }
    };
  }

  $("rec-list").addEventListener("click", async e => {
    const row = e.target.closest("[data-id]"); if (!row) return;
    const r = state.recurrents.find(x => x.id === row.dataset.id);
    if (e.target.classList.contains("act-del")) {
      if (!confirm(`Supprimer « ${r.label} » (${fmt.format(r.amount)}/mois) ?`)) return;
      try { await ctx.sb.from("recurrents").delete().eq("id", r.id); await reloadRecs(); render(); }
      catch { showToast(errMsg()); }
    } else if (e.target.classList.contains("act-toggle")) {
      try { await ctx.sb.from("recurrents").update({ active: !r.active }).eq("id", r.id); await reloadRecs(); render(); }
      catch { showToast(errMsg()); }
    } else if (e.target.classList.contains("act-edit")) {
      recModal(r, async () => { await reloadRecs(); render(); });
    }
  });
}

// ── Vue Catégories ────────────────────────────────────────────

function renderCategories() {
  const body = state.categories.length
    ? state.categories.map(c => `
        <div class="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[12px]" data-id="${c.id}">
          <span class="h-3 w-3 rounded-full" style="background:${c.color}"></span>
          <div class="flex-1 min-w-0 truncate">${esc(c.name)}</div>
          <button class="rounded-xl border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-fuchsia-400 hover:border-fuchsia-500/60 act-edit">Éditer</button>
          <button class="rounded-xl border border-slate-700 px-2 py-1 text-[11px] text-rose-400 hover:border-rose-500/70 act-del">Suppr.</button>
        </div>`).join("")
    : `<div class="text-[12px] text-slate-500 text-center py-4 border border-dashed border-slate-800 rounded-2xl">Aucune catégorie.</div>`;

  $("app").innerHTML = header(`
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium">Catégories</h3>
        <button id="add-cat" class="inline-flex items-center rounded-full bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-medium text-fuchsia-400 border border-fuchsia-500/40 hover:bg-fuchsia-500/20 active:scale-[0.97] transition">+ Ajouter</button>
      </div>
      <div id="cat-list" class="space-y-1.5">${body}</div>
    </section>
  `);

  wireHeader();
  $("add-cat").onclick = () => catModal(null, async () => { await reloadCats(); render(); });

  $("cat-list").addEventListener("click", async e => {
    const row = e.target.closest("[data-id]"); if (!row) return;
    const c = state.categories.find(x => x.id === row.dataset.id);
    if (e.target.classList.contains("act-del")) {
      if (!confirm(`Supprimer « ${c.name} » ? Les dépenses liées passeront en « sans catégorie ».`)) return;
      try { await ctx.sb.from("categories").delete().eq("id", c.id); await reloadCats(); render(); }
      catch { showToast(errMsg()); }
    } else if (e.target.classList.contains("act-edit")) {
      catModal(c, async () => { await reloadCats(); render(); });
    }
  });
}

// ── Vue Revenus ───────────────────────────────────────────────

function renderRevenus() {
  const d = state.revDefault || { ludovic: 0, marie_laure: 0, aides: 0 };
  const m = state.revMonth;
  const usingOverride = !!m;
  const v = m || d;

  $("app").innerHTML = header(`
    <section class="space-y-4">
      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
        <p class="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">Revenus du mois — ${monthLabel(state.cur)}</p>
        <div class="space-y-2">
          <div>
            <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Ludovic</label>
            <input id="rv-l" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${v.ludovic}" />
          </div>
          <div>
            <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Marie-Laure</label>
            <input id="rv-m" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${v.marie_laure}" />
          </div>
          <div>
            <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Aides</label>
            <input id="rv-a" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${v.aides}" />
          </div>
          <div class="flex gap-2 mt-2">
            <button id="rv-save" class="flex-1 rounded-full bg-fuchsia-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-fuchsia-400 active:scale-[0.98] transition">Enregistrer pour ce mois</button>
            ${usingOverride ? `<button id="rv-reset" class="rounded-full border border-slate-700 px-4 py-2 text-[11px] text-slate-300 hover:border-fuchsia-500/60 hover:text-fuchsia-400">Revenir au défaut</button>` : ""}
          </div>
          <p class="mt-1 text-[11px] text-slate-500">${usingOverride ? "Ce mois utilise une valeur personnalisée." : "Ce mois utilise les revenus par défaut."}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-3">
        <p class="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">Valeurs par défaut (tous les mois)</p>
        <div class="space-y-2">
          <div>
            <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Ludovic</label>
            <input id="dv-l" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${d.ludovic}" />
          </div>
          <div>
            <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Marie-Laure</label>
            <input id="dv-m" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${d.marie_laure}" />
          </div>
          <div>
            <label class="text-[11px] uppercase tracking-[0.16em] text-slate-500">Aides</label>
            <input id="dv-a" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm" inputmode="decimal" value="${d.aides}" />
          </div>
          <button id="dv-save" class="mt-2 w-full rounded-full border border-slate-700 px-4 py-2 text-[11px] text-slate-300 hover:border-fuchsia-500/60 hover:text-fuchsia-400">Mettre à jour le défaut</button>
        </div>
      </div>
    </section>
  `);

  wireHeader();
  const num = (id) => { const x = parseFloat($(id).value.replace(",", ".")); return isNaN(x) ? 0 : x; };

  $("rv-save").onclick = async () => {
    try {
      await ctx.sb.from("revenu_months").upsert(
        { user_id: state.session.user.id, month: k(), ludovic: num("rv-l"), marie_laure: num("rv-m"), aides: num("rv-a") },
        { onConflict: "user_id,month" }
      );
      await loadMonth(); render();
    } catch { showToast(errMsg()); }
  };

  if ($("rv-reset")) {
    $("rv-reset").onclick = async () => {
      try { await ctx.sb.from("revenu_months").delete().eq("month", k()); await loadMonth(); render(); }
      catch { showToast(errMsg()); }
    };
  }

  $("dv-save").onclick = async () => {
    try {
      await ctx.sb.from("revenu_defaults").update({ ludovic: num("dv-l"), marie_laure: num("dv-m"), aides: num("dv-a") }).eq("user_id", state.session.user.id);
      const { data } = await ctx.sb.from("revenu_defaults").select("*").maybeSingle();
      state.revDefault = data;
      render();
    } catch { showToast(errMsg()); }
  };
}
