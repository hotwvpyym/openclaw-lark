/**
 * 授权一致性回归 — 参数集生成器（对标 PR #638 的 3840 组）
 *
 * 枚举 OpenClaw 9.x legacy command-auth 与 10.x channel-ingress-runtime
 * 在相同输入下的授权决策参数组合，输出确定性参数集供双环境 runner 消费。
 *
 * 维度组合：2×4×5×4×3×2×2×2 = 3840 组
 */
const isGroups = [false, true];
const dmPolicies = ['open', 'pairing', 'allowlist', 'disabled'];
const allowFromClasses = [[], ['u1'], ['u2'], ['*'], ['u1', 'u2']];
const groupAllowFromClasses = [null, [], ['u1'], ['u2']];
const senderIds = ['u1', 'u2', ''];
const stores = [[], ['u1']];
const shouldComputes = [false, true];
const rawBodies = ['/help', 'hello'];

const cases = [];
for (const isGroup of isGroups) {
  for (const dmPolicy of dmPolicies) {
    for (const allowFrom of allowFromClasses) {
      for (const groupAllowFrom of groupAllowFromClasses) {
        for (const senderId of senderIds) {
          for (const store of stores) {
            for (const shouldCompute of shouldComputes) {
              for (const rawBody of rawBodies) {
                cases.push({
                  id: cases.length,
                  isGroup,
                  dmPolicy,
                  allowFrom,
                  groupAllowFrom,
                  senderId,
                  store,
                  shouldCompute,
                  rawBody,
                });
              }
            }
          }
        }
      }
    }
  }
}

if (cases.length !== 3840) {
  throw new Error(`参数集数量异常: ${cases.length}（应为 3840）`);
}

const out = process.argv[2] ?? './cases.json';
import('node:fs').then(({ writeFileSync }) => {
  writeFileSync(out, JSON.stringify(cases, null, 1), 'utf8');
  console.log(`参数集已生成: ${cases.length} 组 → ${out}`);
});
