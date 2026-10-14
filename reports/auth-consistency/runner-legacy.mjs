/**
 * 授权一致性回归 — Legacy Runner（OpenClaw 9.7 SDK）
 *
 * 使用官方 9.7 的 resolveSenderCommandAuthorization（未改动），
 * 消费 cases.json，输出 legacy-results.json。
 *
 * 运行方式（在 /tmp/sdk97 解包目录旁）：
 *   node runner-legacy.mjs <cases.json> <legacy-results.json> <sdk97-path>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [casesPath, resultsPath, sdk97Path] = process.argv.slice(2);
if (!casesPath || !resultsPath || !sdk97Path) {
  console.error('用法: node runner-legacy.mjs <cases.json> <results.json> <sdk97-package-dir>');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const moduleUrl = pathToFileURL(`${sdk97Path}/dist/plugin-sdk/command-auth.js`).href;
const { resolveSenderCommandAuthorization } = await import(moduleUrl);

const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

const isSenderAllowed = (senderId, allowFrom) =>
  senderId !== '' && (allowFrom.includes('*') || allowFrom.includes(senderId));

const resolveCommandAuthorizedFromAuthorizers = ({ authorizers }) =>
  authorizers.some((a) => a.configured && a.allowed);

const results = [];
for (const c of cases) {
  try {
    const out = await resolveSenderCommandAuthorization({
      cfg: {},
      rawBody: c.rawBody,
      isGroup: c.isGroup,
      dmPolicy: c.dmPolicy,
      configuredAllowFrom: c.allowFrom,
      configuredGroupAllowFrom: c.groupAllowFrom ?? [],
      senderId: c.senderId,
      isSenderAllowed,
      readAllowFromStore: async () => c.store,
      shouldComputeCommandAuthorized: () => c.shouldCompute,
      resolveCommandAuthorizedFromAuthorizers,
    });
    results.push({
      id: c.id,
      commandAuthorized: out.commandAuthorized ?? null,
      shouldComputeAuth: out.shouldComputeAuth,
    });
  } catch (e) {
    results.push({ id: c.id, error: String(e?.message ?? e) });
  }
}

writeFileSync(resultsPath, JSON.stringify(results, null, 1), 'utf8');
const errored = results.filter((r) => r.error).length;
console.log(`Legacy runner 完成: ${results.length} 组（异常 ${errored}） → ${resultsPath}`);
