/**
 * 授权一致性回归 — 对比分析
 * 比较 legacy（9.7 官方）与 ingress（10.3 compat）的 commandAuthorized 输出，
 * 输出差异明细与统计报告。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const cases = JSON.parse(readFileSync('./reports/auth-consistency/cases.json', 'utf8'));
const legacy = JSON.parse(readFileSync('./reports/auth-consistency/legacy-results.json', 'utf8'));
const ingress = JSON.parse(readFileSync('./reports/auth-consistency/ingress-results.json', 'utf8'));

const byId = new Map(cases.map((c) => [c.id, c]));
const norm = (v) => (v === undefined ? null : v);

let same = 0;
let diff = 0;
const diffs = [];
for (let i = 0; i < legacy.length; i++) {
  const l = legacy[i];
  const g = ingress[i];
  const lv = norm(l.commandAuthorized);
  const gv = norm(g.commandAuthorized);
  if (l.error || g.error) {
    diff++;
    diffs.push({ id: l.id, legacyError: l.error, ingressError: g.error });
    continue;
  }
  if (lv === gv) {
    same++;
  } else {
    diff++;
    diffs.push({
      id: l.id,
      legacy: lv,
      ingress: gv,
      case: byId.get(l.id),
    });
  }
}

// 差异归类：按 isGroup/dmPolicy/是否因 undefined 语义差异
const byCategory = {};
for (const d of diffs) {
  const c = d.case ?? {};
  const key = `${c.isGroup ? 'group' : 'direct'}|${c.dmPolicy}`;
  byCategory[key] = (byCategory[key] ?? 0) + 1;
}

const report = {
  total: legacy.length,
  same,
  diff,
  diffRatio: `${((diff / legacy.length) * 100).toFixed(2)}%`,
  categories: byCategory,
  samples: diffs.slice(0, 20).map((d) => ({
    id: d.id,
    legacy: d.legacy,
    ingress: d.ingress,
    isGroup: d.case?.isGroup,
    dmPolicy: d.case?.dmPolicy,
    allowFrom: d.case?.allowFrom,
    groupAllowFrom: d.case?.groupAllowFrom,
    senderId: d.case?.senderId,
    store: d.case?.store,
    shouldCompute: d.case?.shouldCompute,
  })),
};

writeFileSync('./reports/auth-consistency/consistency-report.json', JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
