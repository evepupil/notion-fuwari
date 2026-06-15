---
title: '阶段 0 · 地基校准——理解引擎与交互基础'
draft: false
---

> 弄清楚 Claude Code 在引擎盖下如何运作，掌握每天都在用但未必用透的交互机制，消灭日常使用中的隐性效率损耗。

---

## 这篇你会学到

- Agent Loop 的三阶段结构与工具调用机制
- 交互模式 vs `-p` 一次性模式的本质差异与组合姿势
- 内置斜杠命令全集与自定义命令入口
- `@` 文件提及、`!` shell 直通、`#` 快速记忆的精确用法
- `Esc` 单击/双击的不同行为，`/rewind` 回滚机制
- Windows/PowerShell 下的管道与组合用法
- 常用键位速查

---

## 为什么重要

大多数进阶开发者在"能用"阶段停留太久。他们知道怎么提问，但不清楚 Claude Code 背后的 loop 是怎么迭代的——所以在 Claude 跑偏时不知道该在哪个时机介入；他们会用斜杠命令，但不清楚哪些是内置命令、哪些来自 skill、哪些由 MCP 贡献——所以不知道怎么扩展；他们用 `-p` 跑脚本，但不知道输出格式选项——所以写出来的自动化管道很脆。

这篇从机制层面补齐这些盲区。

---

## 核心概念

### 1. Agent Loop：三阶段迭代引擎

官方文档把 agent loop 描述为三个相互融合的阶段：**收集上下文 → 采取行动 → 验证结果**，然后循环，直到任务完成。

```
你的提示
   ↓
[收集上下文] → 读文件、搜索代码、理解结构
   ↓
[采取行动]   → 编辑文件、运行命令、调用工具
   ↓
[验证结果]   → 跑测试、读输出、检查错误
   ↓
根据结果决定下一步 → 继续循环 or 完成
```

循环深度由任务复杂度决定。一个"解释这个函数"的问题可能只触发"收集上下文"就结束；修复一个有依赖链的 bug 可能循环十几次，每次都用上一步的工具返回值来决定下一步。

**驱动循环的两个组件：**

- **模型（Model）**：负责推理，决定"下一步做什么"。当文档说"Claude 选择"或"Claude 决定"，指的是模型在推理。
- **工具（Tools）**：负责行动，让模型的决策变成实际操作。每次工具调用返回结果，反馈进循环，告知下一个决策。

**五类内置工具：**

| 类别 | 能做什么 |
|---|---|
| 文件操作 | 读、写、编辑、创建、重命名文件 |
| 搜索 | 按模式查找文件、正则搜索内容、探索代码库 |
| 执行 | 运行 shell 命令、启动服务、跑测试、使用 git |
| 网络 | 搜索网络、获取文档、查找错误信息 |
| 代码智能 | 查看类型错误、跳转定义、查找引用（需要代码智能插件） |

此外还有用于生成 subagent、询问用户、编排任务的工具。

**你也是循环的一部分。** 任何时刻都可以中断并重新引导。这是 Claude Code 区别于"一次性 AI 工具"的核心设计——它在设计上就预期你会在过程中介入。

---

### 2. 会话与上下文窗口

**会话持久化**：每条消息、每次工具调用及其返回值都写入 `~/.claude/projects/` 下的 JSONL 文件。文件编辑前会对原始内容快照，方便回滚。

**会话独立性**：每个新会话从空白上下文窗口开始，没有前一个会话的对话历史。跨会话的持久化靠两个机制：
- `CLAUDE.md`：你手动维护的项目/全局规则
- 自动内存（Auto Memory）：Claude 自动保存的学习内容，每个会话开始时加载前 200 行或 25KB

**上下文填满时的行为**：Claude Code 先清除较旧的工具输出，再对对话做总结。关键代码片段和请求被保留，对话早期的详细说明可能丢失。**持久规则放 CLAUDE.md，别依赖对话历史**。用 `/context` 可视化当前上下文占用。

---

### 3. 交互模式 vs `-p` 一次性模式

**交互模式**（`claude` 直接启动）：
- 完整的 REPL 环境，支持多轮对话
- 所有斜杠命令、快捷键、`@`/`!`/`#` 前缀均可用
- 会话自动保存，可用 `--continue` / `--resume` 恢复

**`-p` 一次性模式**（Print 模式）：
- 执行完毕即退出，适合脚本/CI/管道
- 通过 `--output-format` 控制输出格式：`text`（默认）、`json`、`stream-json`
- 支持 `--max-turns` 限制循环轮数，`--max-budget-usd` 限制花费上限
- 支持 `--no-session-persistence` 不写磁盘（适合无状态 CI）

**典型场景对照：**

```powershell
# 交互模式：进入 REPL，适合探索性工作
claude

# 一次性模式：脚本化调用，获取纯文本结果
claude -p "总结 src/auth/ 下的认证流程"

# 管道输入：把标准输入喂给 Claude（PowerShell）
Get-Content .\logs\error.log | claude -p "分析这些错误，找出根因"

# 等价的 bash 写法（通过 Bash 工具或 WSL）
cat logs/error.log | claude -p "分析这些错误，找出根因"

# JSON 格式输出（适合脚本解析）
claude -p "列出 src/ 下所有 TODO 注释" --output-format json

# 继续上一个会话再以 -p 方式追加
claude -c -p "现在把刚才的修复也覆盖到测试文件"
```

**`--bare` 模式**：跳过 hooks、skills、plugins、MCP、自动内存和 CLAUDE.md 自动发现，启动更快，适合对性能敏感的脚本化调用：

```powershell
claude --bare -p "用一句话描述这个函数的作用" 
```

---

### 4. 斜杠命令全集

在会话内输入 `/` 查看所有可用命令；输入 `/` 后接字母筛选。命令分三类来源：

- **内置命令**：硬编码在 CLI 中
- **Bundled Skills**：以 Skill 形式捆绑，行为与自定义 skill 相同（标记为 `[Skill]`）
- **MCP prompts**：由连接的 MCP server 贡献，格式为 `/mcp__<server>__<prompt>`

**高频内置命令速查（按场景分组）：**

*上下文管理*

| 命令 | 用途 |
|---|---|
| `/clear [name]` | 清空上下文，开启新对话；传名字可在 `/resume` 中标记旧对话 |
| `/compact [instructions]` | 压缩对话释放上下文，可附加压缩焦点说明，如 `/compact focus on auth changes` |
| `/context [all]` | 可视化上下文占用，显示优化建议 |

*会话导航*

| 命令 | 用途 |
|---|---|
| `/resume [session]` | 按 ID 或名称恢复对话，或打开选择器 |
| `/branch [name]` | 在当前点分叉对话，保留原始分支（别名 `/fork`） |
| `/rewind` | 将对话和/或代码回滚到上一个检查点（别名 `/checkpoint`、`/undo`） |
| `/rename [name]` | 重命名当前会话 |

*模型与模式*

| 命令 | 用途 |
|---|---|
| `/model [model]` | 切换模型，保存为新会话默认值 |
| `/effort [level]` | 设置推理工作量：`low`/`medium`/`high`/`xhigh`/`max` |
| `/plan [description]` | 直接进入 Plan Mode（只读工具，先规划后执行） |
| `/fast [on\|off]` | 切换快速模式 |

*代码审查*

| 命令 | 用途 |
|---|---|
| `/code-review [level] [--fix] [--comment]` | 审查当前 diff；`--fix` 自动应用修复；`ultra` 触发云端多 agent 深度审查 |
| `/diff` | 交互式查看未提交更改与每轮差异 |
| `/security-review` | 分析当前分支待提交内容的安全风险 |

*记忆与项目*

| 命令 | 用途 |
|---|---|
| `/memory` | 编辑 CLAUDE.md，管理自动内存条目 |
| `/init` | 为项目生成 CLAUDE.md 初始文件 |
| `/hooks` | 查看当前 hook 配置 |

*工具与扩展*

| 命令 | 用途 |
|---|---|
| `/mcp` | 管理 MCP server 连接和 OAuth |
| `/agents` | 管理 subagent 配置 |
| `/permissions` | 管理工具权限的允许/询问/拒绝规则 |
| `/skills` | 列出可用 skill，按 `t` 按 token 排序 |

*快问与侧边*

| 命令 | 用途 |
|---|---|
| `/btw <question>` | 不进入对话历史的快速侧边提问，Claude 工作中也可用 |
| `/recap` | 按需生成会话单行摘要 |

*诊断*

| 命令 | 用途 |
|---|---|
| `/doctor` | 诊断安装和配置问题，按 `f` 让 Claude 修复 |
| `/debug [description]` | 启用调试日志并排查问题（Skill） |
| `/cost` / `/usage` | 查看当前会话费用和使用统计 |

**自定义命令入口**：自己写的 skill（markdown 文件放在 `.claude/commands/` 或 `~/.claude/commands/`）会出现在 `/` 菜单中，与内置命令并列。关于 skill 的创作见 `03-customization-and-extensions.md`。

---

### 5. `@` 文件/目录提及

在提示中输入 `@` 触发文件路径自动补全，将文件内容注入上下文：

```text
帮我重构 @src/auth/token.ts，参考 @src/auth/session.ts 的写法
```

可以提及目录，Claude 会遍历其中的文件：

```text
@src/payments/ 这里的支付流程有没有遗漏错误处理？
```

`@` 提及比"请读取文件 X"更精确——它明确告诉 Claude 哪些文件是上下文的一部分，减少 Claude 自行决定读哪些文件带来的不确定性。在大型项目中，主动 `@` 关键文件比依赖 Claude 搜索更省 token、更可预期。

---

### 6. `!` 前缀：直接执行 Shell

在提示开头输入 `!` 进入 Shell 模式，绕过 Claude 直接运行命令，命令及输出会被加入对话上下文：

```powershell
! git status
! npm test
! Get-Content .\src\config.ts
```

Shell 模式的特性：
- 命令输出实时显示
- 执行结果进入对话上下文，Claude 后续可以引用
- 支持 `Ctrl+B` 将长时间运行的命令移到后台
- 支持基于历史的 Tab 补全（从当前项目的历史 `!` 命令中补全）
- 用 `Escape`、`Backspace` 或空提示上 `Ctrl+U` 退出 Shell 模式
- 将以 `!` 开头的文本粘贴到空提示时自动进入 Shell 模式

**典型用法**：在 Claude 分析代码前先用 `!` 运行一遍测试，让失败输出直接进入上下文：

```text
! npm test
现在帮我修复上面失败的测试
```

---

### 7. `#` 快速写入记忆

在提示开头输入 `#` 将当前内容快速存入 CLAUDE.md（项目级或全局级，取决于你的配置）：

```text
# 这个项目的 API 客户端统一在 src/api/client.ts，不要直接用 fetch
```

这是在对话中随手积累规范的最快路径。比直接 `/memory` 打开编辑器快，适合"刚发现一个惯例，顺手记下来"的场景。

> **注意**：`#` 写入的是记忆文件，与对话历史分开。下一个会话开始时这条规则就会生效。

---

### 8. Esc 中断与双击 Esc 回溯

**单击 `Esc`**：立即中断 Claude 正在进行的响应或工具调用。Claude 停止，等待你的下一条指令，已完成的工作保留。适合"跑偏了，我来重定向"的场景。

**双击 `Esc`（`Esc` + `Esc`）**：
- 如果提示框有内容：清除输入草稿，草稿保存到历史（按 `Up` 可找回）
- 如果提示框为空：打开**回退菜单**，可以从上一个检查点恢复代码和对话状态

这两个行为经常被混淆。记住：有内容时是"清草稿"，空提示时才是"回滚"。

---

### 9. `/rewind`：检查点回滚

`/rewind`（别名 `/checkpoint`、`/undo`）把对话和代码回滚到上一个操作点。具体行为：
- 可以选择性地只回滚代码，或同时回滚对话
- 也可以从选定消息开始做总结（而非完全丢弃）
- 检查点是会话本地的，独立于 git
- 影响远程系统的操作（数据库、API、部署）无法检查点

`/rewind` 和双击 `Esc` 的区别：`/rewind` 更精细，可以指定回滚到哪个点；双击 `Esc` 是快速回到上一个状态的快捷手势。

---

### 10. 权限模式与 Shift+Tab

`Shift+Tab` 循环切换四种权限模式：

| 模式 | 行为 |
|---|---|
| `default` | 文件编辑和 shell 命令前询问 |
| `acceptEdits` | 自动接受文件编辑和常见文件系统命令（mkdir、mv 等），其他命令仍询问 |
| `plan` | 仅使用只读工具，生成计划供你批准后再执行 |
| `auto` | 后台安全检查评估所有操作（研究预览功能） |

启动时可用 `--permission-mode` 直接指定：

```powershell
# 以 plan 模式启动，先规划再执行
claude --permission-mode plan

# 自动接受编辑，减少询问（适合已信任的任务）
claude --permission-mode acceptEdits
```

---

### 11. 常用键位速查

**通用控制**

| 快捷键 | 功能 |
|---|---|
| `Ctrl+C` | 中断正在运行的操作；无操作时第一次清除输入，第二次退出 |
| `Ctrl+D` | 退出会话（EOF 信号） |
| `Esc` | 中断 Claude 当前响应 |
| `Esc` + `Esc` | 清除草稿（有内容时）/ 打开回退菜单（空提示时） |
| `Shift+Tab` | 循环切换权限模式 |
| `Alt+P`（Windows） | 切换模型（不清除提示） |
| `Alt+T`（Windows） | 切换扩展思考模式 |
| `Alt+O`（Windows） | 切换快速模式 |
| `Ctrl+R` | 反向搜索命令历史（交互式，支持按 `Ctrl+S` 切换搜索范围） |
| `Ctrl+L` | 强制重绘屏幕（显示混乱时用） |
| `Ctrl+O` | 切换转录查看器（展开 MCP 调用细节） |
| `Ctrl+B` | 将当前 bash 命令移到后台（tmux 用户按两次） |
| `Ctrl+G` / `Ctrl+X Ctrl+E` | 在外部编辑器中编辑提示 |
| `Alt+V`（Windows/WSL） | 从剪贴板粘贴图像 |

**文本编辑**

| 快捷键 | 功能 |
|---|---|
| `Ctrl+A` / `Ctrl+E` | 移到行首 / 行尾 |
| `Ctrl+K` | 删到行尾（可用 `Ctrl+Y` 粘贴回来） |
| `Ctrl+U` | 从光标删到行首 |
| `Ctrl+W` | 删除上一个单词 |
| `Alt+B` / `Alt+F` | 按单词向后/向前移动光标 |

**多行输入**（Windows Terminal 开箱即用）

| 方法 | 快捷键 |
|---|---|
| 所有终端通用 | `\` + `Enter` 或 `Ctrl+J` |
| Windows Terminal | `Shift+Enter` |

---

### 12. 管道与组合用法

**PowerShell 管道输入**：

```powershell
# 把文件内容通过管道送给 Claude 分析
Get-Content .\src\utils.ts | claude -p "找出这个文件里所有可能的边界情况"

# 读取日志文件的最后 100 行分析
Get-Content -Tail 100 .\logs\app.log | claude -p "这些错误的根因是什么？"

# 把 git diff 送给 Claude 做代码审查
git diff HEAD~1 | claude -p "审查这次提交，找出潜在问题"

# 把命令输出送给 Claude
npm test 2>&1 | claude -p "哪些测试失败了，原因是什么？"
```

**与其他工具组合**：

```powershell
# 让 Claude 生成内容并写入文件
claude -p "为 src/auth/token.ts 写单元测试" | Out-File -Encoding utf8 .\src\auth\token.test.ts

# 结合 jq 处理 JSON 输出（需要安装 jq）
claude -p "列出 API 端点" --output-format json | jq '.[]'

# 脚本中检查返回码（-p 模式成功返回 0）
claude -p "检查 src/ 下有没有 console.log 遗留" --output-format text
if ($LASTEXITCODE -ne 0) { Write-Host "检查失败" }
```

**`stream-json` 输出格式**（适合实时处理）：

```powershell
# 流式输出，每个 token 单独一行 JSON
claude -p "重构 src/db/query.ts" --output-format stream-json --verbose
```

**后台运行长任务**：

```powershell
# 启动后台 agent，立即返回 session ID
claude --bg "对整个代码库跑全量测试并生成报告"

# 查看后台会话状态
claude agents

# 附加到后台会话
claude attach <session-id>
```

---

## 实操示例

以下示例在 Windows 11 + PowerShell 下均可直接运行。

### 示例 1：完整的"分析→修复→验证"循环

```powershell
# 第一步：把测试失败输出直接带入上下文
claude
```

进入交互模式后：

```text
! npm test 2>&1
```

等测试输出显示后：

```text
帮我修复上面所有失败的测试。先不要修改代码，把你的修复计划说一下。
```

审核计划后：

```text
好，按计划执行。
```

修完后验证：

```text
! npm test
```

---

### 示例 2：用管道做快速日志分析

```powershell
# 取最后 200 行错误日志直接分析
Get-Content -Tail 200 .\logs\error.log | claude -p "分类汇总这些错误，按频率排序，给出最可能的根因"
```

---

### 示例 3：`@` 文件提及精准定位上下文

```text
@src/payments/checkout.ts @src/payments/types.ts
这两个文件里，持有过期卡的用户走到哪一步会出错？
```

---

### 示例 4：结合 `/btw` 不打断主线任务

```text
帮我把 src/api/ 下所有的 fetch 调用改成用统一的 apiClient
```

（Claude 工作中，突然想查个事儿）

```text
/btw apiClient 的超时时间现在是多少？
```

Claude 从已有上下文回答，不影响正在进行的重构任务。

---

### 示例 5：`/rewind` 撤销一次跑偏的修改

Claude 改了一批文件但方向不对：

```text
/rewind
```

在回退菜单里选择回滚到修改前的检查点，代码恢复，对话也回到该点。然后给出更明确的指令重新开始。

---

## 动手练习

**练习 1（基础）**：启动一个交互会话，用 `!` 运行一条 git 命令（如 `! git log --oneline -5`），然后问 Claude："基于上面的提交历史，最近在做什么方向的工作？" 观察命令输出如何自动进入上下文。

**练习 2（中级）**：在你的项目根目录运行 `git diff HEAD~1 | claude -p "这次提交有没有遗漏错误处理？" --output-format text`，体验管道输入的一次性模式。

**练习 3（中级）**：进入交互模式，用 `@` 提及两个互相关联的源文件，问 Claude 它们之间的调用关系。然后 `Esc` 中断一个正在运行的响应，给出更具体的补充说明，观察 Claude 如何调整。

**练习 4（进阶）**：用 `Shift+Tab` 把权限模式切到 `plan`，然后让 Claude 做一个会修改多个文件的任务（比如"重命名一个函数并更新所有调用处"），观察它只输出计划而不执行。切回 `default` 模式，让 Claude 执行该计划。

**练习 5（进阶）**：在一个有失败测试的项目里：(1) 进入交互会话；(2) `! npm test` 运行测试；(3) 让 Claude 修复；(4) 修完后发现方向不对，用 `/rewind` 回滚；(5) 给出更精确的约束条件重新修复。完整走一遍"修→回滚→重修"的循环。

---

## 常见坑与注意事项

**坑 1：依赖对话历史做规则**
对话早期说过的"所有函数必须有 JSDoc"，在上下文压缩后可能消失。规则一律放 CLAUDE.md，而非对话里。

**坑 2：`-p` 模式下权限提示导致挂起**
在 CI/脚本环境用 `-p` 时，如果 Claude 遇到需要权限的操作会等待输入，导致脚本挂起。解决方案：用 `--allowedTools` 预授权已知安全的工具，或用 `--permission-mode acceptEdits` 自动接受文件编辑。

**坑 3：双击 Esc 回滚触发条件**
双击 Esc 打开回退菜单的前提是**提示框为空**。如果提示框里有未提交的文字，双击 Esc 只会清掉草稿，不会打开回退菜单。先清空输入，再双击。

**坑 4：`!` 命令的作用域**
`!` 命令在 Claude Code 的上下文里运行，工作目录是你启动 claude 时的目录。如果任务需要在特定子目录运行命令，要显式 `! cd src && npm test` 或用绝对路径。

**坑 5：`@` 提及和工具读取的区别**
`@file.ts` 是在提示里**直接注入文件内容**，立刻消耗上下文 token。让 Claude 自己去读文件则是工具调用，按需加载。对于大文件或不确定是否需要的文件，让 Claude 自己决定是否读取更省 token；对于必须参考的关键文件，`@` 提及更可靠。

**坑 6：PowerShell 管道编码**
PowerShell 默认 UTF-16 LE，通过管道送给 claude 可能有编码问题。如遇乱码，加 `-Encoding utf8`：

```powershell
Get-Content -Encoding utf8 .\src\utils.ts | claude -p "..."
```

**坑 7：`stream-json` 格式下 `--verbose` 是必须的**
`--output-format stream-json` 配合 `--verbose` 才能看到完整的逐轮输出，包括工具调用细节。单独用 `stream-json` 输出会比较简略。

---

## 掌握标志

完成这篇后，你应该能自测以下内容：

- [ ] 能描述 agent loop 三个阶段各做什么，以及它们在哪些任务类型上循环的深度不同
- [ ] 知道 `-p` 模式和交互模式在会话持久化、输出格式、权限处理上的差异
- [ ] 能在 PowerShell 里写出正确的管道输入命令，把文件或命令输出送给 Claude 分析
- [ ] 知道 `/` 菜单里的命令来自三个不同来源（内置/Skill/MCP），知道自定义命令怎么接入
- [ ] 清楚 `@` 提及、`!` 前缀、`#` 前缀各自的精确语义，不会混用
- [ ] 知道单击 Esc 和双击 Esc 的两种不同行为及触发条件
- [ ] 知道 `/rewind` 能做什么、不能做什么（外部系统操作无法回滚）
- [ ] 会用 `Shift+Tab` 切换权限模式，知道各模式的确切行为差异
- [ ] 知道哪些命令是 `/context`、`/compact`、`/rewind` 适用的场景
- [ ] 理解上下文压缩机制及其对"对话历史里的规则"的影响

---

## 延伸阅读

**官方文档**（本文资料来源）：
- [Claude Code 如何工作](https://code.claude.com/docs/zh-CN/how-claude-code-works) — agent loop 与工具系统完整说明
- [交互模式参考](https://code.claude.com/docs/zh-CN/interactive-mode) — 键盘快捷键、`!`/`@`/`#` 前缀、Vim 模式全集
- [CLI 参考](https://code.claude.com/docs/zh-CN/cli-reference) — 所有 CLI 标志与子命令
- [命令参考](https://code.claude.com/docs/zh-CN/commands) — 所有内置斜杠命令完整列表

**系列后续文章**：
- `01-context-engineering.md` — 上下文工程：CLAUDE.md 精确写法、压缩策略、token 预算管理
- `02-workflow-and-sessions.md` — 会话管理：`--resume`/`--fork`、worktree 并行工作流、检查点策略
- `03-customization-and-extensions.md` — 自定义与扩展：skill 编写、hooks 配置、自定义命令
- `04-mcp-and-tools.md` — MCP 与工具系统：接入外部服务、工具权限精细化配置
- `05-multi-agent-orchestration.md` — 多 agent 编排：subagent、后台会话、`/batch` 并行策略
- `06-automation.md` — 自动化：CI/CD 集成、`-p` 模式脚本化、hooks 自动化工作流
- `07-agent-sdk.md` — Agent SDK：编程式使用 Claude Code、结构化输出、自定义 agent 框架

