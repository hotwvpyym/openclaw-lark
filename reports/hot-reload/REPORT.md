# 热更新能力评估报告（openclaw-lark-compat 2026.10.3）

**日期**: 2026-10-14
**任务**: #13 支持 openclaw 插件热更新能力（评估+流程）

## 一、OpenClaw 10.x 原生热更新机制（官方文档实证）

OpenClaw 10.x（含 2026.10.3）原生支持**插件级热重载**，不需要重启 Gateway：

| 能力 | 命令/机制 | 说明 |
|---|---|---|
| 插件更新 | `openclaw plugins update --all` / `openclaw plugins update <id>` | 批量/单插件更新；保留版本 pin 与显式 tag；打印期望/实际 hash 并请求确认 |
| 插件热重载 | `openclaw plugins reload <id>` | 插件级 reload，非 Gateway 重启 |
| 热替换语义 | startup 与 hot replacement 共用同一 prepared registry publisher | 先校验候选元数据 → drain 受影响服务/渠道 → stop & dispose 旧注册 → 注册新版本 → 发布运行时方法 |
| drain 预算 | 60 秒 pre-stop budget | 已 admit 的请求先完成；未完成则 reload 失败一次、恢复 admission、**旧 generation 继续服务**（fail-safe） |
| 失败恢复 | 替换失败且 cleanup 成功 → 恢复旧代码+配置 | 不丢失服务；重试 `openclaw plugins reload <id>` 即可 |

**关键设计**：manifest/config 校验基于元数据（不执行插件代码）；插件运行时 import 保持 lazy。

## 二、本插件热重载兼容性审计

审计 `src/` 全部运行时资源（2026-10-14，基于 10.3 构建源码）：

| 资源类型 | 位置 | 热重载风险 | 结论 |
|---|---|---|---|
| 定时器（TTL/冷却） | `auto-auth.ts`（authBatches/updateTimer/timer）、`ask-user-question.ts`（ttlTimer） | 低 | 全部带 TTL/冷却自动清理，非常驻泄漏 |
| 模块级内存 Map | `oauth.ts` pendingFlows、`auto-auth.ts` authBatches、`uatRegistry`、`pendingQuestions`、`byChatContext`、`sessionTraces`、`mcpEndpointOverride` | 低 | 会话级缓存，重载后自然重建 |
| 常驻连接 | 无插件自建 WebSocket/长连接 | 无 | Channel 连接由 OpenClaw 主机管理 |
| shutdown hook | `streaming-card-controller.ts` `registerShutdownHook` + `disposeShutdownHook` | 已实现 | 页脚指标 hook 可正确 dispose |
| AbortController | `streaming-card-controller.ts`、`oauth.ts` | 已实现 | 流式请求可中断、随网关关闭清理 |

**结论：插件无常驻资源泄漏风险，兼容 OpenClaw 10.x 的 `plugins reload` 热重载，无需额外改造。**

## 三、"是否打包热更新能力到插件中"——结论

**不打包自更新代码进插件**，理由：

1. **热更新是 OpenClaw 主机的原生能力**（reload/update 命令），插件内再实现自更新逻辑属于重复造轮子，且存在文件替换、权限、签名校验等风险；
2. 插件侧已满足"可热更新"的全部前提：npmSpec 正确（`@hotwvpyym/openclaw-lark`，npm 渠道已打通）、资源生命周期可 dispose、版本元数据完整；
3. 官方 10.x 的 reload 已带 fail-safe（失败回滚保留旧版），比自研热补丁更可靠。

**本次 10.3 版本已包含的热更新配套**：
- README（中/英）升级路径三选一：`plugins update` + `plugins reload <id>`（热更新）/ 本地 tgz 覆盖 / `gateway restart` 兜底；
- 空 sender 授权修复（本次新增）确保 reload 后授权语义一致；
- 授权一致性回归通过，新旧版本授权行为可预期。

## 四、已部署服务器升级流程（9.7 → 10.3 示例）

```bash
# 1. 确认当前版本
openclaw plugins list | grep openclaw-lark

# 2. 安装/更新到 2026.10.3（三选一）
openclaw plugins install npm-pack:/path/to/hotwvpyym-openclaw-lark-2026.10.3.tgz --force --accept-capabilities
# 或 openclaw plugins install @hotwvpyym/openclaw-lark（npm 渠道，latest 指向 2026.10.3）
# 或从 GitHub Release / ClawHub 安装

# 3. 热重载（推荐）或兜底重启
openclaw plugins reload <plugin-id>
# 若 reload 因 drain 超时失败：等负载完成后重试；仍不行则
openclaw gateway restart
```

## 五、决策记录

- 用户原方案倾向"以正式发版为主、热补丁必要性低"→ 本次确认：**利用 openclaw 原生 reload 即满足热更新诉求，无需自研热补丁脚本**；
- 可选加分项（应急 hotfix 脚本、批量一致性工具）保留在下个迭代可选清单，本次不实现。
