/**
 * 授权一致性回归 — Ingress Runner（OpenClaw 10.3 SDK）
 *
 * 复刻插件发布代码 command-auth-compat.ts 的 ingress 分支
 * （resolveCommandAuthorizationViaIngress），消费 cases.json，
 * 输出 ingress-results.json。
 *
 * 运行方式（在工作区 adapted/ 下，使用 10.3 node_modules）：
 *   node reports/auth-consistency/runner-ingress.mjs <cases.json> <ingress-results.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  defineStableChannelIngressIdentity,
  resolveChannelMessageIngress,
} from 'openclaw/plugin-sdk/channel-ingress-runtime';

const [casesPath, resultsPath] = process.argv.slice(2);
if (!casesPath || !resultsPath) {
  console.error('用法: node runner-ingress.mjs <cases.json> <results.json>');
  process.exit(1);
}

const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

// 与 command-auth-compat.ts 的 resolveCommandAuthorizationViaIngress 逐行对应
async function resolveViaIngress(c) {
  const shouldCompute = c.shouldCompute;
  if (!shouldCompute) {
    return { commandAuthorized: null };
  }

  // 与 legacy command-auth 一致：空 senderId 一律不授权（见 command-auth-compat.ts）
  if (!c.senderId) {
    return { commandAuthorized: false };
  }

  const ingress = await resolveChannelMessageIngress({
    channelId: 'chat_1',
    accountId: 'acct_1',
    identity: defineStableChannelIngressIdentity({
      key: 'senderId',
      normalize: (value) => (value.length > 0 ? value : null),
      authentication: 'verified',
    }),
    subject: { stableId: c.senderId || null },
    conversation: { kind: c.isGroup ? 'group' : 'direct', id: 'chat_1' },
    event: { kind: 'message', authMode: 'inbound', mayPair: false },
    policy: {
      dmPolicy: c.dmPolicy,
      groupPolicy: 'allowlist',
      activation: { requireMention: false, allowTextCommands: true },
      command: {
        useAccessGroups: true,
        allowTextCommands: true,
        hasControlCommand: true,
        modeWhenAccessGroupsOff: 'configured',
      },
    },
    allowFrom: c.allowFrom,
    groupAllowFrom: c.groupAllowFrom ?? [],
    readStoreAllowFrom: async ({ dmPolicy }) =>
      !c.isGroup && dmPolicy !== 'allowlist' && dmPolicy !== 'open'
        ? c.store
        : [],
    command: {
      useAccessGroups: true,
      allowTextCommands: true,
      hasControlCommand: true,
      modeWhenAccessGroupsOff: 'configured',
      commandOwnerAllowFrom: c.allowFrom,
      groupOwnerAllowFrom: 'configured',
      directGroupAllowFrom: 'none',
    },
  });

  return { commandAuthorized: ingress.commandAccess?.authorized ?? null };
}

const results = [];
for (const c of cases) {
  try {
    const out = await resolveViaIngress(c);
    results.push({ id: c.id, ...out });
  } catch (e) {
    results.push({ id: c.id, error: String(e?.message ?? e) });
  }
}

writeFileSync(resultsPath, JSON.stringify(results, null, 1), 'utf8');
const errored = results.filter((r) => r.error).length;
console.log(`Ingress runner 完成: ${results.length} 组（异常 ${errored}） → ${resultsPath}`);
