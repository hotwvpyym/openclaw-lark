# openclaw 10.3 与 9.7 修复版插件兼容性分析报告

**日期**: 2026-10-14
**背景**: 用户实证——修复版 9.7 插件在 openclaw 9.9 下正常运行、不报错；从 9.9 升级到 10.3 后开始报 `config invalid: channels.feishu: must not have additional properties: "footer"`，且回滚 openclaw 代码后依然报错。
**结论先行**: 9.7 插件与 openclaw 10.3 **不兼容**，存在两个独立 P1 问题；根因均在插件包（9.7 遗留），与 openclaw 本体版本无关——这正是"回滚后依然报错"的原因。10.3 修复版已全部解决。

---

## 一、两个不兼容点（均有实证）

### 1. command-auth 子路径移除（插件加载失败）— P1

9.7 插件源码**静态 import** `openclaw/plugin-sdk/command-auth`（git 401eaf6 `src/messaging/inbound/handler.ts:26`）：

```ts
import { resolveSenderCommandAuthorization } from 'openclaw/plugin-sdk/command-auth';
```

| 检查项 | openclaw 9.9 | openclaw 10.3 |
|---|---|---|
| `dist/plugin-sdk/command-auth.js` 文件 | ✅ **存在** | ❌ **已删除**（仅剩 `command-auth-native.js`） |
| exports 是否声明 `./plugin-sdk/command-auth` | ❌ 未声明（346 顶层 exports 中无） | ❌ 未声明 |
| 实际 import 行为 | 9.7 插件正常加载（用户实证） | **`ERR_PACKAGE_PATH_NOT_EXPORTED`（本地 10.3 SDK 实测复现）** |
| `command-auth-native` 对照 | — | ✅ 正常（28 个导出） |

**机制**：openclaw 10.x 重构插件 SDK，将命令授权入口收敛为 `command-auth-native`（官方 PR #638 佐证：官方 7.9 插件静态 import command-auth 在 10.x 加载失败）。9.9 虽 exports 未声明该子路径，但 `command-auth.js` 文件仍在（旧解析路径可达）；10.3 文件删除后静态 import 必然抛错。

**影响**：即使绕过 config 校验，9.7 插件在 10.3 上**无法完成注册**（插件加载即失败）。

### 2. manifest configSchema 空声明（配置校验失败）— P1

9.7 插件 `openclaw.plugin.json` 的 `configSchema` 为继承官方的空结构（git 401eaf6 实证）：

```json
"configSchema": { "type": "object", "additionalProperties": false, "properties": {} }
```

而插件实际支持的配置（`src/core/config-schema.ts`，含 `FEISHU_CONFIG_JSON_SCHEMA`）有 **41 个顶层字段**（footer / dmPolicy / replyMode / heartbeat / dedup / accounts…）。

| 校验行为 | openclaw 9.9 | openclaw 10.3 |
|---|---|---|
| `channels.feishu.footer` 配置 | ✅ 接受（9.7 插件正常运行，用户实证） | ❌ 拒绝（`must not have additional properties: "footer"`，用户实证） |
| 机制 | 9.9 对插件配置校验宽松（不严格应用 manifest configSchema） | 10.3 基于 manifest/schema **元数据**严格校验配置（docs.openclaw.ai 架构实证："manifest/config validation should work from manifest/schema metadata without executing plugin code"） |

**影响**：`channels.feishu.footer`（页脚六项显示开关，9.7 重点修复功能）被 10.3 校验拒绝 → 整个 openclaw config 判定 invalid → 插件安装/升级被拦。回滚 openclaw 无济于事，因为**报错方是插件 manifest 的 schema 声明缺陷**。

---

## 二、兼容矩阵

| 组合 | 结果 | 说明 |
|---|---|---|
| 9.7 插件 + openclaw **9.9** | ✅ 正常 | command-auth 文件仍在；config 校验宽松（用户实证） |
| 9.7 插件 + openclaw **10.3** | ❌ 不兼容 | ① config invalid 先拦安装/启动；② 即使绕过，command-auth import 失败（实测 `ERR_PACKAGE_PATH_NOT_EXPORTED`） |
| 10.3 修复版 + openclaw **9.9** | ✅ 兼容 | configSchema 41 字段在宽松校验下无害；compat 层走 9.x legacy 动态 import |
| 10.3 修复版 + openclaw **10.3** | ✅ 完整对齐 | config valid（footer 等 41 字段合法）；compat 层走 10.x `channel-ingress-runtime` |

---

## 三、10.3 修复版的对应处理（均已验证）

| 问题 | 9.7 插件 | 10.3 修复版 |
|---|---|---|
| command-auth | 静态 import → 10.3 必然失败 | `command-auth-compat.ts` 双路径：9.x legacy 动态 import `command-auth` / 10.x 自动切换 `channel-ingress-runtime` |
| configSchema | 空 → 10.3 拒绝 footer | 同步源码 `FEISHU_CONFIG_JSON_SCHEMA` 全部 **41 字段** → footer 六项开关等合法 |
| 授权一致性 | — | 3840 组回归（3560 一致 + 280 组官方语义收紧 + 空 sender 越权修复） |

---

## 四、升级路径建议（规避中间态不兼容）

1. **先装 10.3 修复版插件**（在 openclaw 9.9 上即可，兼容 ≥2026.8.1）：
   `openclaw plugins install npm-pack:/root/backups/hotwvpyym-openclaw-lark-2026.10.3.tgz --force --accept-capabilities` → `openclaw config validate`（应通过）
2. **再升级 openclaw 本体到 10.3**（独立步骤）：
   `openclaw update` / 官方升级通道 → `openclaw gateway restart`
3. 升级完成后确认：`openclaw -v`（10.3）+ `openclaw plugins list | grep openclaw-lark`（2026.10.3）

这样任何一步都不会出现"10.3 本体 + 9.7 插件"的不兼容中间态。
