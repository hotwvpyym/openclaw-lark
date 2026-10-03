# Changelog

All notable changes to this project are documented in this file.

## 2026.9.7.0 — 2026-10-03（正式发布版）

**发布就绪变更：**

- 包名改为 `@hotwvpyym/openclaw-lark`（npm scope 匹配 ClawHub 发布者，符合 ClawHub 发布规则）
- `openclaw.plugin.json` 的 `install.npmSpec` 同步更新
- 补充 `license: "MIT"` 字段（与 LICENSE 文件一致）
- 补充 `openclaw.build.openclawVersion: "2026.9.7"`（ClawHub 发布前置字段）
- README 全面改写：非官方声明、问题说明、兼容矩阵、安装使用、风险免责、反馈通道

**功能内容与 2026.9.6.11 一致：**

- 修复：卡片页脚 `tokens/cache/context/model` 指标在 OpenClaw 2026.9.7+ 丢失（agent 归属解析兜底）
- 修复：日历等 13 个文件 20 处 `page_size` 上下限按飞书官方文档全量补齐，calendar 系列增加运行时钳制（双保险）
- 优化：会话快照探测削峰（720 → ≤60 次/轮）、高频日志降噪、AbortController 生命周期管理
- 兼容：OpenClaw 2026.8.1 及以上全线（8.1 / 8.35 / 9.6 / 9.7 / 9.8 实证）

---

## 2026.9.6.11

- 修复：日历等 13 文件 20 处 `page_size` 上下限全量补齐（按飞书开放平台文档：calendar.list `[50,1000]`、event.search `[1,100]`、event.attendee `[10,100]`、task-v2 全系 `[1,100]`、wiki `[1,50]` 等）
- 修复：calendar 系列 execute 增加运行时钳制（`Math.min(max, Math.max(min, ps))` 防御模型违规）
- 清理上一版本批量注入产生的语法问题

## 2026.9.6.10

- 新增：流式卡片请求 AbortController 生命周期管理（可中断、随网关关闭清理）
- 优化：`not available` 日志降级 debug

## 2026.9.6.9

- 优化：会话快照探测削峰（SDK 探测一次缓存，每轮主组合 720 次 → ≤60 次）
- 优化：4 处高频日志 info → debug

## 2026.9.6.8

- **核心修复**：卡片页脚 `tokens / cache / context / model` 指标恢复显示
  - 根因：OpenClaw 2026.9.7 起会话存储改为 per-agent SQLite，agent 归属解析抛出 `AgentSelectionRequiredError` 被外层 catch 吞掉
  - 修复：`streaming-card-controller.ts` 与 `tool-use-config.ts` 两处 try/catch 兜底回退

## 2026.9.6.x（前序适配）

- 插件加载 / 飞书频道启动 / 收发消息适配 OpenClaw 9.6/9.7（对齐官方 9.6 基线）
