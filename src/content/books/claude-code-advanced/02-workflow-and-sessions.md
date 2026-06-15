---
title: '阶段 2 · 工作流与会话控制——把"会用"变成"高效且可控"'
draft: false
---

> 掌握官方四阶段工作流、Plan Mode、权限模式与规则配置、Checkpointing 回滚、会话持久化与 `/goal` 目标驱动，让每次对话都精准可控。

---

## 这篇你会学到

- 官方推荐的「探索 → 规划 → 实现 → 提交」四阶段工作流及每阶段的实操技巧
- Best Practices 精华：Context 管理、验证闭环、提示策略
- Plan Mode 的启用方式、审查计划、编辑计划的完整流程
- 六种权限模式（`default` / `acceptEdits` / `plan` / `auto` / `dontAsk` / `bypassPermissions`）的区别与选用时机
- `settings.json` 中 allow / ask / deny 规则的完整语法
- Checkpointing 机制：`/rewind`、恢复 vs 总结的使用场景
- 会话管理全集：`--continue`、`--resume`、`-n`、`/rename`、分支会话
- `/goal` 目标驱动：让 Claude 持续迭代直到条件成立
- Worktrees 并行隔离简介（详细内容见 [03-customization-and-extensions.md](/books/claude-code-advanced/03-customization-and-extensions/)）

---

## 为什么重要

Claude Code 的核心约束只有一个：**Context Window 是最贵的资源**。随着 context 填充，性能下降——这不是理论，是实测规律。所有高级工作流技巧本质上都是围绕这一点展开的：

- **Plan Mode** 避免在错误方向上耗尽 context；
- **会话管理** 让长任务跨多次对话连续推进，而无需重新解释背景；
- **权限规则** 减少"确认疲劳"，让 Claude 在安全边界内自主运行；
- **Checkpointing** 提供会话级撤销，免去"改坏了怎么办"的顾虑；
- **`/goal`** 把"你来做、我来批"变成"你做完、评估器验、无需人在场"。

---

## 核心概念

### 1. 官方四阶段工作流：探索 → 规划 → 实现 → 提交

这是 Anthropic 在 Best Practices 文档中明确推荐的工作流，适用于任何非微小改动的任务。

#### 阶段一：探索（Explore）

切换到 Plan Mode，只读不改。

```text
# 在 Plan Mode 下发送：
read @src/auth and understand how we handle sessions and login.
also look at how we manage environment variables for secrets.
```

**为什么要先进 Plan Mode？** Plan Mode 下 Claude 读文件、跑只读命令，但不碰你的源码。探索阶段的目的是建立对代码库的理解，而不是让 Claude 凭感觉直接开写。

#### 阶段二：规划（Plan）

仍在 Plan Mode，要求 Claude 输出详细实现计划。

```text
I want to add Google OAuth. What files need to change?
What's the session flow? Create a plan.
```

收到计划后，按 `Ctrl+G` 在系统默认文本编辑器中打开计划直接编辑，改完保存后 Claude 继续基于修订后的计划推进。

> **判断是否需要规划的标准：** 如果你能用一句话描述整个 diff，就跳过规划直接做。规划最有价值的场景是：改动横跨多个文件、你对被改代码不熟、实现方案有分叉。

#### 阶段三：实现（Implement）

退出 Plan Mode，切回正常模式（再按一次 `Shift+Tab`），给 Claude 验证手段。

```text
implement the OAuth flow from your plan. write tests for the
callback handler, run the test suite and fix any failures.
```

**关键：给 Claude 一个可以运行的验证检查。** 测试、构建命令、截图比对——任何能返回"通过/失败"信号的东西都行。没有验证手段，Claude 以"看起来完成了"为准，你就成了唯一的验证循环。

#### 阶段四：提交（Commit）

```text
commit with a descriptive message and open a PR
```

Claude 会自动汇总改动、生成 PR 描述。用 `gh pr create` 创建的 PR 会自动关联当前会话，之后可用 `claude --from-pr <number>` 恢复到该 PR 的会话上下文。

---

### 2. Best Practices 精华提炼

#### 2.1 Context 是最贵的资源，主动管理它

| 行为 | 时机 |
|------|------|
| `/clear` | 任务切换、context 里堆满无关内容时 |
| `/compact [instructions]` | 想保留会话但释放空间时，可指定保留重点 |
| `/rewind` → 总结选项 | 只压缩会话的一半（前半或后半） |
| `/btw` | 问个小问题，答案显示在浮层，不进入对话历史 |
| Subagent 探索 | 让代码库调查在独立 context 里跑，只把结论带回来 |

自定义状态行（`/statusline`）可实时显示 context 占用百分比，建议开启。

#### 2.2 验证闭环：三个层次

1. **单次提示级** — 在提示里直接要求 Claude 运行测试并迭代直到通过；
2. **`/goal` 级** — 设置完成条件，独立评估器在每个回合后检查，Claude 自动继续；
3. **Stop hook 级** — 在 `.claude/settings.json` 里注册脚本，每次回合结束自动运行，可阻断回合。

#### 2.3 两次改正失败就重开

在一个会话里对同一问题改正 Claude 超过两次，context 已经被失败方案污染了。正确做法：`/clear` 然后用更精准的提示重新开始，把你从失败尝试中学到的约束条件直接写进新提示。

#### 2.4 提示精度决定结果质量

| 模糊提示 | 精准提示 |
|----------|----------|
| `为 foo.py 添加测试` | `为 foo.py 编写测试，覆盖用户未登录的边界情况，避免使用 mock` |
| `修复登录错误` | `用户报告 session 超时后登录失败，检查 src/auth/ 的 token 刷新逻辑，先写一个失败的复现测试再修复` |
| `让仪表板好看点` | `[粘贴截图] 按此设计实现，截图结果后与设计对比，列出差异并修复` |

---

### 3. Plan Mode 详解

#### 启用方式

| 方式 | 命令 |
|------|------|
| 会话中循环切换 | `Shift+Tab`（循环：default → acceptEdits → plan） |
| 单个提示前缀 | `/plan <your prompt>` |
| 启动时指定 | `claude --permission-mode plan` |
| 设为项目默认 | `.claude/settings.json` 中设置 `defaultMode: "plan"` |

#### 审查与批准计划

计划呈现后，你有多个选项：

- **批准并在 auto mode 中启动** — 让 Claude 自主执行计划，后台有安全分类器
- **批准并接受编辑** — 切换到 `acceptEdits` 模式执行
- **批准并手动审查每步编辑** — 切换到默认模式，每次文件修改都询问
- **继续规划并提供反馈** — 保持 Plan Mode，对计划提出修改意见
- `Ctrl+G` — 在文本编辑器中直接编辑计划内容

计划被接受时，会话名称会自动根据计划内容命名（除非你已用 `--name` 或 `/rename` 手动命名过）。

#### 退出 Plan Mode

再次按 `Shift+Tab` 即可退出，不会批准当前计划。

---

### 4. 权限模式全解析

Claude Code 有六种权限模式，每种在「便利性」和「监督程度」之间做出不同取舍：

| 模式 | 无需询问可执行的操作 | 最适合场景 |
|------|------|------|
| `default` | 仅读取 | 入门、敏感代码库、首次接触陌生项目 |
| `acceptEdits` | 读取 + 文件编辑 + `mkdir/touch/mv/cp/rm/rmdir/sed` 等文件系统命令 | 迭代开发，事后通过 `git diff` 审查而非逐步确认 |
| `plan` | 仅读取（同 default，但不允许写文件） | 探索和规划阶段 |
| `auto` | 所有操作，后台安全分类器实时审查 | 长任务、减少提示疲劳、信任任务方向时 |
| `dontAsk` | 仅预先在 allow 规则中批准的工具 | 锁定的 CI 管道、受控脚本环境 |
| `bypassPermissions` | 所有操作，绕过一切检查 | **仅限**容器、VM 等完全隔离环境 |

#### 切换方式

**会话中实时切换：**
```powershell
# 在终端会话内按 Shift+Tab 循环切换
# 当前模式显示在状态栏
```

**启动时指定：**
```powershell
claude --permission-mode acceptEdits
claude --permission-mode plan
claude --permission-mode auto
```

**设为持久默认（写入 settings.json）：**
```json
{
  "permissions": {
    "defaultMode": "acceptEdits"
  }
}
```

#### Auto Mode 重点说明

Auto Mode（v2.1.83+）是进阶用户最值得掌握的模式。其核心机制：一个独立的分类器模型在每个命令运行前审查，阻止超出请求范围的操作、涉及未知基础设施的操作、或被恶意内容诱导的操作。

**默认阻止的操作类型：**
- `curl | bash` 式下载执行
- 向外部端点发送敏感数据
- 生产环境部署和迁移
- 强制推送或直接推送到 `main`
- 不可逆删除会话开始前已存在的文件

**默认允许的操作类型：**
- 工作目录内的本地文件操作
- 安装 lockfile/manifest 中已声明的依赖
- 向 `.env` 中匹配的 API 发送凭证
- 只读 HTTP 请求
- 推送到当前分支或 Claude 新建的分支

**Auto Mode 回退机制：** 分类器连续阻止 3 次或总共阻止 20 次时，自动暂停并恢复询问模式。批准一次后恢复 auto。在 `-p` 非交互模式下，重复阻止会直接终止会话。

**重要限制：** `defaultMode: "auto"` 只能写在用户级设置 `~/.claude/settings.json` 中，项目级 `.claude/settings.json` 中的该设置会被忽略（防止仓库自授权）。

#### bypassPermissions 使用边界

此模式跳过所有提示和安全检查。在 Linux/macOS 上以 root 运行时会拒绝启动。针对文件系统根目录或主目录的删除操作（`rm -rf /`、`rm -rf ~`）仍保留断路器提示。

```powershell
# 正确用法：只在隔离容器内
claude --permission-mode bypassPermissions
# 等效写法：
claude --dangerously-skip-permissions
```

#### 受保护路径

在除 `bypassPermissions` 之外的所有模式中，以下目录的写入操作永远不会自动批准：

`.git`、`.vscode`、`.idea`、`.husky`、`.cargo`、`.devcontainer`、`.yarn`、`.mvn`、`.claude`（除 `.claude/commands`、`.claude/agents`、`.claude/skills`、`.claude/worktrees`）

以及 `.gitconfig`、`.bashrc`、`.zshrc`、`.npmrc` 等敏感配置文件。

---

### 5. 权限规则配置（settings.json）

#### 规则优先级：deny > ask > allow

第一个匹配的规则获胜。任何层级的 deny 规则都无法被其他层级的 allow 规则覆盖。

#### 基本语法

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git commit *)",
      "Bash(git status)",
      "WebFetch(domain:docs.anthropic.com)"
    ],
    "ask": [
      "Bash(git push *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push --force *)"
    ]
  }
}
```

#### Bash 规则通配符语法

```json
"Bash(npm run *)"          // 匹配所有 npm run 命令（注意 * 前的空格）
"Bash(npm*)"               // 匹配 npm、npmci 等（无边界约束）
"Bash(git * main)"         // 匹配 git checkout main、git merge main 等
"Bash(* --version)"        // 匹配任意工具的 --version 调用
"Bash(*)"                  // 等同于 Bash，匹配所有
```

**复合命令处理：** Claude Code 理解 `&&`、`||`、`;`、`|` 等分隔符，规则必须独立匹配每个子命令。批准 `git status && npm test` 会分别保存两条规则。

**只读命令豁免：** `ls`、`cat`、`echo`、`grep`、`find`、`git log`、`git status`、`git diff` 等只读命令在所有模式下无需权限提示。

#### PowerShell 规则（Windows）

```json
{
  "permissions": {
    "allow": [
      "PowerShell(Get-ChildItem *)",
      "PowerShell(git commit *)"
    ],
    "deny": [
      "PowerShell(Remove-Item *)"
    ]
  }
}
```

PowerShell 规则匹配不区分大小写，常见别名（`gci`、`ls`、`dir`）在匹配前被规范化为 cmdlet 名称。

#### 文件读写规则

```json
{
  "permissions": {
    "deny": [
      "Read(**/.env)",
      "Read(~/.ssh/**)",
      "Edit(/migrations/**)"
    ],
    "allow": [
      "Edit(/src/**)",
      "Read(~/project-docs/**)"
    ]
  }
}
```

路径锚点规则：

| 前缀 | 含义 | 示例 |
|------|------|------|
| `//path` | 绝对路径（文件系统根） | `Read(//Users/alice/secrets/**)` |
| `~/path` | 主目录相对路径 | `Read(~/.zshrc)` |
| `/path` | 项目根目录相对路径 | `Edit(/src/**/*.ts)` |
| `path` 或 `./path` | 当前工作目录相对路径 | `Read(*.env)` |

**Windows 路径规范化：** 路径在匹配前统一转换为 POSIX 形式，`C:\Users\alice` 变为 `/c/Users/alice`，使用 `//c/**/.env` 匹配 C 盘下的 `.env` 文件，`//**/.env` 匹配所有盘。

#### WebFetch 和 MCP 规则

```json
{
  "permissions": {
    "allow": [
      "WebFetch(domain:github.com)",
      "WebFetch(domain:npmjs.com)",
      "mcp__github",
      "mcp__github__create_issue"
    ],
    "deny": [
      "mcp__puppeteer"
    ]
  }
}
```

#### 查看与管理权限

```text
/permissions    # 打开权限管理 UI，查看所有规则来源
```

---

### 6. Checkpointing 检查点与 `/rewind` 回滚

#### 工作原理

每次你发送提示，Claude Code 都自动为当前文件状态创建一个检查点。检查点跨会话持久化（默认保留 30 天），即使关掉终端再用 `--resume` 恢复，检查点依然可用。

**重要限制：** 检查点只跟踪 Claude 的文件编辑工具（Edit/Write）所做的改动，不跟踪 Bash 命令的副作用（`rm`、`mv` 等）。检查点是会话级撤销，不替代 Git。

#### 打开回滚菜单

```text
# 方法一：运行命令
/rewind

# 方法二：提示输入为空时连按两次 Esc
# （提示框有内容时，双 Esc 是清空输入，不会打开菜单）
```

#### 回滚操作选项

选中某个检查点后，可以执行：

| 选项 | 效果 |
|------|------|
| 恢复代码和对话 | 同时回滚文件和对话历史 |
| 恢复对话 | 只回滚对话历史，代码保持当前状态 |
| 恢复代码 | 只还原文件，对话历史不变 |
| 从此处总结 | 压缩此检查点之后的对话，释放 context，保留此前详细历史 |
| 到此处总结 | 压缩此检查点之前的对话，保留最近消息的完整细节 |
| 算了 | 返回消息列表，不做任何操作 |

#### 恢复 vs 总结的选择逻辑

- **想撤销代码改动** → 选「恢复代码」或「恢复代码和对话」
- **想尝试不同方向但保留代码** → 选「恢复对话」，再给新指令
- **调试会话太长，想压缩前半段** → 找到调试开始的检查点，选「到此处总结」
- **想放弃某个分支探索但保留之前的积累** → 选「从此处总结」，指定压缩范围

#### 检查点与 Git 的关系

检查点覆盖的是「会话内撤销」的场景：试验性改动失败了，快速回退。Git 承担「永久版本历史」职责。两者互补，不要用检查点替代 `git commit`。

---

### 7. 会话管理：`--continue`、`--resume`、命名会话

#### 恢复上次会话

```powershell
# 恢复当前目录最近的会话（无对话则报错退出）
claude --continue

# 打开会话选择器，从列表中选择
claude --resume

# 直接按名称恢复
claude --resume oauth-migration

# 恢复关联到某个 PR 的会话
claude --from-pr 1234
```

#### 命名会话

```powershell
# 启动时命名
claude -n oauth-migration

# 会话中重命名
/rename oauth-migration
```

命名后可按名称恢复，也可在会话选择器中按 `Ctrl+R` 重命名。在 Plan Mode 接受计划时，若未手动命名，会自动根据计划内容生成名称。

#### 会话选择器快捷键

在 `claude --resume` 打开的选择器中：

| 快捷键 | 操作 |
|--------|------|
| `↑` / `↓` | 在会话间导航 |
| `→` / `←` | 展开/折叠分组（分支会话） |
| `Space` | 预览会话内容 |
| `Ctrl+R` | 重命名当前会话 |
| `/` + 关键词 | 搜索过滤，支持粘贴 PR URL 定位 |
| `Ctrl+A` | 展示本机所有项目的会话 |
| `Ctrl+W` | 展示当前仓库所有 worktree 的会话 |
| `Ctrl+B` | 过滤到当前 git 分支的会话 |

#### 分支会话：同一起点，两个方向

```text
# 在会话内创建分支
/branch try-streaming-approach

# 命令行分支启动
claude --continue --fork-session
```

分支创建当前会话的完整副本，原始会话不受影响，两个会话在选择器中以树形分组。分支间的权限批准不共享。

**适用场景：** 不确定两种实现哪个更好时，在当前状态开分支，分别实验，比较结果后合入主分支或丢弃。

#### 会话数据位置

会话以 JSONL 格式存储于：
```
~\.claude\projects\<project>\<session-id>.jsonl
```

默认 30 天后自动清理，可在 `settings.json` 中用 `cleanupPeriodDays` 修改。

导出当前会话：
```text
/export                    # 复制到剪贴板
/export session-2024.txt   # 保存为文件
```

---

### 8. `/goal`：目标驱动的自主迭代

`/goal`（v2.1.139+）设置一个完成条件，每个回合结束后由独立的小型评估模型（默认 Haiku）判断条件是否满足，若未满足则 Claude 自动开启下一个回合，无需你手动触发。

#### 基本使用

```text
# 设置目标
/goal all tests in test/auth pass and the lint step is clean

# 查看当前状态（回合数、Token 消耗、评估器最新判断）
/goal

# 提前终止
/goal clear
```

目标激活后，状态栏显示 `◎ /goal active` 及运行时长。

#### 编写有效的完成条件

评估器不能独立执行命令，它只看 Claude 在对话中呈现的内容。因此条件要写成「Claude 的输出可以证明的事情」：

```text
# 好的条件写法
/goal npm test exits 0 with no failing tests in the auth module

/goal git status is clean after running the migration and all existing tests pass

/goal CHANGELOG.md has an entry for every PR merged this week, verified by listing merged PRs with gh
```

```text
# 弱的条件写法（评估器无法判断）
/goal the code is correct         # "正确"如何验证？
/goal the feature is implemented  # 缺少可验证的终态指标
```

**限制运行轮数：** 在条件中加上回合上限——
```text
/goal all lint errors are fixed, or stop after 20 turns
```

#### `/goal` vs `/loop` vs Stop Hook

| 工具 | 触发下一回合的条件 | 停止条件 | 适用场景 |
|------|------|------|------|
| `/goal` | 前一回合结束 | 评估模型确认条件满足 | 有明确完成状态的任务 |
| `/loop` | 时间间隔到期 | 手动停止或 Claude 判断完成 | 定时轮询、周期检查 |
| Stop Hook | 前一回合结束 | 你的脚本决定 | 需要确定性检查（运行测试、检查文件） |

`/goal` 和 auto mode 是互补关系：auto mode 消除回合内的每个工具提示，`/goal` 消除回合间的人工触发。两者组合实现完全自主运行。

#### 非交互式使用

```powershell
claude -p "/goal CHANGELOG.md has an entry for every PR merged this week"
```

此命令会一直运行到条件满足或手动 `Ctrl+C` 中断。

#### 恢复时的目标状态

用 `--resume` 或 `--continue` 恢复会话时，仍活跃的目标会自动恢复，但回合计数、计时器和 Token 基线重置。已清除或已达成的目标不会恢复。

---

### 9. Worktrees 并行隔离（简述）

Worktrees 让你在同一仓库的多个独立分支上同时运行多个 Claude 会话，互不干扰。

```powershell
claude --worktree feature-auth
# 在另一个终端：
claude --worktree bugfix-login
```

每个 worktree 是独立的 git 检出，文件修改完全隔离。这是并行开发（一个 Claude 写功能、另一个修 bug）的标准做法。

Worktrees 内容详见 [03-customization-and-extensions.md](/books/claude-code-advanced/03-customization-and-extensions/)，包括 `--fork-session`、`.worktreeinclude`、非 git VCS 支持等进阶用法。

---

## 实操示例（Windows/PowerShell 友好）

### 示例一：完整四阶段工作流

```powershell
# 进入项目目录，启动 Claude
cd D:\myproject
claude -n "add-rate-limiter"

# 交互式输入（以下为 Claude 提示框内的内容）
```

```text
# Step 1：进入 Plan Mode（Shift+Tab 切换），然后探索
read @src/middleware and understand existing middleware patterns.
check how we currently handle API routes.

# Step 2：规划
design a rate limiter middleware for our API.
suggest implementation options, list files to change, create a detailed plan.

# Step 3：按 Ctrl+G 在编辑器里修改计划，批准后切回默认模式（再按 Shift+Tab）
# Step 4：实现
implement the rate limiter from your plan.
write unit tests for edge cases (burst limit, window reset, per-user vs global).
run tests and fix any failures.

# Step 5：提交
commit with a descriptive message and open a PR
```

### 示例二：用 `/goal` 处理积压 lint 错误

```powershell
claude --permission-mode auto
```

```text
/goal running `npm run lint` exits 0 with no errors, or stop after 30 turns
```

### 示例三：配置 Windows 项目权限规则

在项目根目录 `.claude\settings.json`（Windows 路径分隔符也支持，但 JSON 内用正斜杠）：

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(npm run *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(npx *)",
      "PowerShell(Get-ChildItem *)",
      "PowerShell(npm *)",
      "WebFetch(domain:docs.anthropic.com)",
      "WebFetch(domain:nodejs.org)"
    ],
    "ask": [
      "Bash(git push *)"
    ],
    "deny": [
      "Bash(git push --force *)",
      "Bash(rm -rf *)",
      "Read(**/.env.production)"
    ]
  }
}
```

### 示例四：检查点实战——安全地做破坏性重构

```text
# 在重构前先确认当前状态是干净的 git 提交

# 开始重构
refactor the auth module to use the new token service.
this will touch many files. proceed step by step.

# 如果重构方向错了，空提示框时双按 Esc
# 选择"恢复代码和对话"回到重构前的状态
# 换一个方向重试
```

### 示例五：多会话并行开发

```powershell
# 终端 1：主功能开发
claude -n "feature-oauth" --permission-mode acceptEdits

# 终端 2：修复紧急 bug（另开一个 PowerShell 窗口）
claude --worktree bugfix-session-timeout -n "bugfix-session"

# 切回任意一个会话
claude --resume feature-oauth
claude --resume bugfix-session
```

---

## 动手练习

### 练习 1：体验 Plan Mode 的价值（约 15 分钟）

在一个你熟悉的项目中，用 Plan Mode 规划一个你本来会直接动手的功能：

1. `claude --permission-mode plan`
2. 描述要加的功能，让 Claude 探索相关文件
3. 要求 Claude 生成详细实现计划
4. 按 `Ctrl+G` 打开计划并修改其中一个步骤
5. 批准计划，切回默认模式，让 Claude 实现

记录：计划阶段发现了哪些你没预想到的依赖或影响？

### 练习 2：配置项目权限规则（约 10 分钟）

为你的项目创建 `.claude/settings.json`：

1. 把你最常批准的 5 个命令加入 `allow`
2. 把危险操作（如强制推送、删除生产配置）加入 `deny`
3. 用 `claude --permission-mode acceptEdits` 启动，验证不再频繁弹出确认框
4. 在会话内运行 `/permissions` 查看规则生效情况

### 练习 3：检查点回滚演练（约 10 分钟）

1. 在测试项目中让 Claude 做一个较大改动
2. 空输入框时双按 `Esc` 打开回滚菜单
3. 先选「恢复对话」（保留代码）观察效果
4. 再次回滚，这次选「恢复代码」（撤销文件改动）
5. 尝试「从此处总结」，观察 context 使用量变化

### 练习 4：用 `/goal` 实现持续迭代（约 20 分钟）

找一个有 lint 错误或测试失败的项目：

1. `claude --permission-mode auto`（需满足 auto mode 要求）
2. `/goal npm run lint exits 0, or stop after 15 turns`
3. 离开屏幕做别的事情，等待完成通知
4. 回来查看：多少轮完成？评估器判断了什么？

### 练习 5：会话管理实战（约 15 分钟）

模拟"中断后恢复"场景：

1. 启动一个任务：`claude -n "task-session-test"`
2. 做 3-4 轮对话
3. 退出（Ctrl+C 或关闭终端）
4. 用 `claude --resume task-session-test` 恢复
5. 确认对话历史完整
6. 用 `/branch try-alternative` 创建分支
7. 在分支中走不同方向
8. 用 `claude --resume task-session-test` 切回主线

---

## 常见坑与注意事项

**1. Auto Mode 只能在用户级 settings.json 设默认值**
`.claude/settings.json`（项目级）中的 `defaultMode: "auto"` 会被忽略，必须写在 `~/.claude/settings.json` 中。错误现象：设置了却没生效，会话还是以 `default` 模式启动。

**2. 检查点不跟踪 Bash 命令的副作用**
`/rewind` 只能还原 Claude 的 Edit/Write 工具做的改动。Claude 通过 Bash 运行的 `rm`、`mv`、数据库迁移等操作无法通过检查点撤销，这部分要依赖 Git 和数据库备份。

**3. 双 Esc 的前提是提示输入框为空**
如果输入框有文字，双 Esc 是清空输入（清空的文字进入输入历史，按 `↑` 可恢复），不会打开 `/rewind` 菜单。

**4. `/goal` 的评估器只看对话中可见的内容**
评估器不会独立跑命令或读文件，所以条件一定要包含「Claude 如何证明」的陈述。不包含可验证输出的条件（"代码是正确的"）会导致评估器无法准确判断，可能过早通过或无限循环。

**5. Plan Mode 下 `Shift+Tab` 退出不批准计划**
再次按 `Shift+Tab` 是放弃当前计划回到默认模式，不是批准。要批准计划，需要在计划呈现后选择对应的批准选项。

**6. Windows 路径在权限规则中的写法**
JSON 中路径使用正斜杠。C 盘的绝对路径写成 `//c/Users/alice`，匹配所有盘写 `//**/.env`。`/path` 是项目根目录相对路径，不是盘符根目录。

**7. 复合命令规则不能用宽泛的前缀覆盖**
`Bash(safe-cmd *)` 不能授权 `safe-cmd && dangerous-cmd` 的执行，Claude Code 会解析 `&&`、`||`、`;`、`|` 并对每个子命令独立匹配规则。

**8. `--continue` 在没有历史会话时会报错退出**
`claude --continue` 找不到会话时打印 `No conversation found to continue` 并退出，不会创建新会话。第一次在新目录使用时直接运行 `claude` 即可。

---

## 掌握标志（自测清单）

- [ ] 能清晰说出四阶段工作流每个阶段的目的，以及什么情况下可以跳过规划阶段
- [ ] 能熟练用 `Shift+Tab` 在 default / acceptEdits / plan 间切换，知道 auto 和 bypassPermissions 如何加入循环
- [ ] 能写出允许特定 npm 命令、拒绝 `git push --force`、限制某个路径读取的 `settings.json` 片段
- [ ] 知道 auto mode 分类器默认允许和阻止的操作类别，以及 3+20 次回退阈值的含义
- [ ] 能用 `/rewind` 打开检查点菜单，知道「恢复代码」和「到此处总结」的区别
- [ ] 能用 `--continue`、`--resume <name>`、`-n` 管理命名会话，能用 `/branch` 在当前状态创建分支
- [ ] 能写出一个有效的 `/goal` 条件，知道评估器工作原理和"或 20 轮后停止"的写法
- [ ] 知道 Worktrees 用于并行隔离，能用 `claude --worktree <name>` 启动隔离会话

---

## 延伸阅读

### 官方文档

- [常见工作流](https://code.claude.com/docs/zh-CN/common-workflows) — 本篇工作流模式的文档来源
- [最佳实践](https://code.claude.com/docs/zh-CN/best-practices) — Context 管理、验证闭环、提示策略完整版
- [权限模式](https://code.claude.com/docs/zh-CN/permission-modes) — 六种模式的详细说明和切换方法
- [配置权限](https://code.claude.com/docs/zh-CN/permissions) — allow/ask/deny 规则完整语法参考
- [Checkpointing](https://code.claude.com/docs/zh-CN/checkpointing) — 检查点机制和恢复 vs 总结的完整说明
- [管理会话](https://code.claude.com/docs/zh-CN/sessions) — `--continue`、`--resume`、分支会话、导出的完整参考
- [让 Claude 朝着目标工作](https://code.claude.com/docs/zh-CN/goal) — `/goal` 命令完整文档

### 系列其他文章

- [00-foundations.md](/books/claude-code-advanced/00-foundations/) — Claude Code 基础与架构
- [01-context-engineering.md](/books/claude-code-advanced/01-context-engineering/) — CLAUDE.md 设计、context 工程与 token 经济学
- **本篇 → 02-workflow-and-sessions.md** — 工作流与会话控制（当前）
- [03-customization-and-extensions.md](/books/claude-code-advanced/03-customization-and-extensions/) — Worktrees 并行隔离、Skills、Hooks、自定义 subagents
- [04-mcp-and-tools.md](/books/claude-code-advanced/04-mcp-and-tools/) — MCP 服务器配置与自定义工具
- [05-multi-agent-orchestration.md](/books/claude-code-advanced/05-multi-agent-orchestration/) — 多智能体编排、Writer/Reviewer 模式
- [06-automation.md](/books/claude-code-advanced/06-automation/) — CI/CD 集成、非交互模式、Routines
- [07-agent-sdk.md](/books/claude-code-advanced/07-agent-sdk/) — Agent SDK 构建自定义代理

