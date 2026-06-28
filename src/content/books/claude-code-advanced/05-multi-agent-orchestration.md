---
title: '阶段 5 · 多代理与编排——单会话玩到头之后的横向扩展'
draft: false
---

> 当单个对话的上下文窗口、速度或协调能力成为瓶颈时，用多代理并行把工作量水平铺开。

---

## 这篇你会学到

- 并行运行代理的四种方式及其本质区别（subagent、agent view、agent teams、dynamic workflows）
- Worktree 文件隔离的工作机制与配置
- Agent view 的后台会话管理：调度、监控、附加、快捷键全貌
- Agent teams 多会话协调：启用、团队结构、任务共享、代理间通信
- Dynamic workflows 动态工作流：大规模扇出、`ultracode` 触发、保存复用
- Ultraplan 云端规划：从 CLI 启动、浏览器精修、选择执行位置
- `/code-review` 本地审查与 `ultrareview` 云端深审的定位与成本差异
- 单代理串行 vs. 多代理并行的适用判断与成本控制

---

## 为什么重要

Claude Code 的单会话模型在处理有边界的任务时效率极高，但现实工作中有两类天花板无法靠单会话突破：

1. **规模天花板**：500 个文件的迁移、全库 API 安全审计、需要从十几个来源交叉验证的研究——这些任务的中间结果会把上下文窗口撑爆，逐轮协调的质量也会随深度降级。
2. **并发天花板**：前端重构、后端改造、测试补全三件事可以完全独立进行，但单会话只能串行。

多代理编排不是把 Claude 变复杂，而是把一个大任务的协调平面从"Claude 的脑子里"转移到更可控、可观测、可复现的结构中。

---

## 核心概念

### 并行方式全景与选择依据

官方文档把四种并行方案对应到不同的协调主体和通信需求：

| 方案 | 谁协调工作 | 工作者是否相互通信 | 结果落点 | 典型规模 |
|---|---|---|---|---|
| **Subagent**（子代理） | 主会话 Claude，逐轮委派 | 只向主代理报告 | 主会话上下文 | 每轮几个 |
| **Agent view**（代理视图） | 你自己，手动调度 | 各自向你报告 | 各自会话 | 数个后台会话 |
| **Agent teams**（代理团队） | 主导代理（team lead） | 共享任务列表 + 直接消息传递 | 各自上下文 | 3–5 个队友 |
| **Dynamic workflows**（动态工作流） | 脚本，确定性逻辑 | 脚本变量持有中间结果 | 脚本 → 最终汇总 | 数十到数百个代理 |

**选择逻辑：**

- 辅助任务会产生大量中间噪声（搜索结果、日志、文件内容），你用完就扔 → **Subagent**
- 多个独立任务，你不需要全程盯着，想交付后检查 → **Agent view**
- 工作者之间需要互相讨论、质疑彼此发现 → **Agent teams**
- 任务太大超出少数几个代理的协调范围，或需要确定性可重跑的编排逻辑 → **Dynamic workflows**

### Worktree 文件隔离

并行会话最大的陷阱是多个代理同时写同一个文件，产生覆盖冲突。Worktree 是 git 的原生功能，让每个并行会话有自己的独立检出，互不干扰。

**Agent view 的自动 worktree 行为：** 每个从 agent view 调度的后台会话，在首次编辑文件前会自动移入 `.claude/worktrees/` 下的隔离 worktree。你无需手动操作。

**关闭 worktree 隔离（不推荐，仅适用于非 git 仓库等特殊场景）：**

```json
// .claude/settings.json
{
  "worktree": {
    "bgIsolation": "none"
  }
}
```

**Agent teams 的注意事项：** Agent teams 不会自动给队友创建 worktree，需要你在任务分解时手动规划文件归属，确保每个队友负责不重叠的文件集。

**Worktree 清理：** 在 agent view 里删除会话（`Ctrl+X` 按两次）会连同该会话的 worktree 一并删除，包含未提交更改。要保留工作成果，先合并或推送。从 shell 用 `claude rm <id>` 删除时，有未提交更改的 worktree 会被保留并打印路径。

---

### Agent view：后台代理一屏观察

`claude agents` 打开 agent view，这是所有后台会话的统一仪表盘（研究预览，需要 v2.1.139+）。

**核心使用流程：**

```powershell
# 打开 agent view
claude agents

# 限定到特定项目目录（v2.1.141+）
claude agents --cwd D:\projects\my-app

# 直接从 shell 调度后台会话
claude --bg "investigate the flaky SettingsChangeDetector test"

# 指定会话名称
claude --bg --name "flaky-test-fix" "investigate the flaky SettingsChangeDetector test"

# 指定子代理作为主代理运行
claude --agent code-reviewer --bg "address review comments on PR 1234"
```

打印的 session ID 可用于后续 shell 操作：

```powershell
claude attach 7c5dcf5d      # 附加到该会话
claude logs 7c5dcf5d        # 查看最近输出
claude stop 7c5dcf5d        # 停止会话
claude rm 7c5dcf5d          # 从列表删除
claude respawn 7c5dcf5d     # 重启会话（保留对话历史）
claude respawn --all        # 重启所有运行中的会话
```

**状态图标速查：**

| 图标 | 含义 |
|---|---|
| 动画 `✽` | 积极工作中 |
| 黄色 | 等待你的输入或权限决定 |
| 暗淡 | 空闲，等待下一个提示 |
| 绿色 | 任务完成 |
| 红色 | 以错误结束 |
| 灰色 | 已停止 |
| `∙`（进程已退出） | 可恢复，附加时从中断处重启 |
| `✢` | `/loop` 定时任务，显示运行计数和倒计时 |

**关键快捷键：**

| 快捷键 | 操作 |
|---|---|
| `Space` | 打开/关闭窥视面板（查看最近输出，可直接回复） |
| `Enter` / `→` | 附加到该会话（进入完整对话） |
| `←`（空提示时） | 分离并返回 agent view |
| `Ctrl+Z` | 立即分离（会话继续运行） |
| `Ctrl+T` | 固定会话（空闲时保持进程运行） |
| `Ctrl+R` | 重命名会话 |
| `Ctrl+X`（两次） | 停止并删除会话 |
| `Ctrl+S` | 切换分组方式（状态/目录） |
| `Shift+Enter` | 调度并立即附加 |
| `?` | 显示所有快捷键 |

**调度输入前缀技巧：**

| 输入格式 | 效果 |
|---|---|
| `<agent-name> <prompt>` | 以指定子代理作为主代理运行 |
| `@<agent-name>` | 同上，在提示任何位置均可 |
| `@<repo>` | 在子目录仓库中运行会话 |
| `! <command>` | 运行 shell 命令作为后台作业（不启动 Claude 会话） |
| `/<command>` | 触发 skill 或命令作为首条提示 |

**过滤会话：** 在调度输入框中输入以下格式即触发过滤而非调度：`a:<name>`（按代理名称）、`s:<state>`（按状态，如 `s:working`）、`#<PR编号>` 或 PR URL。

**后台会话架构：** 会话由独立的监督进程（supervisor）托管，与终端解耦。关闭 agent view、关闭 shell，会话继续运行。机器休眠时会话保留，关机才停止。监督进程自动检测 Claude Code 更新并平滑重启。查看状态：

```powershell
claude daemon status
```

---

### Agent Teams：多会话协调

Agent teams 是实验性功能，默认禁用（需要 v2.1.32+）。

**启用方式：**

```json
// ~/.claude/settings.json 或项目 .claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**架构：**

| 组件 | 角色 |
|---|---|
| Team lead | 创建团队、生成队友、协调工作的主 Claude Code 会话 |
| Teammates | 各自处理分配任务的独立 Claude Code 实例 |
| Task list | 队友认领和完成的共享工作项列表（含依赖关系和文件锁） |
| Mailbox | 代理间直接消息传递系统 |

团队配置存储在 `~/.claude/teams/{team-name}/config.json`，任务列表存储在 `~/.claude/tasks/{team-name}/`。

**与 Subagent 的核心区别：**

| 维度 | Subagent | Agent teams |
|---|---|---|
| 通信方向 | 只向主代理汇报 | 队友直接相互发消息 |
| 协调机制 | 主代理逐轮决定 | 共享任务列表 + 自我认领 |
| 最强项 | 专注任务、只需结果 | 需要讨论协作的复杂工作 |
| 令牌成本 | 较低（结果汇总回主上下文） | 较高（每个队友是独立 Claude 实例） |

**启动团队（自然语言描述即可）：**

```text
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Create an agent team to explore this from different angles: one
teammate on UX, one on technical architecture, one playing devil's advocate.
```

**控制队友的关键操作：**

- **in-process 模式**（默认，任何终端可用）：`Shift+Down` 循环切换队友，按 `Enter` 查看会话，`Escape` 中断当前轮次，`Ctrl+T` 切换任务列表
- **split-pane 模式**（需要 tmux 或 iTerm2）：每个队友独立窗格，点击即交互

设置默认显示模式：

```json
// ~/.claude/settings.json
{
  "teammateMode": "in-process"
}
```

单次覆盖：

```powershell
claude --teammate-mode in-process
```

**要求计划审批（适用于有风险的任务）：**

```text
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

队友在计划模式下工作直到 lead 批准，拒绝后队友修订并重新提交。

**质量门 hooks（在 settings.json 中配置）：**

- `TeammateIdle`：队友即将空闲时触发；以代码 2 退出可发送反馈并保持队友继续工作
- `TaskCreated`：任务创建时触发；以代码 2 退出可阻止创建
- `TaskCompleted`：任务完成时触发；以代码 2 退出可阻止标记完成

**清理团队（始终通过 lead 执行）：**

```text
Clean up the team
```

先关闭所有队友，再让 lead 清理共享资源。

**已知限制（截至当前版本）：**

- in-process 队友不支持 `/resume` 和 `/rewind`
- 任务状态可能滞后，有时需要手动推进
- 每个 lead 会话同时只能管理一个团队
- 队友无法创建子团队（无嵌套团队）
- split-pane 模式在 VS Code 集成终端、Windows Terminal 上不支持

---

### Dynamic Workflows：大规模扇出

动态工作流是一个 JavaScript 脚本，由运行时在后台编排大量子代理（研究预览，需要 v2.1.154+，所有付费计划可用）。

**与其他方案的关键差别：** 工作流把计划逻辑放进代码，Claude 的上下文只持有最终答案，中间结果存在脚本变量里。这使得：

- 编排本身可重复执行（保存为命令后每次运行相同脚本）
- 规模可达每次运行数十到数百个代理（上限 1000）
- 支持对抗性验证：让代理互相质疑发现，过滤误报

**触发方式一：关键字 `ultracode`**

在普通提示中包含 `ultracode` 关键字，Claude 会为该任务编写并运行工作流脚本：

```text
ultracode: audit every API endpoint under src/routes/ for missing auth checks
```

**触发方式二：设置 ultracode 努力级别**

```text
/effort ultracode
```

启用后，Claude 为会话中每个实质性任务自动规划工作流。令牌消耗显著增加，完成后用 `/effort high` 降级：

```text
/effort high
```

**触发方式三：直接运行捆绑工作流**

```text
/deep-research What changed in the Node.js permission model between v20 and v22?
```

`/deep-research` 是内置工作流：多角度扇出网络搜索、获取来源、交叉检查、投票过滤、生成引用报告。

**监控运行进度：**

```text
/workflows
```

进度视图按阶段展示代理计数、令牌使用和耗时。快捷键：`↑`/`↓` 选择阶段、`Enter`/`→` 深入查看、`p` 暂停/恢复、`x` 停止、`r` 重启代理、`s` 保存脚本为命令。

**保存工作流为可复用命令：** 在 `/workflows` 视图中按 `s`，选择保存位置：

- `.claude/workflows/`（项目级，随仓库共享）
- `~/.claude/workflows/`（用户级，所有项目可用）

保存后，工作流在未来会话中可通过 `/<name>` 调用，并支持传参：

```text
Run /triage-issues on issues 1024, 1025, and 1030
```

脚本通过全局变量 `args` 接收输入，无需解析即可直接使用数组和对象方法。

**运行时约束（需了解）：**

- 最多 16 个并发代理（CPU 核心受限机器更少）
- 每次运行上限 1000 个代理
- 工作流本身无直接文件系统或 shell 访问，只能通过子代理操作
- 无法在运行中途接受用户输入（只有权限提示可以暂停）
- 暂停后可恢复，已完成代理返回缓存结果

**成本控制建议：** 先在小范围运行（单目录、窄问题），观察 `/workflows` 视图中的令牌消耗，确认可控后再扩大范围。

---

### Ultraplan：云端规划

Ultraplan 把规划任务交给云端的 Claude Code on the web 会话（研究预览，需要 v2.1.91+，仅 Anthropic 直连可用，Bedrock/Vertex AI/Foundry 不支持）。

**触发方式：**

```text
# 命令方式
/ultraplan migrate the auth service from sessions to JWTs

# 关键字方式（在普通提示任意位置包含 ultraplan）
ultraplan migrate the auth service from sessions to JWTs

# 从本地计划升级（本地计划完成后在批准对话框选择 "No, refine with Ultraplan"）
```

**工作流程：**

1. CLI 状态指示器显示进度（`◇ ultraplan` → `◆ ultraplan ready`）
2. 状态变为 ready 后，在浏览器打开会话链接，进入专用审查视图
3. 内联评论具体段落，表情符号反应快速标注，大纲侧边栏跳转
4. Claude 根据评论修订计划，可多轮迭代
5. 选择执行位置：在云端实现（`Approve Claude's plan and start coding`）或发回终端（`Approve plan and teleport back to terminal`）

发回终端后，对话框提供三个选项：`Implement here`（注入当前对话）、`Start new session`（清空对话仅以计划为上下文重启）、`Cancel`（保存到文件稍后处理）。

**注意：** Remote Control 开启时 ultraplan 启动会断开连接，因为两者都占用 claude.ai/code 界面，一次只能连接一个。

---

### `/code-review`：本地审查

`/code-review` 是 Claude Code 内置 skill，在本地会话中审查当前差异：

```text
/code-review
/code-review --comment    # 将发现作为内联 PR 评论发布
/code-review --fix        # 审查后直接应用修复到工作树
/code-review ultra        # 触发 ultrareview 云端深审
```

传递路径或 PR 引用审查特定目标：

```text
/code-review src/auth/
/code-review 1234
```

努力级别影响覆盖广度：低努力级别返回少量高置信度发现，`high` 到 `max` 覆盖更广但可能含不确定发现。默认使用会话当前努力级别。

`/code-review --fix` 流程：审查 → 发现 → 直接修改工作树，适合快速修复已知问题类别。

**注意版本变更：** v2.1.147 之前该命令叫 `/simplify` 且默认应用修复。v2.1.154 起 `/simplify` 变为独立的"仅清理"审查命令（只做重用/简化/效率清理，不查 bug）。如果你有依赖旧 `/simplify` 的脚本，改用 `/code-review --fix`。

---

### Ultrareview：云端多代理深审

Ultrareview 在云端沙箱中启动一队代理并行审查，每个发现都经过独立复现和验证（需要 v2.1.86+，需要 claude.ai 账户认证，Bedrock/Vertex AI/Foundry 不支持，零数据保留组织不可用）。

**触发方式（均为用户主动调用，Claude 不会自动发起）：**

```text
# 审查当前分支与默认分支的差异
/code-review ultra

# 审查指定 PR（远程沙箱直接克隆）
/code-review ultra 1234

# 非交互式（CI/脚本中使用）
claude ultrareview
claude ultrareview 1234
claude ultrareview origin/main
```

非交互式标志：

```powershell
claude ultrareview --json           # 输出原始 bugs.json
claude ultrareview --timeout 30     # 最大等待分钟数（默认 30）
```

**与本地 `/code-review` 的定位差异：**

| 维度 | `/code-review` | `/code-review ultra` |
|---|---|---|
| 运行位置 | 本地会话 | 云端沙箱（远程） |
| 审查深度 | 单次 | 多代理队列 + 独立验证 |
| 耗时 | 秒级到分钟级 | 约 5–10 分钟 |
| 成本 | 计入正常使用量 | 额外使用量计费（免费次数用完后约 $5–$20） |
| 适用时机 | 迭代中快速反馈 | 合并前重大变更的信心保障 |

**定价与免费次数：**

| 计划 | 免费运行 | 用完后 |
|---|---|---|
| Pro / Max | 每账户 3 次（一次性，不刷新） | 额外使用量计费 |
| Team / Enterprise | 无免费次数 | 额外使用量计费 |

**启动前确认对话框会显示：** 审查范围（文件数、行数）、剩余免费次数、预估成本。确认后在后台运行，用 `/tasks` 监控进度，完成后验证发现出现在会话通知中。停止审查（`/tasks` 中操作）会存档云会话，部分发现不会返回。

**重要：ultrareview 是用户主动触发的工具，按量计费，Claude 自身不能也不会擅自启动。**

---

## 实操示例（可直接照做）

### 示例一：用 agent view 并行处理三个独立任务

**场景：** 你有三个互不依赖的任务：修复一个 flaky test、审查一个 PR、调研一个库。

```powershell
# 打开 agent view
claude agents

# 在调度输入框依次回车三行（每行启动独立会话）
investigate the flaky SettingsChangeDetector test in src/
review PR #142 for correctness issues
research best practices for JWT refresh token rotation in 2025

# 然后用 Alt+1 / Alt+2 / Alt+3 快速切换到各会话
# 或 Space 打开窥视面板查看进度并快速回复
```

三个会话各自在 worktree 中运行，互不干扰。你可以切到其他工作，等状态图标变绿后回来。

---

### 示例二：用 dynamic workflow 审计全库 API 权限

**场景：** 需要检查 `src/routes/` 下所有 API endpoint 是否缺少鉴权检查。

```text
ultracode: audit every API endpoint under src/routes/ for missing auth checks.
Report file path, line number, endpoint path, and HTTP method for each issue found.
```

Claude 编写工作流脚本，每个 endpoint 一个子代理，独立审查后汇总。用 `/workflows` 观察进度。

若觉得结果可复用，在 `/workflows` 视图按 `s` 保存为 `/auth-audit` 命令，下次直接 `/auth-audit` 运行。

---

### 示例三：用 agent teams 进行竞争性 Bug 调查

**场景：** 用户反映登录后偶尔直接退出登录，根因不明。

```text
Users report being logged out immediately after login.
Spawn 4 agent teammates to investigate different hypotheses in parallel.
Hypothesis 1: JWT token expiry misconfiguration
Hypothesis 2: Race condition in session storage
Hypothesis 3: CORS or cookie sameSite issue
Hypothesis 4: Load balancer session affinity problem

Have teammates actively try to disprove each other's theories through
direct messaging. Record consensus in docs/bug-investigation.md
```

四个队友分头调查，通过 mailbox 互相质疑，存活下来的理论质量更高。用 `Shift+Down` 循环查看各队友状态。

---

### 示例四：用 ultraplan 规划大型重构

**场景：** 需要把 auth 服务从 session-based 切换到 JWT，想要精细化的分步计划再动手。

```text
/ultraplan migrate the auth service from sessions to JWTs,
considering backward compatibility, gradual rollout, and rollback strategy
```

等待云端会话完成规划（CLI 显示 `◆ ultraplan ready`），在浏览器对各步骤加内联评论，Claude 修订后选择 `Approve plan and teleport back to terminal`，然后选 `Implement here` 开始执行。

---

### 示例五：合并前运行 ultrareview

**场景：** 大型 auth 重构 PR 准备合并，想做一次深度审查。

```text
/code-review ultra 142
```

确认对话框后后台运行。继续其他工作，5–10 分钟后会话通知弹出发现列表。每条发现有文件位置和解释，可直接要求 Claude 修复：

```text
Fix the race condition reported in src/auth/session.ts:142
```

---

## 动手练习（递进）

### 练习 1：初识 agent view（基础）

1. 打开 `claude agents`，熟悉界面布局
2. 输入提示 `list all TypeScript files in this project and count lines of code per file`，按 Enter 调度
3. 用 `Space` 打开窥视面板观察进度，等完成后附加查看完整结果
4. 按 `←` 分离回 agent view，用 `Ctrl+X` 两次删除该会话
5. 验证：`.claude/worktrees/` 下对应 worktree 是否已清理

### 练习 2：并行三任务（进阶）

1. 在你的项目中，找三个互不相关的小任务（如：查某函数的所有调用方、列出未测试的函数、检查某目录下的 TODO 注释）
2. 在 agent view 依次调度三个会话
3. 用 `Alt+1`/`Alt+2`/`Alt+3` 快速切换监控
4. 对等待输入的会话用窥视面板直接回复，无需附加
5. 记录三个任务的总耗时，对比估计单会话串行需要多久

### 练习 3：保存并复用工作流（中级）

1. 在项目中运行：`ultracode: find all console.log statements that include sensitive data like passwords, tokens, or secrets`
2. 等工作流完成，打开 `/workflows` 视图
3. 选中该运行，按 `s` 保存为用户级命令（`~/.claude/workflows/`）
4. 启动新会话，直接运行 `/sensitive-log-scan`（或你保存的名称）验证可复用

### 练习 4：agent teams 并行探索（中高级）

1. 确保 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 已在 settings.json 配置
2. 选择一个你项目中待决策的技术方案（如：状态管理用 Redux 还是 Zustand）
3. 提示：`Create an agent team with 3 teammates: one advocates Redux, one advocates Zustand, one plays devil's advocate on both. Have them debate and reach a recommendation in docs/state-management-decision.md`
4. 用 `Shift+Down` 观察各队友活动，直接向任一队友发送追问
5. 查看最终文档，评估多角度探索的质量

### 练习 5：ultrareview 深审（高级，需消耗免费次数或额度）

1. 在项目中创建一个功能分支，做一些有意义的代码变更（建议选有业务逻辑的部分）
2. 运行 `/code-review` 做本地审查，记录发现
3. 运行 `/code-review ultra` 做云端深审，确认计费信息后启动
4. 对比两次审查的发现差异：深审是否发现了本地审查遗漏的问题？
5. 对有价值的发现要求 Claude 直接修复并提交

---

## 常见坑与注意事项

### 文件冲突

Agent teams 队友共享工作目录，无自动 worktree 隔离。两个队友编辑同一文件必然产生覆盖。**解决：** 在分配任务时明确划分文件归属，每个队友持有不重叠的文件集。

### Windows PowerShell 的 split-pane 限制

Agent teams 的 split-pane 模式需要 tmux 或 iTerm2，在 Windows Terminal、VS Code 集成终端上不支持。Windows 用户只能用 in-process 模式（`"teammateMode": "in-process"`），用 `Shift+Down` 循环切换队友。

### 权限提示瀑布

队友的权限请求会冒泡到 lead，在复杂任务中会产生大量中断。**解决：** 在启动 agent teams 前，在 `.claude/settings.json` 的 `allowedTools` 中预批准常见操作。

### ultrareview 免费次数不刷新

Pro/Max 用户每账户只有 3 次免费 ultrareview。一次运行在远程会话启动后即计数，提前中止也消耗一次。用完后按额外使用量计费，需要先在账户设置中开启额外使用量，否则 Claude Code 会阻止启动。

### 工作流成本估计偏差

工作流的实际令牌消耗难以预估，特别是有循环和动态扇出的脚本。**建议：** 始终先在小范围运行，用 `/workflows` 实时观察令牌计数，随时按 `x` 停止过度消耗的运行。已完成代理的工作会缓存，重启后不重算。

### agent view 的 bypassPermissions 限制

从 agent view 调度的会话若需要 `auto` 或 `bypassPermissions` 模式，必须先通过交互式 `claude` 会话接受一次该模式，才能在后台会话中使用。

```powershell
# 打开 agent view 时指定权限模式（v2.1.142+）
claude agents --permission-mode plan --model opus --effort high
```

### ultraplan 的 Remote Control 冲突

Ultraplan 和 Remote Control 都使用 claude.ai/code 界面，同时只能有一个连接。启动 ultraplan 会断开 Remote Control。

### 不要过度并行

并行代理线性增加令牌消耗。Agent teams 实验性文档建议从 3–5 个队友开始，每个队友约 5–6 个任务。超过此范围协调开销会超过并行收益。评估标准：任务是否真正独立？工作者之间是否需要频繁同步？如果是，串行或小规模并行反而更快。

### 成本快速估算框架

| 场景 | 推荐方案 | 成本量级 |
|---|---|---|
| 单个独立任务，无并发需求 | 单会话串行 | 最低 |
| 多个独立任务，无交互需求 | Agent view 后台调度 | 低（线性增加） |
| 需要工作者互相讨论的复杂探索 | Agent teams（3–5 人） | 中 |
| 全库规模、需要可重跑的编排 | Dynamic workflows | 中高（看脚本规模） |
| 合并前重大变更的信心保障 | Ultrareview | 按次计费（$5–$20） |
| 大型架构设计、需要富文本精修 | Ultraplan | 消耗云端会话配额 |

---

## 掌握标志（自测清单）

- [ ] 能说清楚 subagent、agent view、agent teams、dynamic workflows 各自的适用场景，不混淆
- [ ] 能用 `claude agents` 调度多个后台会话，用窥视面板回复，用快捷键在会话间切换
- [ ] 理解 worktree 自动隔离的机制，知道何时需要手动规划文件归属（agent teams）
- [ ] 能在 settings.json 中启用 agent teams，用自然语言描述创建一个 3 人团队，并通过 `Shift+Down` 与各队友交互
- [ ] 能用 `ultracode:` 关键字触发工作流，用 `/workflows` 监控进度，保存工作流为可复用命令
- [ ] 能用 `/effort ultracode` 开启全局工作流模式，并在完成后降级为 `/effort high`
- [ ] 能用 `/ultraplan` 从 CLI 启动云端规划，在浏览器内联评论，选择发回终端执行
- [ ] 知道 `/code-review` 和 `/code-review ultra` 的定位差异，能在合适时机选择正确工具
- [ ] 理解 ultrareview 的计费模型（按额外使用量）和 3 次免费的限制，知道它只能由用户主动触发
- [ ] 能根据任务特征（规模、独立性、交互需求、成本预算）快速选择最合适的并行方案

---

## 延伸阅读

### 官方文档

- [并行运行代理（方案总览）](https://code.claude.com/docs/zh-CN/agents)
- [使用 agent view 管理多个代理](https://code.claude.com/docs/zh-CN/agent-view)
- [协调 Claude Code 会话团队（agent teams）](https://code.claude.com/docs/zh-CN/agent-teams)
- [使用动态工作流大规模编排子代理](https://code.claude.com/docs/zh-CN/workflows)
- [使用 ultraplan 在云端规划](https://code.claude.com/docs/zh-CN/ultraplan)
- [Code Review（GitHub App 自动审查）](https://code.claude.com/docs/zh-CN/code-review)
- [使用 Ultrareview 查找错误](https://code.claude.com/docs/zh-CN/ultrareview)
- [Worktrees（文件隔离）](https://code.claude.com/docs/zh-CN/worktrees)
- [成本管理](https://code.claude.com/docs/zh-CN/costs)

### 系列内其他文章

- 上一篇：[阶段 4 · MCP 与工具集成——让 Claude 接上你的外部世界](/books/claude-code-advanced/04-mcp-and-tools/)——MCP 服务器配置与工具扩展，本文中涉及的 CodeGraph MCP 在该篇有详细介绍
- 下一篇：[阶段 6 · 自动化与无人值守——让 Claude 在你不在时也干活](/books/claude-code-advanced/06-automation/)——hooks、routines、非交互模式等自动化进阶
- 基础篇：[阶段 0 · 地基校准——理解引擎与交互基础](/books/claude-code-advanced/00-foundations/)——环境搭建与基本操作
- 上下文工程：[阶段 1 · 上下文工程——决定 Claude Code 上限的核心内功](/books/claude-code-advanced/01-context-engineering/)——CLAUDE.md 设计、记忆体系，与本文 agent teams 中的上下文传递密切相关
- 定制与扩展：[阶段 3 · 定制与扩展——Skill / Hook / Subagent / Plugin 四件套](/books/claude-code-advanced/03-customization-and-extensions/)——subagent 定义、skill 编写，本文中多次引用
- Agent SDK：[阶段 7 · Agent SDK——用 Claude Code 引擎构建你自己的代理](/books/claude-code-advanced/07-agent-sdk/)——在代码中构建自定义代理编排系统

