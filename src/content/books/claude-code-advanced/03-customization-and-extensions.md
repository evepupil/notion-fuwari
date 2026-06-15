---
title: '阶段 3 · 定制与扩展——Skill / Hook / Subagent / Plugin 四件套'
draft: false
---

> 把 Claude Code 从一个通用 AI 助手变成完全适配你工作流的专属工具——Skill 扩展能力边界、Hook 强制确定性规则、Subagent 隔离上下文、Plugin 打包分发。

---

## 这篇你会学到

- SKILL.md 的完整文件结构与所有 frontmatter 字段的实际含义
- 个人 / 项目 / 插件三种 Skill 作用域的加载机制与优先级
- 全部 Hook 事件类型、matcher 语法、exit code 语义，以及 PowerShell 可用配置示例
- Subagent 的 frontmatter 字段体系、内置代理特性、`isolation: worktree` 用法
- Plugin 的目录结构、`plugin.json` 清单、marketplace 创建与发现安装流程
- Output Styles 与 Statusline 的轻量定制技巧

---

## 为什么重要

基础配置（CLAUDE.md、全局设置、MCP 服务器）解决的是"Claude 知道什么"，而本阶段四件套解决的是"Claude 用什么方式做事、在什么地方做事、做完后强制发生什么"。对进阶用户来说，核心价值体现在三个层次：

1. **可重用性**：把反复粘贴的流程封装成 Skill，一次写，处处调用
2. **确定性**：Hook 的执行与 LLM 的决策无关，格式化一定跑，危险命令一定被拦
3. **隔离性**：Subagent 把海量输出限制在自己的 context window，主会话保持干净

---

## 四件套全景

| 特性 | Skill | Hook | Subagent | Plugin |
|:---|:---|:---|:---|:---|
| **本质** | 可调用的指令包 | 生命周期触发器 | 专用子代理 | 打包分发单元 |
| **谁执行** | Claude 模型 | 宿主进程（shell / HTTP） | 独立 Claude 实例 | 容器，内含上述三种 |
| **隔离上下文** | 否，共享主会话 | 否，在主会话内拦截 | 是，独立 context window | 按内含组件各自继承 |
| **确定性** | 低（模型决策） | 高（exit code 强制） | 中（模型 + 工具限制） | 取决于内含组件 |
| **典型用途** | 自定义命令、工作流 | 格式化、lint、拦截危险操作 | 代码审查、并行研究、只读探索 | 团队共享、跨项目复用 |
| **何时选它** | 需要可调用的多步骤流程 | 需要每次都强制发生的行为 | 任务输出量大或需要工具限制 | 需要打包给他人安装 |

---

## Skill 详解

### SKILL.md 文件结构

每个 Skill 是一个目录，`SKILL.md` 是入口，其余文件可选：

```text
my-skill/
├── SKILL.md           # 主说明（必需）
├── reference.md       # 详细参考，按需加载
├── examples/
│   └── sample.md
└── scripts/
    └── helper.py
```

`SKILL.md` 由两部分构成：顶部 `---` 包裹的 YAML frontmatter + 后续 Markdown 正文（即 Claude 收到的指令）。

### 完整 Frontmatter 字段

```yaml
---
name: my-skill                     # 显示名称，命令名来自目录名
description: >                     # Claude 用此决定何时自动加载（推荐填写）
  当用户询问 xxx 时使用
when_to_use: >                     # 补充触发场景，附加在 description 后
  触发短语: "帮我做 xxx"
argument-hint: "[issue-number]"    # /命令 后自动补全时的提示
arguments: [issue, branch]         # 命名参数，映射 $issue $branch
disable-model-invocation: true     # true: 只能手动 /name 调用，Claude 不自动触发
user-invocable: false              # false: 从 / 菜单隐藏，只由 Claude 自动调用
allowed-tools: Bash(git *) Read    # skill 激活时预批准的工具
disallowed-tools: AskUserQuestion  # skill 激活时禁用的工具
model: sonnet                      # 覆盖当前轮次的模型（inherit / haiku / sonnet / opus）
effort: high                       # low / medium / high / xhigh / max
context: fork                      # 在独立 subagent 中运行此 skill
agent: Explore                     # 配合 context: fork 指定代理类型
hooks:                             # 限定于此 skill 生命周期的 hook
  PostToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "npx prettier --write"
paths: "src/**/*.ts,*.go"          # 仅在操作匹配文件时自动加载
shell: powershell                  # 内联 !`cmd` 使用 PowerShell（需 CLAUDE_CODE_USE_POWERSHELL_TOOL=1）
---
```

所有字段均为可选，但强烈建议写 `description`。

### 三种作用域与优先级

| 作用域 | 路径 | 适用范围 |
|:---|:---|:---|
| 企业 | 托管设置目录内 | 组织所有用户 |
| 个人 | `~/.claude/skills/<skill-name>/SKILL.md` | 你的所有项目 |
| 项目 | `.claude/skills/<skill-name>/SKILL.md` | 仅此项目 |
| 插件 | `<plugin>/skills/<skill-name>/SKILL.md` | 启用插件的位置 |

优先级：企业 > 个人 > 项目。插件 skill 使用 `plugin-name:skill-name` 命名空间，不与其他层冲突。

### 触发机制

两条触发路径：

- **手动调用**：输入 `/skill-name` 或 `/plugin-name:skill-name`
- **自动调用**：Claude 根据 `description` + `when_to_use` 判断相关性后加载

控制规则：
- `disable-model-invocation: true` → 仅手动触发，Claude 不自动加载
- `user-invocable: false` → 从菜单隐藏，仅 Claude 自动触发
- 两者都不设 → 你和 Claude 均可触发（默认）

Skill 被触发后，其 `SKILL.md` 正文作为消息进入对话，**在整个会话中保持在上下文中**。压缩（compact）后，Claude Code 会重新注入最近调用的 skill，每个 skill 保留前 5,000 token，所有被重注入的 skill 共享 25,000 token 预算。

### 动态上下文注入

`` !`命令` `` 语法在 Claude 看到 skill 内容之前由宿主执行，输出替换占位符：

````markdown
## 当前 diff
!`git diff HEAD`

## 多行注入
```!
node --version
git status --short
```
````

在 Windows/PowerShell 项目中，通过 frontmatter 的 `shell: powershell` 字段指定用 PowerShell 执行内联命令（需设置 `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`）。

### 字符串替换变量

| 变量 | 含义 |
|:---|:---|
| `$ARGUMENTS` | 调用时传入的所有参数原文 |
| `$0` `$1` … | 按位置访问参数（0-based） |
| `$issue` | frontmatter `arguments: [issue]` 声明后，`$issue` 映射第一个参数 |
| `${CLAUDE_SESSION_ID}` | 当前会话 ID |
| `${CLAUDE_SKILL_DIR}` | 当前 skill 所在目录（引用捆绑脚本的关键） |
| `${CLAUDE_EFFORT}` | 当前工作量级别 |

### 从零写一个完整 Skill 示例

需求：给定 GitHub issue 编号，自动按团队规范修复并提交。

```bash
# Windows PowerShell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills\fix-issue"
```

保存到 `~/.claude/skills/fix-issue/SKILL.md`：

```yaml
---
name: fix-issue
description: >
  按团队规范修复 GitHub issue。当用户说"修复 issue 123"或"/fix-issue 编号"时使用。
argument-hint: "[issue-number]"
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(gh *) Read Edit Write Grep Glob
---

## 当前 issue 信息

!`gh issue view $ARGUMENTS --json title,body,labels`

## 操作步骤

1. 阅读上方 issue 内容，理解需求
2. 用 Grep/Glob 定位相关代码
3. 实现修复，遵循项目代码风格
4. 运行测试（如果存在）：`Bash("npm test" 或项目约定命令)`
5. 暂存并提交：
   - `git add -p`（交互式确认变更）
   - `git commit -m "fix: <issue 标题> (#$ARGUMENTS)"`
6. 输出：修改了哪些文件、提交 SHA、剩余风险点

## 注意

- 若 issue 描述不清，停下来问我，不要猜测
- 不要修改 `.env`、`package-lock.json`、`.git/` 内的文件
```

测试：

```text
/fix-issue 456
```

### 实时变更检测

编辑 `SKILL.md` 后无需重启会话，改动即时生效。但新建顶层 skills 目录需要重启。对于作为插件的 skill 文件夹，`hooks/`、`.mcp.json`、`agents/`、`output-styles/` 的变更需运行 `/reload-plugins`。

---

## Hook 详解

### 核心机制

Hook 是在 Claude Code 生命周期特定节点执行的 shell 命令。关键属性：**确定性**——无论 Claude 怎么决策，Hook 一定执行。

配置位置决定作用域：

| 配置文件 | 作用域 |
|:---|:---|
| `~/.claude/settings.json` | 所有项目（个人全局） |
| `.claude/settings.json` | 单个项目（可提交到版本库） |
| `.claude/settings.local.json` | 单个项目（.gitignored，不共享） |
| Plugin `hooks/hooks.json` | 启用插件时 |
| Skill / Subagent frontmatter | 组件活跃时 |

### 全部事件类型

| 事件 | 触发时机 | 可阻断 |
|:---|:---|:---|
| `SessionStart` | 会话开始或恢复 | 否 |
| `Setup` | `--init-only` 或 `--init`/`--maintenance` 的 `-p` 模式 | 否 |
| `UserPromptSubmit` | 提交 prompt 前，Claude 处理之前 | 是（exit 2） |
| `UserPromptExpansion` | 用户输入命令展开为 prompt 时 | 是（exit 2） |
| `PreToolUse` | 工具调用执行前 | 是（exit 2 或 JSON deny） |
| `PermissionRequest` | 权限对话框出现时 | 是（JSON deny） |
| `PermissionDenied` | 工具调用被自动模式分类器拒绝后 | — |
| `PostToolUse` | 工具调用成功后 | 是（JSON block，但工具已执行） |
| `PostToolUseFailure` | 工具调用失败后 | — |
| `PostToolBatch` | 一批并行工具调用全部完成后 | 是 |
| `Notification` | Claude Code 发送通知时 | 否 |
| `MessageDisplay` | 助手消息显示时 | — |
| `SubagentStart` | Subagent 启动时 | — |
| `SubagentStop` | Subagent 结束时 | 是 |
| `TaskCreated` | 任务通过 TaskCreate 创建时 | — |
| `TaskCompleted` | 任务标记完成时 | — |
| `Stop` | Claude 完成本轮响应时 | 是（exit 2 或 JSON block） |
| `StopFailure` | 因 API 错误结束时 | 忽略输出和 exit code |
| `InstructionsLoaded` | CLAUDE.md 或 `.claude/rules/*.md` 加载时 | — |
| `ConfigChange` | 配置文件在会话中变更时 | 是（exit 2） |
| `CwdChanged` | 工作目录变更时（如 `cd`） | — |
| `FileChanged` | 被监视的文件在磁盘变更时 | — |
| `WorktreeCreate` | worktree 被创建时 | 是 |
| `WorktreeRemove` | worktree 被移除时 | — |
| `PreCompact` | 上下文压缩前 | 是 |
| `PostCompact` | 上下文压缩完成后 | — |
| `Elicitation` | MCP 服务器请求用户输入时 | — |
| `ElicitationResult` | 用户响应 MCP 引导后，响应发回前 | — |
| `SessionEnd` | 会话终止时 | — |
| `TeammateIdle` | Agent team 中的队友即将空闲时 | — |

### Matcher 语法

Matcher 决定 hook 在什么条件下触发：

| 写法 | 评估方式 | 示例 |
|:---|:---|:---|
| 空字符串 `""` | 匹配所有 | 所有 Notification 都触发 |
| 纯字母数字 + `\|` | 精确匹配 | `Bash`、`Edit\|Write` |
| 含其他字符 | 正则表达式 | `^Notebook`、`mcp__.*__write.*` |

各事件的 matcher 匹配字段：

- `PreToolUse` / `PostToolUse` / `PermissionRequest`：**工具名称**（`Bash`、`Edit`、`mcp__github__.*`）
- `SessionStart`：`startup` / `resume` / `clear` / `compact`
- `Notification`：`permission_prompt` / `idle_prompt` / `auth_success` / `elicitation_dialog` 等
- `SubagentStart` / `SubagentStop`：代理类型名称
- `ConfigChange`：`user_settings` / `project_settings` / `skills` 等
- `FileChanged`：字面文件名，`|` 分隔，如 `.envrc|.env`

### 输入 JSON 公共字段

每个 hook 事件通过 stdin 接收 JSON，包含：

```json
{
  "session_id": "abc123",
  "cwd": "/your/project",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

`UserPromptSubmit` 有 `prompt` 字段，`SessionStart` 有 `source` 字段，以此类推。

### Exit Code 语义

| Exit Code | 含义 | 行为 |
|:---|:---|:---|
| **0** | 无异议 | 正常继续，stdout 的 JSON 被解析执行 |
| **2** | 阻断操作 | `PreToolUse`/`UserPromptSubmit` 等阻止操作，stderr 内容反馈给 Claude |
| **其他** | 非阻断错误 | 继续执行，成绩单显示 `<hook name> hook error`，完整 stderr 进调试日志 |

**重要**：exit 2 与 JSON 输出不要混用。当你 exit 2 时，Claude Code 忽略 JSON stdout。

### 结构化 JSON 输出（exit 0）

比 exit code 更精细的控制方式：

**PreToolUse 决策控制：**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "请使用 rg 替代 grep 以获得更好性能"
  }
}
```

`permissionDecision` 可选值：
- `"allow"` — 跳过交互式权限提示（拒绝规则仍然生效）
- `"deny"` — 取消工具调用，reason 发给 Claude
- `"ask"` — 正常显示权限提示

**Stop / PostToolUse 阻断：**

```json
{
  "decision": "block",
  "reason": "测试未通过，请先修复"
}
```

**context 注入（UserPromptSubmit）：**

```json
{
  "additionalContext": "用户所在时区：UTC+8，当前 sprint：认证重构"
}
```

### Settings.json 完整配置示例（Windows/PowerShell 可用）

以下示例可直接用于 `~/.claude/settings.json` 或 `.claude/settings.json`：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -Command \"$input = $input | Out-String | ConvertFrom-Json; npx prettier --write $input.tool_input.file_path\""
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -File \"$env:USERPROFILE\\.claude\\hooks\\block-dangerous.ps1\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude 已完成', 'Claude Code')\""
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "idle_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude 需要你的输入', 'Claude Code')\""
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -Command \"Write-Output '提醒：使用 pnpm 而非 npm，提交前跑 pnpm test，当前 sprint：认证重构'\""
          }
        ]
      }
    ]
  }
}
```

> **macOS/Linux 版本差异**：将 `powershell -NoProfile -Command` 替换为 `bash -c`，将 `$env:USERPROFILE` 替换为 `~`，通知命令替换为 `osascript -e 'display notification "..." with title "Claude Code"'`（macOS）或 `notify-send`（Linux）。

### 防保护文件的 PowerShell Hook 脚本

保存到 `~/.claude/hooks/block-dangerous.ps1`：

```powershell
$input_json = $input | Out-String | ConvertFrom-Json
$command = $input_json.tool_input.command

$dangerous_patterns = @("rm -rf /", "rd /s /q C:\", "format c:", "DROP TABLE", "DROP DATABASE")

foreach ($pattern in $dangerous_patterns) {
    if ($command -match [regex]::Escape($pattern)) {
        Write-Error "已阻断：命令匹配危险模式 '$pattern'"
        exit 2
    }
}

exit 0
```

然后在 settings.json 的 `PreToolUse` 中引用：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -File \"$env:USERPROFILE\\.claude\\hooks\\block-dangerous.ps1\""
          }
        ]
      }
    ]
  }
}
```

### `if` 字段：更精细的过滤（v2.1.85+）

在工具名称匹配之上，进一步按参数过滤——只有真正匹配时才生成 hook 进程：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(git *)",
            "command": "powershell -NoProfile -File \"$env:USERPROFILE\\.claude\\hooks\\check-git-policy.ps1\""
          }
        ]
      }
    ]
  }
}
```

`if` 字段接受与权限规则相同的模式：`"Bash(git *)"` `"Edit(*.ts)"` 等。

### Hook 类型总结

| type | 执行方式 | 典型用途 |
|:---|:---|:---|
| `"command"` | shell 命令，stdin/stdout 通信 | 格式化、lint、拦截 |
| `"http"` | POST 到 URL，响应体解析 | 远程审计、外部系统集成 |
| `"mcp_tool"` | 调用 MCP 服务器工具 | 利用已有 MCP 能力 |
| `"prompt"` | 单轮 LLM 评估 | 需要判断力的条件检查 |
| `"agent"` | 多轮代理（实验性） | 需要读文件验证的复杂条件 |

### 典型用途速查

| 场景 | 事件 | Matcher | 行为 |
|:---|:---|:---|:---|
| 编辑后自动格式化 | `PostToolUse` | `Edit\|Write` | 运行 prettier/gofmt |
| 提交前 lint | `PreToolUse` | `Bash(git commit *)` | lint 失败则 exit 2 |
| 拦截危险命令 | `PreToolUse` | `Bash` | 检测模式，exit 2 阻断 |
| 保护配置文件 | `PreToolUse` | `Edit\|Write` | 检测路径，exit 2 |
| 任务完成通知 | `Stop` | — | 发送桌面通知 |
| 压缩后补上下文 | `SessionStart` | `compact` | echo 关键约定 |
| 目录切换重载 env | `CwdChanged` | — | direnv export |

---

## Subagent 详解

### 什么时候用 Subagent

- 任务会产生大量输出（日志、测试结果、搜索结果），不想污染主会话
- 需要强制限制工具访问（只读、只查询）
- 任务可以独立完成并只返回摘要
- 需要并行处理多个独立子任务

### 内置 Subagent

| 名称 | 模型 | 工具 | 用途 |
|:---|:---|:---|:---|
| `Explore` | Haiku | 只读（拒绝 Write/Edit） | 代码库搜索、探索 |
| `Plan` | 继承主会话 | 只读 | Plan mode 下的代码库研究 |
| `general-purpose` | 继承主会话 | 全部 | 复杂多步骤任务 |

**Explore 和 Plan 会跳过 CLAUDE.md 和 git 状态**，以保持上下文精简。其他代理正常加载两者。

### Subagent 文件位置与优先级

| 位置 | 优先级 | 适用场景 |
|:---|:---|:---|
| 托管设置内 `.claude/agents/` | 1（最高） | 组织统一配置 |
| `.claude/agents/`（项目） | 3 | 项目特定，可提交版本库 |
| `~/.claude/agents/`（个人） | 4 | 跨项目通用 |
| Plugin `agents/` 目录 | 5（最低） | 插件分发 |

Subagent 文件在会话启动时加载，直接修改磁盘后需重启会话（通过 `/agents` 界面创建的除外）。

### 完整 Frontmatter 字段

```yaml
---
name: code-reviewer              # 必需，小写+连字符，hooks 中作为 agent_type 使用
description: >                   # 必需，Claude 据此决定何时委托
  代码审查专家。代码变更后主动使用。
tools: Read, Grep, Glob, Bash    # 允许工具列表（省略则继承所有）
disallowedTools: Write, Edit     # 禁用工具列表
model: sonnet                    # sonnet / opus / haiku / 完整 model ID / inherit
permissionMode: acceptEdits      # default / acceptEdits / auto / dontAsk / bypassPermissions / plan
maxTurns: 20                     # 最大代理轮数
skills:                          # 启动时预加载的 skill（注入完整内容而非描述）
  - api-conventions
  - error-handling-patterns
mcpServers:                      # 仅此 subagent 可用的 MCP 服务器
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
hooks:                           # 限定于此 subagent 的 hook
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
memory: project                  # user / project / local，启用跨会话持久记忆
background: false                # true: 始终作为后台任务运行
effort: medium                   # 工作量级别
isolation: worktree              # 在独立 git worktree 中运行（文件改动隔离）
color: blue                      # red/blue/green/yellow/purple/orange/pink/cyan
---

你是一名资深代码审查员……（系统提示正文）
```

### `isolation: worktree` 详解

设置后，subagent 在一个临时 git worktree 中运行，获得仓库的隔离副本（默认从 default branch 分支，非父会话的 HEAD）。如果 subagent 没有做任何变更，worktree 自动清理。

典型用途：让 subagent 大胆重构或实验性修改，互不影响主工作树。

### 显式调用方式

**自然语言：**
```text
用 code-reviewer subagent 检查最近的认证模块改动
```

**@-mention（保证调用指定代理）：**
```text
@"code-reviewer (agent)" 看一下 auth 的变更
```

**整个会话作为 subagent 运行：**
```bash
# macOS/Linux
claude --agent code-reviewer

# Windows PowerShell（当前会话使用 code-reviewer 的系统提示）
claude --agent code-reviewer
```

**会话默认代理（.claude/settings.json）：**
```json
{
  "agent": "code-reviewer"
}
```

### 什么加载到 Subagent 的启动上下文

每个 subagent 有干净的独立 context window，启动时包含：

- subagent 自己的系统提示（markdown 正文）+ 环境信息
- Claude 编写的委托任务消息
- CLAUDE.md 和内存层次（Explore/Plan 除外）
- git 状态快照（Explore/Plan 除外）
- `skills` 字段中预加载的 skill 完整内容

**看不到**：主会话对话历史、已调用的 skill、已读取的文件。

### 前台 vs 后台

- **前台**：阻塞主会话，权限提示正常弹出
- **后台**：并行运行，权限提示自动拒绝（无法交互时）

可按 `Ctrl+B` 将运行中的任务推入后台。

### 完整示例：只读数据库查询代理

`.claude/agents/db-reader.md`：

```markdown
---
name: db-reader
description: 执行只读数据库查询，用于数据分析和报告生成
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "powershell -NoProfile -File .claude/hooks/validate-readonly-query.ps1"
---

你是数据库分析员，只有只读权限。执行 SELECT 查询回答数据问题。

如果被要求执行 INSERT/UPDATE/DELETE/DROP，解释你只有只读访问权限。
```

`.claude/hooks/validate-readonly-query.ps1`：

```powershell
$input_json = $input | Out-String | ConvertFrom-Json
$command = $input_json.tool_input.command

if ($command -match '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b') {
    Write-Error "已阻断：只允许 SELECT 查询"
    exit 2
}

exit 0
```

---

## Plugin 详解

### Plugin 是什么

Plugin 是一个自包含目录，把 skill、subagent、hook、MCP server、LSP server、后台监视器打包在一起，可以作为一个单元安装、启用、禁用、分发。

**选 Plugin 还是独立配置：**

| 场景 | 选择 |
|:---|:---|
| 个人工作流，不共享 | 独立配置（`.claude/` 目录） |
| 需要和团队共享 | Plugin |
| 跨项目复用 | Plugin |
| 可以接受命名空间（`/my-plugin:hello`） | Plugin |

### Plugin 目录结构

```text
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # 清单（可选，有此文件或组件目录之一即为插件）
├── skills/
│   └── hello/
│       └── SKILL.md
├── commands/                # 旧版平面文件形式（仍兼容）
├── agents/
│   └── reviewer.md
├── hooks/
│   └── hooks.json
├── .mcp.json                # MCP server 配置
├── .lsp.json                # LSP server 配置
├── monitors/
│   └── monitors.json        # 后台监视器
├── output-styles/           # 自定义输出样式
├── bin/                     # 添加到 PATH 的可执行文件
└── settings.json            # 启用插件时的默认设置
```

> **常见错误**：`commands/`、`agents/`、`skills/`、`hooks/` 必须在插件**根目录**，不要放在 `.claude-plugin/` 内。`.claude-plugin/` 只放 `plugin.json`。

### plugin.json 清单字段

```json
{
  "name": "my-plugin",
  "description": "做某件事的插件",
  "version": "1.0.0",
  "author": {
    "name": "你的名字",
    "email": "optional@example.com"
  },
  "homepage": "https://github.com/you/my-plugin",
  "repository": "https://github.com/you/my-plugin",
  "license": "MIT"
}
```

`name` 是命名空间前缀，plugin 的 skill 命令名为 `/my-plugin:skill-name`。`version` 如果设置，用户只在该字段变更时才收到更新；省略则每个 git 提交都算新版本。

### hooks/hooks.json

格式与 settings.json 中的 `hooks` 字段完全相同：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/lint.sh"
          }
        ]
      }
    ]
  }
}
```

在 plugin hook 脚本中，用 `${CLAUDE_PLUGIN_ROOT}` 引用插件安装目录的文件，用 `${CLAUDE_PLUGIN_DATA}` 引用安装后数据目录（用于持久化状态）。

### settings.json（插件默认设置）

目前支持 `agent` 和 `subagentStatusLine` 键：

```json
{
  "agent": "security-reviewer"
}
```

启用插件时，`security-reviewer` 代理成为主线程。

### 本地测试插件

```bash
# 从插件目录加载（开发调试）
claude --plugin-dir ./my-plugin

# 同时加载多个插件
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two

# 加载 zip 包（v2.1.128+）
claude --plugin-dir ./my-plugin.zip

# 修改后无需重启，在会话内重新加载
# 在 Claude Code 内输入：
/reload-plugins
```

### 在 skills 目录中开发插件（推荐开发流程）

```bash
# 脚手架生成（安装后全局可用）
claude plugin init my-tool
```

会在 `~/.claude/skills/my-tool/` 创建包含 `.claude-plugin/plugin.json` 的插件结构，下次会话自动以 `my-tool@skills-dir` 加载，无需 marketplace。

### Marketplace 的结构

一个 marketplace 是一个包含 `.claude-plugin/marketplace.json` 的目录/仓库：

```json
{
  "name": "company-tools",
  "owner": {
    "name": "DevTools Team"
  },
  "plugins": [
    {
      "name": "code-formatter",
      "source": "./plugins/formatter",
      "description": "编辑后自动格式化"
    },
    {
      "name": "deployment-tools",
      "source": {
        "source": "github",
        "repo": "company/deploy-plugin"
      },
      "description": "部署自动化工具"
    }
  ]
}
```

Plugin 的 `source` 支持：
- 相对路径：`"./plugins/my-plugin"`（需 git 托管的 marketplace）
- `{"source": "github", "repo": "owner/repo"}`
- `{"source": "url", "url": "https://..."}`
- `{"source": "git-subdir", "url": "...", "path": "tools/plugin"}`
- `{"source": "npm", "package": "@scope/plugin"}`

### 发现与安装插件

```text
# 在 Claude Code 会话内：

# 添加 marketplace
/plugin marketplace add anthropics/claude-plugins-community
/plugin marketplace add company/internal-plugins
/plugin marketplace add ./local-marketplace

# 列出可用插件
/plugin list

# 安装插件
/plugin install code-formatter@company-tools

# 管理已安装插件
/plugin enable my-plugin
/plugin disable my-plugin
/plugin update my-plugin

# 验证插件结构
/plugin validate ./my-plugin
```

```bash
# CLI 方式（非会话内）
claude plugin marketplace add acme-corp/claude-plugins
claude plugin install quality-tools@acme-corp
claude plugin marketplace list
```

### Plugin 中的 Subagent 限制

出于安全考虑，Plugin 提供的 subagent 不支持 `hooks`、`mcpServers`、`permissionMode` frontmatter 字段，这些字段加载时被忽略。如需这些功能，将 agent 文件复制到 `.claude/agents/` 或 `~/.claude/agents/`。

### 提交到社区 Marketplace

```bash
# 先在本地验证
claude plugin validate .

# 提交表单
# claude.ai: https://claude.ai/settings/plugins/submit
# Console:   https://platform.claude.com/plugins/submit
```

批准后，插件固定到 [`anthropics/claude-plugins-community`](https://github.com/anthropics/claude-plugins-community) 中的特定提交 SHA。

---

## 辅助定制

### Output Styles（输出样式）

改变 Claude **响应的方式**，而非知识。通过修改系统提示实现。

**内置样式：**

| 样式 | 特点 |
|:---|:---|
| `Default` | 标准软件工程助手 |
| `Proactive` | 立即执行，少问，倾向行动而非规划 |
| `Explanatory` | 提供教育性"Insights"，解释选择和模式 |
| `Learning` | 协作模式，要求你实现 `TODO(human)` 标记的代码片段 |

切换方式：

```text
/config  →  选择"输出样式"
```

或直接编辑设置：

```json
{
  "outputStyle": "Proactive"
}
```

变更在 `/clear` 或新会话后生效。

**自定义样式**（保存到 `~/.claude/output-styles/` 或 `.claude/output-styles/`）：

```markdown
---
name: Diagrams First
description: 每次解释都先给出 Mermaid 图
keep-coding-instructions: true
---

解释代码、架构或数据流时，先用 Mermaid 图展示结构，再用文字说明。

使用 `flowchart TD` 表示控制流，`sequenceDiagram` 表示请求路径。图保持在 15 节点以内。
```

`keep-coding-instructions: true`：保留 Claude Code 内置的软件工程说明（仍然在编码，只是改变响应风格）。省略则替换全部系统提示（Claude 不再以软件工程师模式工作）。

Plugin 可以通过 `force-for-plugin: true` 在启用时自动应用样式（覆盖用户的 `outputStyle` 设置）。

---

### Statusline（状态栏）

底部状态栏，运行自定义 shell 脚本，接收 JSON 会话数据（stdin），输出显示文本（stdout）。

**快速配置（让 Claude 生成）：**

```text
/statusline 显示模型名、上下文百分比进度条、当前 git 分支
```

**手动配置** — `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.ps1",
    "padding": 2,
    "refreshInterval": 10
  }
}
```

**PowerShell 脚本示例** — `~/.claude/statusline.ps1`：

```powershell
$data = $input | Out-String | ConvertFrom-Json
$model = $data.model.display_name
$pct = if ($data.context_window.used_percentage) { [int]$data.context_window.used_percentage } else { 0 }
$dir = Split-Path $data.workspace.current_dir -Leaf
$cost = if ($data.cost.total_cost_usd) { "$($data.cost.total_cost_usd.ToString('F2'))" } else { "0.00" }

$filled = [int]($pct / 10)
$bar = "█" * $filled + "░" * (10 - $filled)

# git 分支（可选）
$branch = ""
try {
    $branch = " | " + (git branch --show-current 2>$null)
} catch {}

Write-Host "[$model] 📁 $dir$branch | $bar $pct% | `$$cost"
```

**可用的 JSON 字段摘要：**

| 字段 | 含义 |
|:---|:---|
| `model.display_name` | 当前模型显示名 |
| `workspace.current_dir` | 当前工作目录 |
| `context_window.used_percentage` | 上下文使用百分比 |
| `context_window.context_window_size` | 最大 context 窗口大小（token） |
| `cost.total_cost_usd` | 会话估算成本 |
| `cost.total_duration_ms` | 会话总耗时（毫秒） |
| `effort.level` | 当前工作量级别 |
| `rate_limits.five_hour.used_percentage` | 5 小时速率限制使用率 |
| `session_id` | 会话唯一 ID |
| `vim.mode` | vim 模式（NORMAL/INSERT/VISUAL） |

---

## 动手练习

### 练习 1：写一个 Git 审查 Skill

目标：创建 `/review-pr` skill，自动拉取 PR diff 并按清单审查。

1. 创建目录：`New-Item -ItemType Directory "$env:USERPROFILE\.claude\skills\review-pr"`
2. 在其中编写 `SKILL.md`，frontmatter 设置 `disable-model-invocation: true`，正文使用 `` !`gh pr diff` `` 和 `` !`gh pr view --comments` `` 注入实时数据
3. 打开一个有 PR 的项目，运行 `/review-pr`，验证 Claude 基于真实 diff 给出审查意见

**验证点**：Claude 的回复中包含具体行号引用，而非泛泛而谈。

---

### 练习 2：配置编辑后自动格式化 Hook

目标：每次 Claude 编辑 `.ts` 或 `.tsx` 文件后，自动运行 Prettier。

在 `.claude/settings.json` 中添加：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "if": "Edit(*.ts|*.tsx) Write(*.ts|*.tsx)",
            "command": "powershell -NoProfile -Command \"$j = $input | Out-String | ConvertFrom-Json; npx prettier --write $j.tool_input.file_path\""
          }
        ]
      }
    ]
  }
}
```

让 Claude 编辑一个 `.ts` 文件，观察 Prettier 是否自动运行。

**验证点**：文件保存后格式立即符合 Prettier 规范，无需手动运行。

---

### 练习 3：建一个只读代码审查 Subagent

目标：创建一个 `code-reviewer` subagent，只能读文件，不能写文件。

在 `.claude/agents/code-reviewer.md` 中：

```markdown
---
name: code-reviewer
description: 代码质量审查专家。代码改动后主动使用。
tools: Read, Grep, Glob, Bash(git diff *) Bash(git log *)
model: sonnet
color: blue
---

你是资深代码审查员。

审查时关注：
- 代码可读性和命名
- 错误处理是否完整
- 潜在安全问题
- 测试覆盖率
- 性能隐患

输出格式：
- 🔴 严重（必须修复）
- 🟡 警告（建议修复）
- 🔵 建议（可以改进）

每条包含具体文件和行号。
```

在主会话中测试：
```text
@"code-reviewer (agent)" 审查最近的 auth 模块改动
```

**验证点**：subagent 能看到 git diff，能引用具体行号，且不会主动写入或修改任何文件。

---

### 练习 4：把 Skill + Hook 打包成 Plugin

目标：将练习 1 的 Skill 和练习 2 的 Hook 打包为一个 Plugin，并本地测试安装。

1. 创建目录结构：
```text
my-dev-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── review-pr/
│       └── SKILL.md    # 从练习 1 复制
└── hooks/
    └── hooks.json      # 格式化 hook
```

2. `plugin.json`：
```json
{
  "name": "my-dev-plugin",
  "description": "PR 审查 + 自动格式化工具包",
  "version": "1.0.0"
}
```

3. 本地测试：
```bash
claude --plugin-dir ./my-dev-plugin
```

4. 在会话中验证 `/my-dev-plugin:review-pr` 可用，格式化 hook 正常触发。

**验证点**：插件卸载后，`/my-dev-plugin:review-pr` 消失，格式化 hook 停止触发。

---

### 练习 5：配置多行 Statusline

目标：状态栏第一行显示模型和 git 分支，第二行显示上下文进度条和成本。

参考本文 Statusline 一节的 PowerShell 脚本示例，扩展为两行（第二个 `Write-Host`），并在 `settings.json` 中配置 `refreshInterval: 5`。

**验证点**：状态栏实时更新，随着与 Claude 的对话，上下文百分比数字递增。

---

## 常见坑与注意事项

### Skill 相关

- **描述写得太宽泛**：Claude 会在你不希望的场景下自动触发 skill。用 `disable-model-invocation: true` 或把触发场景写得更精确。
- **正文过长**：会话压缩后大 skill 可能被截断或删除。保持 `SKILL.md` 在 500 行以内，详细资料移到支持文件。
- **`${CLAUDE_SKILL_DIR}` 路径问题**：在捆绑脚本路径中必须用这个变量，直接用相对路径会因为工作目录不同而失败。
- **动态注入命令输出包含占位符**：注入输出只做一次文本替换，命令输出里的 `` !`cmd` `` 不会二次执行。
- **`name` vs 目录名**：frontmatter 的 `name` 只影响显示标签（插件根 SKILL.md 除外），命令名来自目录名。

### Hook 相关

- **exit code 混用**：exit 2 时不要同时往 stdout 写 JSON 决策，两者互斥。
- **并行 hook 互相覆盖 `updatedInput`**：多个 hook 都修改同一工具输入时，最后完成的获胜（非确定性），避免此场景。
- **Windows 路径反斜杠**：`command` 字符串中的路径用正斜杠或双反斜杠，Git Bash 会把单反斜杠当转义字符吃掉。
- **Shell 配置文件污染**：非交互式 shell 执行 hook 命令时，如果 `.bashrc`/`.zshrc` 有无条件的 `echo`，输出会前置到 JSON 导致解析失败。用 `if [[ $- == *i* ]]; then echo "..."; fi` 包裹。
- **Stop hook 无限循环**：Stop hook 连续阻断 8 次后被强制放行。在脚本开头检查 `stop_hook_active` 字段，为 `true` 时直接 exit 0。
- **`PermissionRequest` hook 在非交互模式 `-p` 下不触发**，用 `PreToolUse` 替代。

### Subagent 相关

- **Subagent 看不到主会话历史**：每次委托都是全新上下文，必要的背景信息要在委托消息中重新说明，或通过 `skills` 字段预加载。
- **Subagent 无法生成 subagent**：嵌套委托不可行，从主会话链式调用多个 subagent。
- **Plugin subagent 忽略 `hooks`/`mcpServers`/`permissionMode`**：需要这些功能时复制到 `.claude/agents/`。
- **`bypassPermissions` 权限传播**：父会话用 `bypassPermissions` 时，子代理继承，无法在 subagent frontmatter 里降级。

### Plugin 相关

- **组件目录位置错误**：skills/agents/hooks 放在 `.claude-plugin/` 内是常见错误，必须在插件根目录。
- **相对路径 source 在 URL-based marketplace 失效**：直接 URL 分发的 marketplace 只下载 JSON 本身，相对路径无法解析。
- **版本固定陷阱**：`plugin.json` 里的 `version` 一旦设置，推送新提交不会触发更新，必须同步改版本号。
- **插件 subagent 的工具继承**：插件 subagent 默认继承所有父会话工具，务必用 `tools` 或 `disallowedTools` 显式限制。
- **跨插件共享文件**：插件安装时被复制到缓存，`../` 路径无法引用其他插件文件，用符号链接解决。

---

## 掌握标志（自测清单）

- [ ] 能从零创建 SKILL.md，包含动态上下文注入（`` !`cmd` ``）和参数替换（`$ARGUMENTS`）
- [ ] 清楚 `disable-model-invocation` 和 `user-invocable` 的区别，知道各自的使用场景
- [ ] 能解释 exit code 0 / 2 / 其他 的具体行为差异，并知道结构化 JSON 输出的使用时机
- [ ] 在 settings.json 中写过 `PreToolUse` + `PostToolUse` + `Stop` 三种事件的 hook，PowerShell 命令可以运行
- [ ] 知道 `if` 字段与 `matcher` 字段的区别（`matcher` 按工具名分组，`if` 按参数精细过滤）
- [ ] 创建过自定义 subagent，`tools` 字段明确限制了权限
- [ ] 理解 Explore/Plan 代理与普通 subagent 的启动上下文差异
- [ ] 知道 `isolation: worktree` 的用途，能说出它何时会自动清理 worktree
- [ ] 把至少一个 skill 和一个 hook 打包成了 plugin 并本地测试通过
- [ ] 能说出 marketplace.json 的必需字段，知道如何通过 GitHub 仓库分发插件
- [ ] 配置过 statusline，脚本能读取 JSON stdin 并输出格式化文本

---

## 延伸阅读

### 官方文档

- [Skills 参考](https://code.claude.com/docs/zh-CN/skills) — frontmatter 完整字段、高级模式、共享方式
- [Hooks 使用指南](https://code.claude.com/docs/zh-CN/hooks-guide) — 常见用例与配置示例
- [Hooks 技术参考](https://code.claude.com/docs/zh-CN/hooks) — 完整事件架构、JSON 输入输出格式、异步 hook
- [Subagents](https://code.claude.com/docs/zh-CN/sub-agents) — 创建与配置自定义子代理
- [Plugins](https://code.claude.com/docs/zh-CN/plugins) — 创建插件完整指南
- [Plugins 技术参考](https://code.claude.com/docs/zh-CN/plugins-reference) — 清单架构、组件规范、调试工具
- [Plugin Marketplaces](https://code.claude.com/docs/zh-CN/plugin-marketplaces) — 创建和分发 marketplace
- [Output Styles](https://code.claude.com/docs/zh-CN/output-styles) — 输出样式配置与自定义
- [Statusline](https://code.claude.com/docs/zh-CN/statusline) — 状态栏完整配置参考、可用数据字段

### 系列其他文章

- **上一篇**：[02-workflow-and-sessions.md](/books/claude-code-advanced/02-workflow-and-sessions/) — 工作流与会话管理，含 `/compact`、Plan Mode、会话恢复
- **下一篇**：[04-mcp-and-tools.md](/books/claude-code-advanced/04-mcp-and-tools/) — MCP 服务器、工具系统与权限管理
- [01-context-engineering.md](/books/claude-code-advanced/01-context-engineering/) — CLAUDE.md 编写与上下文管理
- [05-multi-agent-orchestration.md](/books/claude-code-advanced/05-multi-agent-orchestration/) — 多代理编排与 Agent Teams
- [06-automation.md](/books/claude-code-advanced/06-automation/) — 非交互模式、CI/CD 集成、headless 使用
- [07-agent-sdk.md](/books/claude-code-advanced/07-agent-sdk/) — Agent SDK 编程接口

