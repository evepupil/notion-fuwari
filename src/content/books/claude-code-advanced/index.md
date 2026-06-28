---
title: 'Claude Code 高级使用 · 系统学习教程'
author: '基于 Claude Code 官方文档整理'
description: '基于官方文档整理的 8 篇 Claude Code 进阶教程，按由内功到招式的顺序编排，面向想系统补齐高级技巧的开发者。'
published: 2026-06-11
updated: 2026-06-15
image: ''
tags: ['Claude Code', '教程', 'AI Agent', '效率']
status: 'completed'
draft: false
---

基于 [Claude Code 官方文档](https://code.claude.com/docs/zh-CN/overview) 整理的 8 篇进阶教程,按"由内功到招式"的顺序编排。面向已在日常使用 Claude Code、想系统补齐高级技巧的开发者。

> 学习原则:**先练内功(01–02),再学招式(03+)**。每一阶段都挑一个真实项目里的痛点去落地,比单纯读文档有效得多。

## 路线总览

| # | 文章 | 主题 | 定位 | 建议投入 |
|---|---|---|---|---|
| 00 | [地基校准](/books/claude-code-advanced/00-foundations/) | 引擎原理与交互基础 | 查漏补缺 | 0.5 天 |
| 01 | [上下文工程](/books/claude-code-advanced/01-context-engineering/) | CLAUDE.md / 记忆 / 上下文窗口 / 缓存 | ⭐ 核心内功 | 1–2 天 |
| 02 | [工作流与会话控制](/books/claude-code-advanced/02-workflow-and-sessions/) | 计划模式 / 权限 / 检查点 / 会话 | 重点 | 1–2 天 |
| 03 | [定制与扩展](/books/claude-code-advanced/03-customization-and-extensions/) | Skill / Hook / Subagent / Plugin | ⭐ 重中之重 | 3–5 天 |
| 04 | [MCP 与工具集成](/books/claude-code-advanced/04-mcp-and-tools/) | MCP 作用域 / 工具命名 / Tool Search | 重点 | 1–2 天 |
| 05 | [多代理与编排](/books/claude-code-advanced/05-multi-agent-orchestration/) | 并行代理 / agent view / workflows | 进阶 | 2–3 天 |
| 06 | [自动化与无人值守](/books/claude-code-advanced/06-automation/) | headless / routines / CI / 沙箱 | 进阶 | 2–3 天 |
| 07 | [Agent SDK](/books/claude-code-advanced/07-agent-sdk/) | 用引擎构建自己的代理 | 可选专精 | 按需 |

## 推荐学习顺序

```
00 地基校准(快速扫一遍,确认没盲区)
        │
        ▼
01 上下文工程 ───► 02 工作流与会话控制     ← 内功,务必扎实
        │
        ▼
03 定制与扩展(四件套,最长一篇)          ← 招式主战场
        │
        ▼
04 MCP 与工具集成
        │
        ▼
05 多代理与编排 ───► 06 自动化与无人值守    ← 横向扩展
        │
        ▼
07 Agent SDK(想做产品再学,否则可暂时跳过)
```

## 进度自测清单

每篇文末都有"掌握标志"自测项,这里是阶段级里程碑:

- [ ] 00 · 能说清一次 agent 回合发生了什么,区分交互模式与 `claude -p`
- [ ] 01 · 能为真实项目写出高质量分层 CLAUDE.md,会用 `/context`、`/compact` 管理上下文
- [ ] 02 · 改动前用计划模式对齐方案,会按场景切权限模式,能回滚与续接会话
- [ ] 03 · 遇到重复劳动能判断该做成 Skill 还是 Hook,并能打包成 Plugin 分发
- [ ] 04 · 能新接一个 MCP server 并管理作用域,理解工具如何消耗上下文
- [ ] 05 · 能判断任务该单代理串行还是多代理并行,清楚其成本
- [ ] 06 · 能把一个重复性运维/审查任务变成定时自动跑的流水线
- [ ] 07 · 能用 SDK 写一个带自定义工具、结构化输出、权限控制的最小代理

## 贯穿全程的习惯

- **跟踪新特性**:[What's new 周报](https://code.claude.com/docs/zh-CN/whats-new) + [Changelog](https://code.claude.com/docs/zh-CN/changelog),Claude Code 迭代极快。
- **反复回读**[最佳实践](https://code.claude.com/docs/zh-CN/best-practices),不同阶段读有不同收获。
- **成本意识**:学到 05–06 前先读一遍[成本管理](https://code.claude.com/docs/zh-CN/costs),避免多代理/定时任务烧钱。

---

*教程内容基于官方文档整理,Claude Code 更新频繁,具体命令与配置字段请以[官方文档](https://code.claude.com/docs/zh-CN/overview)最新版本为准。*

