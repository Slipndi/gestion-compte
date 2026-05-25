import { state } from './state.js';
import { monthKey } from './utils.js';

export const k = () => monthKey(state.cur);

export function income() {
  const r = state.revMonth || state.revDefault || { ludovic: 0, marie_laure: 0, aides: 0 };
  return Number(r.ludovic) + Number(r.marie_laure) + Number(r.aides);
}

export function recsForMonth() {
  const key = k();
  return state.recurrents.filter(r =>
    r.active && r.start_month <= key && (!r.end_month || r.end_month >= key)
  );
}

export const recTotal = () => recsForMonth().reduce((s, r) => s + Number(r.amount), 0);
export const depTotal = () => state.depenses.reduce((s, d) => s + Number(d.amount), 0);
export const reste    = () => income() - recTotal() - depTotal();
