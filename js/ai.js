import { ctx } from './ctx.js';
import { state } from './state.js';
import { monthKey, shiftMonth, getFoyerConfig, showToast } from './utils.js';
import { k, income, recsForMonth, recTotal, depTotal, reste } from './calculations.js';

async function fetchHistorique(nbMonths) {
  const months = [];
  for (let i = 1; i <= nbMonths; i++) months.push(monthKey(shiftMonth(state.cur, -i)));
  const [{ data: deps }, { data: revs }] = await Promise.all([
    ctx.sb.from("depenses").select("month, amount").in("month", months),
    ctx.sb.from("revenu_months").select("month, ludovic, marie_laure, aides").in("month", months),
  ]);
  // recApprox utilise les récurrents du mois courant pour les mois passés —
  // approximation intentionnelle : les récurrents passés ne sont pas stockés.
  const recApprox = recTotal();
  return months.map(m => {
    const mDepTotal = (deps || []).filter(d => d.month === m).reduce((s, d) => s + Number(d.amount), 0);
    const mRev      = (revs || []).find(r => r.month === m);
    const mInc      = mRev
      ? Number(mRev.ludovic) + Number(mRev.marie_laure) + Number(mRev.aides)
      : income();
    return {
      mois:       m.slice(0, 7),
      revenus:    Math.round(mInc),
      recurrents: Math.round(recApprox),
      depenses:   Math.round(mDepTotal),
      reste:      Math.round(mInc - recApprox - mDepTotal),
    };
  });
}

async function buildSummaryText() {
  const foyer = getFoyerConfig();
  const hist  = await fetchHistorique(2);
  const inc   = income(), rec = recTotal(), dep = depTotal(), rst = reste();
  const revD  = state.revMonth || state.revDefault;
  const engagePct = inc > 0 ? Math.round((rec + dep) / inc * 100) : 0;
  const recPct    = inc > 0 ? Math.round(rec / inc * 100) : 0;
  const depPct    = inc > 0 ? Math.round(dep / inc * 100) : 0;
  const rstPct    = inc > 0 ? Math.round(Math.abs(rst) / inc * 100) : 0;

  const now        = new Date();
  const isCurMonth = state.cur.getFullYear() === now.getFullYear() && state.cur.getMonth() === now.getMonth();
  const lastDay    = new Date(state.cur.getFullYear(), state.cur.getMonth() + 1, 0).getDate();
  const daysLeft   = isCurMonth ? Math.max(1, lastDay - now.getDate() + 1) : lastDay;
  const perDay     = Math.round(rst / daysLeft);

  const mLabel = state.cur.toLocaleString("fr-FR", { month: "long", year: "numeric" });
  const adultes = foyer.adultes.join(" et ");

  const mermaidFlow = `\`\`\`mermaid
flowchart LR
    R["Revenus\\n${Math.round(inc)}€"] --> RC["Récurrents\\n${Math.round(rec)}€ (${recPct}%)"]
    R --> D["Dépenses\\n${Math.round(dep)}€ (${depPct}%)"]
    R --> RT["${rst >= 0 ? "Reste" : "Déficit"}\\n${Math.round(Math.abs(rst))}€ (${rstPct}%)"]
\`\`\``;

  const byCat = {};
  state.depenses.forEach(d => { byCat[d.category_id || "∅"] = (byCat[d.category_id || "∅"] || 0) + Number(d.amount); });
  const sortedCats  = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const catTextLines = sortedCats.map(([cid, amt]) => {
    const c   = state.categories.find(x => x.id === cid);
    const pct = dep > 0 ? Math.round(amt / dep * 100) : 0;
    return `  - ${c ? c.name : "Sans catégorie"} : ${Math.round(amt)}€ (${pct}%)`;
  }).join("\n") || "  (aucune dépense)";
  const mermaidPie = dep > 0 ? `\`\`\`mermaid
pie title Dépenses par catégorie — ${mLabel}
${sortedCats.map(([cid, amt]) => { const c = state.categories.find(x => x.id === cid); return `    "${c ? c.name : "Sans catégorie"}" : ${Math.round(amt)}`; }).join("\n")}
\`\`\`` : "";

  const curData      = { mois: k().slice(0, 7), revenus: Math.round(inc), recurrents: Math.round(rec), depenses: Math.round(dep), reste: Math.round(rst) };
  const chronoMonths = [...hist.slice().reverse(), curData];
  const shortLabel   = (mois) => { const d = new Date(mois + "-15"); return `"${d.toLocaleString("fr-FR", { month: "short" })} ${d.getFullYear().toString().slice(2)}"`; };
  const maxY         = Math.ceil(Math.max(...chronoMonths.map(h => Math.max(h.revenus, h.recurrents + h.depenses, 1))) / 500) * 500 + 500;
  const mermaidHist  = chronoMonths.length > 1 ? `\`\`\`mermaid
xychart-beta
    title "Historique budget (${chronoMonths.length} mois)"
    x-axis [${chronoMonths.map(h => shortLabel(h.mois)).join(", ")}]
    y-axis "Montant €" 0 --> ${maxY}
    bar [${chronoMonths.map(h => h.depenses).join(", ")}]
    line [${chronoMonths.map(h => Math.max(0, h.reste)).join(", ")}]
\`\`\`` : "";

  const recLines = recsForMonth().length
    ? recsForMonth().map(r => `  - ${r.label} : ${r.amount}€`).join("\n")
    : "  (aucun)";
  const depLines = state.depenses.length
    ? state.depenses.map(d => {
        const c = state.categories.find(x => x.id === d.category_id);
        return `  - ${d.spent_on?.slice(8, 10)}/${d.spent_on?.slice(5, 7)} · ${d.label} · ${d.amount}€${c ? ` [${c.name}]` : ""}`;
      }).join("\n")
    : "  (aucune dépense ce mois)";
  const histLines = hist.map(h => {
    const label = new Date(h.mois + "-15").toLocaleString("fr-FR", { month: "long", year: "numeric" });
    return `  - ${label} : revenus ${h.revenus}€, récurrents ${h.recurrents}€, dépenses ponctuelles ${h.depenses}€, solde ${h.reste}€`;
  }).join("\n") || "  (pas de données antérieures)";

  return `Tu es un conseiller financier personnel expert. Analyse les données budgétaires suivantes d'un foyer français et fournis des conseils financiers concrets et actionnables.

## CONTEXTE DU FOYER
- Membres : ${adultes} + ${foyer.enfants} enfant${foyer.enfants > 1 ? "s" : ""}
- Période analysée : ${mLabel}

## VUE D'ENSEMBLE DU BUDGET

${mermaidFlow}

## DONNÉES FINANCIÈRES

### REVENUS MENSUELS
Total : ${Math.round(inc)}€
- ${foyer.adultes[0]} : ${Math.round(Number(revD?.ludovic || 0))}€
- ${foyer.adultes[1]} : ${Math.round(Number(revD?.marie_laure || 0))}€
- Aides sociales : ${Math.round(Number(revD?.aides || 0))}€

### CHARGES FIXES (RÉCURRENTES)
Total : ${Math.round(rec)}€ (${recPct}% des revenus)
${recLines}

### DÉPENSES DU MOIS EN COURS
Total engagé : ${Math.round(dep)}€
Reste disponible : ${Math.round(rst)}€ | Budget quotidien restant : ${perDay}€/jour
Taux d'engagement global (récurrents + dépenses / revenus) : ${engagePct}%

### RÉPARTITION PAR CATÉGORIE

${mermaidPie}

${catTextLines}

### DÉTAIL DES DÉPENSES DU MOIS
${depLines}

### HISTORIQUE

${mermaidHist}

${histLines}
Note : récurrents dans l'historique = charges fixes actuelles (approximation).

## ANALYSE DEMANDÉE

Réponds en français, de manière structurée, avec des chiffres précis. Appuie-toi sur les diagrammes fournis.

1. **Santé financière globale** : Évalue l'équilibre revenus / charges fixes / dépenses variables. Le taux d'engagement de ${engagePct}% est-il sain pour ce foyer ?

2. **Points d'attention** : Identifie les postes inhabituellement élevés ou les tendances préoccupantes par rapport à l'historique.

3. **Recommandations concrètes** : Donne 3 à 5 actions spécifiques et réalistes pour optimiser ce budget ce mois-ci et les suivants.

4. **Projection de fin de mois** : Basé sur le rythme actuel et le budget de ${perDay}€/jour sur ${daysLeft} jours restants, estime le solde final et si un dépassement est probable.

5. **Tendance historique** : Ce mois se comporte-t-il mieux ou moins bien que les mois précédents ? Y a-t-il une dérive à corriger ?`;
}

export async function copierPromptIA() {
  const btn = document.getElementById("ouvrir-claude-btn");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Génération…";
  try {
    const text = await buildSummaryText();
    await navigator.clipboard.writeText(text);
    btn.textContent = "✓ Prompt copié !";
    setTimeout(() => { btn.textContent = "Copier le prompt IA"; btn.disabled = false; }, 3000);
  } catch {
    btn.textContent = "Erreur — réessayer";
    btn.disabled = false;
    showToast("Impossible de copier. Vérifiez les permissions du navigateur.");
  }
}
