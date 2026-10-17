// Loads the real pure .gs files into one Node sandbox, like Apps Script's shared global scope.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Same time zone as appsscript.json, so calendar-day maths matches Apps Script.
process.env.TZ = 'Asia/Ho_Chi_Minh';

const PURE_FILES = [
  'formatting-and-date-helpers.gs',
  'domain-constants.gs',
  'action-planner-common.gs',
  'action-planners-buy-and-sell.gs',
  'action-planners-money-in-and-adjust.gs',
  'cashflow-metrics-engine.gs',
  'machine-liquidity-analysis.gs',
  'action-recommendation-rules.gs',
  'dashboard-payload-builder.gs'
];

export function loadGs() {
  const gs = vm.createContext({});
  for (const file of PURE_FILES) {
    vm.runInContext(readFileSync(new URL(`../apps-script/${file}`, import.meta.url), 'utf8'), gs, { filename: file });
  }
  return gs;
}

export const day = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Applies a plan to in-memory state the way sheet-repository applies it to the Sheet. */
export function applyPlan(state, plan) {
  for (const machine of plan.newMachines) state.machines.push({ ...machine });
  for (const update of plan.updates) {
    const target = state.machines.find((m) => m.ma_may === update.ma_may);
    Object.assign(target, update.changes);
  }
  for (const row of plan.ledgerRows) state.ledger.push({ ...row });
}
