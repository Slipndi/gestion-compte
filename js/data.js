import { ctx } from './ctx.js';
import { state } from './state.js';
import { monthKey, shiftMonth, SEED_CATS, SEED_RECS } from './utils.js';

export async function bootstrap() {
  let { data: cats } = await ctx.sb.from("categories").select("*").order("name");
  if (!cats || cats.length === 0) {
    await ctx.sb.from("categories").insert(SEED_CATS.map(([name, color]) => ({ name, color })));
    ({ data: cats } = await ctx.sb.from("categories").select("*").order("name"));
  }
  state.categories = cats || [];

  let { data: rd } = await ctx.sb.from("revenu_defaults").select("*").maybeSingle();
  if (!rd) {
    await ctx.sb.from("revenu_defaults").insert({ ludovic: 2640, marie_laure: 2300, aides: 616 });
    ({ data: rd } = await ctx.sb.from("revenu_defaults").select("*").maybeSingle());
  }
  state.revDefault = rd;

  const { data: recs } = await ctx.sb.from("recurrents").select("*").order("amount", { ascending: false });
  state.recurrents = recs || [];

  await loadMonth();
}

export async function loadMonth() {
  const key = monthKey(state.cur);
  const [{ data: deps }, { data: rm }, { data: trendDeps }] = await Promise.all([
    ctx.sb.from("depenses").select("*").eq("month", key).order("spent_on", { ascending: false }),
    ctx.sb.from("revenu_months").select("*").eq("month", key).maybeSingle(),
    ctx.sb.from("depenses").select("month,category_id,amount")
      .in("month", [3, 2, 1].map(n => monthKey(shiftMonth(state.cur, -n)))),
  ]);
  state.depenses = deps || [];
  state.revMonth = rm || null;

  const priorKeys = [3, 2, 1].map(n => monthKey(shiftMonth(state.cur, -n)));
  const byMonth = {};
  priorKeys.forEach(mk => { byMonth[mk] = {}; });
  (trendDeps || []).forEach(d => {
    if (!byMonth[d.month]) return;
    const cid = d.category_id || "∅";
    byMonth[d.month][cid] = (byMonth[d.month][cid] || 0) + Number(d.amount);
  });
  state.trend = priorKeys.map(mk => ({ month: mk, byCat: byMonth[mk] }));
}

export async function reloadRecs() {
  const { data } = await ctx.sb.from("recurrents").select("*").order("amount", { ascending: false });
  state.recurrents = data || [];
}

export async function reloadCats() {
  const { data } = await ctx.sb.from("categories").select("*").order("name");
  state.categories = data || [];
}
