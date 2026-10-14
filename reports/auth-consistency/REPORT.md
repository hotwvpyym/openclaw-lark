# 授权一致性回归报告（openclaw-lark-compat 2026.10.3）

**日期**: 2026-10-14
**范围**: 对标官方 PR #638 的 3840 组参数对比方法论
**对比对象**:
- Legacy（OpenClaw 9.7 官方实现）: `openclaw/plugin-sdk/command-auth` 的 `resolveSenderCommandAuthorization`（未改动）
- Ingress（OpenClaw 10.3 实现）: 插件发布代码 `src/messaging/inbound/command-auth-compat.ts` 的 ingress 分支（与 `channel-ingress-runtime` 一致）

## 一、参数集设计（3840 组，确定性可复算）

| 维度 | 取值 | 数量 |
|---|---|---|
| isGroup | false / true | 2 |
| dmPolicy | open / pairing / allowlist / disabled | 4 |
| configuredAllowFrom | [] / ['u1'] / ['u2'] / ['*'] / ['u1','u2'] | 5 |
| configuredGroupAllowFrom | undefined / [] / ['u1'] / ['u2'] | 4 |
| senderId | u1 / u2 / '' | 3 |
| readAllowFromStore | [] / ['u1'] | 2 |
| shouldComputeCommandAuthorized | false / true | 2 |
| rawBody | 命令式 / 普通文本 | 2 |

合计 **2×4×5×4×3×2×2×2 = 3840 组**。注入的 `isSenderAllowed`（精确匹配 + 通配）与 `resolveCommandAuthorizedFromAuthorizers`（任一 configured 且 allowed 即授权）在双端完全一致。

## 二、结果总览

| 指标 | 数值 |
|---|---|
| 总组数 | 3840 |
| 一致 | **3560（92.71%）** |
| 差异 | 280（7.29%） |
| 其中 ingress 更严格（拒绝） | **280（100%）** |
| 其中 ingress 放行（风险方向） | **0** |

## 三、发现并修复的插件安全缺口

**初版对比**存在 80 组 `legacy=false / ingress=true`（风险方向），根因：

> ingress runtime 将空 senderId 归一化为 null 后，仍可能被通配 allowFrom（`*`）放行；而 legacy 注入的 `isSenderAllowed` 对空 sender 恒返回 false。

**修复**（`command-auth-compat.ts` `resolveCommandAuthorizationViaIngress`）：
```ts
if (!params.senderId) {
  return { commandAuthorized: false };
}
```
修复后 80 组风险差异归零，且与 legacy 空 sender 恒拒绝语义一致。该修复已进入 2026.10.3 发布包。

## 四、剩余 280 组差异归因（官方 10.x 语义收紧，安全方向）

全部为 `legacy=true / ingress=false`，即 OpenClaw 10.x 迁移到 `channel-ingress-runtime` 后**官方有意收紧**的授权语义，插件 10.3 版跟随官方新语义（与 10.3 主机其他渠道行为一致）：

| 归因 | 组数 | 说明 |
|---|---|---|
| direct + dmPolicy=disabled | 124 | legacy 对 disabled 策略仍可能放行（fallback 到 senderAllowed）；ingress 严格拒绝 |
| direct 会话 + groupAllowFrom 含 sender | 88 | legacy 在 direct 会话中也把 group allowlist 计入 authorizer（跨会话泄漏）；ingress 的 direct 会话不应用 group allowlist |
| 其他（group 会话 allowlist 判定细节） | 68 | ingress 的 group policy 判定更严谨（如空 groupAllowFrom、无配置时） |

## 五、结论

1. 授权一致性回归通过：**无任何"ingress 放行而 legacy 拒绝"的风险组**；
2. 空 sender 通配漏洞已修复并纳入发布包；
3. 280 组差异为官方 10.x 语义收紧（更安全），插件对齐官方 10.3 主机行为，属预期演进。

## 六、复算方法

```bash
# 1. 生成参数集
node reports/auth-consistency/gen-cases.mjs reports/auth-consistency/cases.json
# 2. legacy runner（需 openclaw@2026.9.7 SDK，pnpm 安装）
node reports/auth-consistency/runner-legacy.mjs reports/auth-consistency/cases.json reports/auth-consistency/legacy-results.json <sdk97-path>
# 3. ingress runner（工作区 10.3 node_modules）
node reports/auth-consistency/runner-ingress.mjs reports/auth-consistency/cases.json reports/auth-consistency/ingress-results.json
# 4. 对比
node reports/auth-consistency/compare.mjs
```

产物：`cases.json`（参数集）、`legacy-results.json`、`ingress-results.json`、`consistency-report.json`。
