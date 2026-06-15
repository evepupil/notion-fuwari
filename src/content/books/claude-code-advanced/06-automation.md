---
title: '阶段 6 · 自动化与无人值守——让 Claude 在你不在时也干活'
draft: false
---

> 本阶段解决的核心问题：如何让 Claude Code 脱离人工盯守，在 CI/CD 流水线、定时任务、外部事件触发中可靠运行，同时保持足够的安全边界。

---

## 这篇你会学到

- `claude -p` headless 模式的管道用法、结构化输出与退出码处理
- `--bare` 裸模式与 `--allowedTools`/权限模式的搭配策略
- `/loop` 会话内轮询与 `loop.md` 自定义
- Routines 云端定时：关机也能跑、API 触发、GitHub 事件触发
- `/schedule` 创建例程、三种调度方式对比
- GitHub Actions 与 GitLab CI/CD 自动代码审查与问题分流
- Channels：Telegram/Discord/iMessage/webhook 把外部事件推进会话
- Slack 集成：从团队频道直接委派编码任务
- Sandboxing：无人值守时的安全隔离方案选型

---

## 为什么重要

交互式会话是"我提问，Claude 回答"的模式——你必须在场。一旦把 Claude 嵌入自动化流程，就进入了另一个维度：

- **CI 里的代码审查**：每个 PR 提交时自动给出安全/风格/性能评注
- **夜间批处理**：凌晨重构技术债、更新文档、扫描依赖漏洞
- **事件响应**：Sentry 告警触发 Claude 自动定位 + 开草稿 PR
- **团队协作**：Slack 里 `@Claude` 一声，Claude 去仓库里改代码

这些场景的共同特点是：Claude 在无人盯守的环境下操作真实文件和网络资源，所以权限边界和沙箱隔离同样重要——不只是效率，还有安全性。

---

## 核心概念

### 1. Headless 模式：`claude -p`

`-p`（`--print`）让 Claude Code 以非交互方式运行一次性任务，完成后退出。这是所有自动化的基础积木。

#### 基本管道用法

```powershell
# 把构建日志管道进去，输出说明写入文件
Get-Content build-error.txt | claude -p "简洁说明这个构建错误的根本原因" > output.txt

# diff 管道 + 拼写检查
git diff main | claude -p "你是拼写检查员。对 diff 中每个错别字，报告 filename:line，下一行写问题。只输出这些，不要其他内容。"
```

> **注意**：从 v2.1.128 起，管道 stdin 上限 10MB。超出请把内容写入文件，在提示中引用路径。

#### `--bare` 裸模式

裸模式跳过 hooks、skills、plugins、MCP 服务器、自动内存和 CLAUDE.md 的自动发现，启动更快，且每台机器结果一致——CI 环境的推荐选项：

```powershell
claude --bare -p "总结这个文件" --allowedTools "Read"
```

裸模式跳过 OAuth 和钥匙链。Anthropic 认证必须来自环境变量 `ANTHROPIC_API_KEY`，或通过 `--settings` 传入的 JSON。

如需在裸模式下加载特定上下文，使用以下标志：

| 要加载的内容     | 使用的标志                                          |
| ------------ | ------------------------------------------------- |
| 追加系统提示      | `--append-system-prompt` / `--append-system-prompt-file` |
| 设置文件         | `--settings <file-or-json>`                       |
| MCP 服务器      | `--mcp-config <file-or-json>`                     |
| 自定义 agents   | `--agents <json>`                                 |
| 插件           | `--plugin-dir <path>` / `--plugin-url <url>`      |

#### 结构化输出：`--output-format`

`--output-format` 控制响应格式，三种选项：

| 格式            | 用途                                       |
| -------------- | ----------------------------------------- |
| `text`（默认）   | 纯文本输出，直接打印                          |
| `json`         | 包含 `result`、`session_id`、`total_cost_usd` 等字段的结构化 JSON |
| `stream-json`  | 换行符分隔的 JSON，逐事件流式输出             |

```powershell
# 获取 JSON 输出，用 jq 提取文本结果
claude -p "总结这个项目" --output-format json | jq -r '.result'

# 提取函数名为结构化数组
claude -p "从 auth.py 提取主要函数名" `
  --output-format json `
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' `
  | jq '.structured_output'
```

`json` 输出的 `total_cost_usd` 字段方便脚本追踪每次调用成本，无需查看仪表板。

#### 流式输出

```bash
# 仅显示文本增量（跨平台 bash 写法）
claude -p "写一首诗" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

流中有几个特殊事件值得关注：

- `system/init`：流中第一个事件，报告会话元数据（模型、工具、MCP 服务器、插件）
- `system/api_retry`：API 请求因可重试错误失败时发出，字段包含 `attempt`、`retry_delay_ms`、`error` 类别

#### 权限与工具授权

`--allowedTools` 预授权工具，避免交互提示：

```powershell
# 运行测试套件并修复失败，允许 Bash/Read/Edit
claude -p "运行测试套件并修复所有失败" --allowedTools "Bash,Read,Edit"

# 细粒度前缀匹配：只允许特定 git 子命令
claude -p "查看暂存变更并创建 commit" `
  --allowedTools "Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git commit *)"
```

注意 `Bash(git diff *)` 中空格+`*` 启用前缀匹配。没有空格的 `Bash(git diff*)` 也会匹配 `git diff-index`。

权限模式（`--permission-mode`）提供更粗粒度的控制：

- `dontAsk`：仅允许 `permissions.allow` 规则或只读命令集中的操作，适合锁定的 CI 运行
- `acceptEdits`：允许 Claude 写入文件、自动批准 `mkdir`/`touch`/`mv`/`cp`，其他命令和网络请求仍需授权

```powershell
claude -p "应用 lint 修复" --permission-mode acceptEdits
```

#### 继续多轮对话

```powershell
# 第一轮
claude -p "审查这个代码库的性能问题"

# 继续最近的对话
claude -p "现在聚焦数据库查询" --continue

# 用 session_id 指定特定会话继续
$session_id = (claude -p "开始审查" --output-format json | ConvertFrom-Json).session_id
claude -p "继续那个审查" --resume $session_id
```

#### 自定义系统提示

```powershell
# PR diff 管道进去，附加安全审查角色
$pr_number = "123"
gh pr diff $pr_number | claude -p `
  --append-system-prompt "你是安全工程师。审查安全漏洞。" `
  --output-format json
```

#### 退出码

`claude -p` 返回标准 POSIX 退出码：成功为 `0`，失败为非零。在脚本中：

```powershell
claude -p "检查代码安全性" --allowedTools "Read,Bash"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Claude 执行失败，退出码: $LASTEXITCODE"
    exit 1
}
```

> **说明**：技能（skills）和内置命令（如 `/code-review`）仅在交互模式下可用。在 `-p` 模式下，用自然语言描述任务，或通过 `--plugins` 加载插件后在 `prompt` 中调用技能名。

---

### 2. `/loop` 会话内轮询

`/loop` 是会话内按间隔重复运行提示的最快方式。需求 Claude Code v2.1.72+。

#### 三种使用模式

| 输入形式               | 示例                               | 行为                                   |
| ------------------- | --------------------------------- | ------------------------------------- |
| 间隔 + 提示词           | `/loop 5m 检查部署是否完成`              | 固定 cron 计划运行                         |
| 仅提示词               | `/loop 检查 CI 并处理审查评论`            | Claude 动态选择间隔（1分钟到1小时）              |
| 仅间隔或裸 `/loop`      | `/loop` 或 `/loop 15m`            | 运行内置维护提示词或 `loop.md`                |

```
# 每 5 分钟检查部署状态
/loop 5m check if the deployment finished and tell me what happened

# 动态间隔：CI 活跃时频率高，安静时降低
/loop check whether CI passed and address any review comments

# 一次性提醒（非 /loop，直接对话）
remind me at 3pm to push the release branch
in 45 minutes, check whether the integration tests passed
```

间隔单位：`s`（秒）、`m`（分钟）、`h`（小时）、`d`（天）。秒会向上取整到分钟（cron 精度为一分钟）。

按 `Esc` 停止等待中的循环；`/loop` 创建的任务被取消。通过 `CronList`/`CronDelete` 管理的任务不受 `Esc` 影响。

**重要限制**：
- 任务只在 Claude Code 运行且空闲时触发
- 关闭终端就停止
- 重复任务 7 天后自动过期（最后触发一次后删除）
- 用 `--resume` 恢复会话可恢复未过期的任务

#### 自定义默认提示词：`loop.md`

`loop.md` 文件替换内置维护提示词，仅对裸 `/loop` 生效：

| 路径                   | 作用域                   |
| -------------------- | ---------------------- |
| `.claude/loop.md`    | 项目级，优先级更高              |
| `~/.claude/loop.md`  | 用户级，适用于未定义自己 loop.md 的项目 |

```markdown
<!-- .claude/loop.md 示例 -->
检查 `release/next` PR。如果 CI 为红，拉取失败日志、
诊断问题并推送最小修复。如果有新的审查评论，
逐一处理并解决线程。如果一切正常且安静，一行说明即可。
```

对 `loop.md` 的修改在下一次迭代时生效。文件上限 25,000 字节。

---

### 3. Routines 云端例程

Routines 是保存在 Anthropic 云端的 Claude Code 配置，在 Anthropic 管理的基础设施上执行——**你的机器关机也能跑**。需要启用 Claude Code on the web 的 Pro/Max/Team/Enterprise 计划。

> **状态**：Routines 处于研究预览阶段，接口可能变化。

#### 三种触发器类型

| 触发器类型    | 使用场景                                    |
| ---------- | ------------------------------------------ |
| Scheduled  | 每小时/每天/工作日等定期运行，或指定时间一次性运行 |
| API        | 向专属 HTTP 端点 POST，可携带上下文文本       |
| GitHub     | 仓库事件（PR、Release 等）自动触发             |

单个例程可以组合多种触发器，例如 PR 审查例程同时支持每晚定时运行 + API 触发 + 新 PR 事件。

#### 用 `/schedule` 创建例程（CLI 方式）

```
# 对话式创建
/schedule

# 直接描述定期例程
/schedule daily PR review at 9am

# 一次性例程
/schedule clean up feature flag in one week
/schedule tomorrow at 9am, summarize yesterday's merged PRs
/schedule in 2 weeks, open a cleanup PR that removes the feature flag
```

`/schedule` 仅在 claude.ai 订阅登录下可用（不支持 Console API Key 或 Bedrock/Vertex 认证）。

管理命令：
```
/schedule list       # 查看所有例程
/schedule update     # 修改现有例程
/schedule run        # 立即触发
```

如需添加 API 或 GitHub 触发器，或进行细粒度配置，在 `claude.ai/code/routines` 的 Web 界面操作。

#### API 触发器调用示例

```bash
# 从 CI/告警系统触发例程（bash 写法，PowerShell 用 Invoke-RestMethod）
curl -X POST https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGHJKLMNOPQRSTUVW/fire \
  -H "Authorization: Bearer sk-ant-oat01-xxxxx" \
  -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"text": "Sentry alert SEN-4521 fired in prod. Stack trace attached."}'
```

成功返回包含 `claude_code_session_id` 和 `claude_code_session_url` 的 JSON，可直接在浏览器打开观察运行。

#### GitHub 触发器配置

GitHub 触发器在 Web UI 配置（CLI 暂不支持）：

1. 安装 Claude GitHub App 到目标仓库
2. 在例程编辑页面 → Select a trigger → GitHub event
3. 选择仓库、事件（Pull request / Release）和可选过滤器

可用过滤字段：Author、Title、Body、Base branch、Head branch、Labels、Is draft、Is merged。多个过滤条件需同时满足。

#### 三种调度方式对比

| 维度               | Cloud Routines      | Desktop 计划任务     | `/loop`                    |
| ---------------- | ------------------- | ------------------ | -------------------------- |
| 运行位置            | Anthropic 云         | 你的机器               | 你的机器                       |
| 关机后是否运行         | 是                   | 否                   | 否                           |
| 需要打开会话          | 否                   | 否                   | 是                           |
| 访问本地文件          | 否（从 GitHub 克隆）     | 是                   | 是                           |
| 最小间隔            | 1 小时               | 1 分钟               | 1 分钟                        |
| 创建方式            | `/schedule` 或 Web UI | Desktop 应用         | `/loop` 命令                  |

---

### 4. GitHub Actions 自动化

Claude Code Action v1 把 Claude 嵌入 GitHub 工作流，支持 `@claude` 触发和定时自动运行。

#### 快速上手

在 Claude Code 会话中运行 `/install-github-app`，按引导完成 GitHub App 安装和密钥配置（需要仓库管理员权限）。

手动配置步骤：
1. 安装 [Claude GitHub App](https://github.com/apps/claude)（需要 Contents/Issues/Pull requests 读写权限）
2. 将 `ANTHROPIC_API_KEY` 添加到仓库 Secrets
3. 复制工作流文件到 `.github/workflows/`

#### 基本工作流（响应 `@claude` 提及）

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          # 自动响应评论中的 @claude 提及
```

#### 定时自动代码审查（无需手动触发）

```yaml
name: Daily Report
on:
  schedule:
    - cron: "0 9 * * *"    # 每天 9am UTC
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "Generate a summary of yesterday's commits and open issues"
          claude_args: "--model claude-opus-4-8"
```

#### 使用 Skill 的 PR 自动审查

```yaml
name: Code Review
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          plugin_marketplaces: "https://github.com/anthropics/claude-code.git"
          plugins: "code-review@claude-code-plugins"
          prompt: "/code-review:code-review ${{ github.repository }}/pull/${{ github.event.pull_request.number }}"
```

#### Action 关键参数

| 参数                    | 说明                                              |
| --------------------- | ------------------------------------------------ |
| `prompt`              | 指令文本，或技能名（如 `/code-review:code-review ...`） |
| `claude_args`         | 传给 Claude Code CLI 的任意参数                      |
| `plugin_marketplaces` | 插件市场 Git URL，换行分隔                             |
| `plugins`             | 要安装的插件名，换行分隔                               |
| `anthropic_api_key`   | Claude API 密钥（直连时必须）                         |
| `trigger_phrase`      | 触发短语，默认 `@claude`                             |
| `use_bedrock`         | 使用 Amazon Bedrock                               |
| `use_vertex`          | 使用 Google Vertex AI                             |

`claude_args` 支持所有 Claude Code CLI 参数：
```yaml
claude_args: "--max-turns 5 --model claude-sonnet-4-6 --mcp-config /path/to/config.json"
```

在评论中使用示例：
```
@claude implement this feature based on the issue description
@claude fix the TypeError in the user dashboard component
@claude review this PR for security vulnerabilities
```

---

### 5. GitLab CI/CD 集成

GitLab 集成由 GitLab 维护，目前处于 Beta 阶段。

#### 最小配置（Claude API）

```yaml
stages:
  - ai

claude:
  stage: ai
  image: node:24-alpine3.21
  rules:
    - if: '$CI_PIPELINE_SOURCE == "web"'
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  variables:
    GIT_STRATEGY: fetch
  before_script:
    - apk add --no-cache git curl bash
    - curl -fsSL https://claude.ai/install.sh | bash
  script:
    - /bin/gitlab-mcp-server || true
    - >
      claude
      -p "${AI_FLOW_INPUT:-'Review this MR and implement the requested changes'}"
      --permission-mode acceptEdits
      --allowedTools "Bash Read Edit Write mcp__gitlab"
  # 在 Settings → CI/CD → Variables 中配置 ANTHROPIC_API_KEY（掩码）
```

`AI_FLOW_INPUT` 和 `AI_FLOW_CONTEXT` 是 GitLab 通过 webhook 或 API 触发时传入的上下文变量，支持将评论内容、事件信息传给 Claude。

典型使用场景：
```
@claude implement this feature based on the issue description
@claude fix the TypeError in the user dashboard component
@claude suggest a concrete approach to cache the results of this API call
```

企业环境可以切换为 Amazon Bedrock（OIDC 认证）或 Google Vertex AI（Workload Identity Federation），无需存储长期密钥。

---

### 6. Channels：把外部事件推进会话

Channels 是把来自第三方平台的消息/事件推送到你运行中的 Claude Code 会话的机制，目前处于研究预览阶段，需要 v2.1.80+。

**关键特性**：
- 双向通信：Claude 读取事件后通过同一 channel 回复
- 事件仅在会话打开时到达（本地会话）
- 每个 channel 维护发送者允许列表（只有授权 ID 能推消息）

#### 支持的 Channel 类型

当前研究预览包含：Telegram、Discord、iMessage（macOS 专属）。

**所有插件均需 [Bun](https://bun.sh) 运行时。**

#### Telegram 配置

```
# 1. 在 Telegram 找到 @BotFather，/newbot 创建机器人，复制 token

# 2. 安装插件
/plugin install telegram@claude-plugins-official

# 3. 配置 token
/telegram:configure <your-bot-token>

# 4. 重启并启用
claude --channels plugin:telegram@claude-plugins-official

# 5. 向机器人发任意消息获取配对码，然后：
/telegram:access pair <code>
/telegram:access policy allowlist
```

#### Discord 配置

```
# 1. Discord 开发者门户创建应用 → 机器人 → 复制 token
# 2. 启用"消息内容意图"
# 3. OAuth2 URL 生成器授予权限（查看频道/发消息/读历史等），邀请机器人到服务器

/plugin install discord@claude-plugins-official
/discord:configure <bot-token>
claude --channels plugin:discord@claude-plugins-official

# 向机器人发私信获取配对码
/discord:access pair <code>
/discord:access policy allowlist
```

#### iMessage 配置（macOS）

```
# 安装插件
/plugin install imessage@claude-plugins-official

# 启用（首次运行需在系统设置授予完全磁盘访问权限）
claude --channels plugin:imessage@claude-plugins-official

# 给自己发短信自动绕过门控
# 允许其他联系人（电话号码或 Apple ID）：
/imessage:access allow +15551234567
```

#### Webhook 接收器

除官方插件外，可自行构建 channel 将 CI 结果、错误跟踪器告警等 webhook 推进会话。详见 [Channels 参考文档](https://code.claude.com/docs/zh-CN/channels-reference)。

在 `-p` 非交互模式运行 channels 时，需要终端输入的工具（多选问题、Plan Mode 批准）被自动禁用，避免会话因等待输入而停滞。

---

### 7. Slack 集成

Slack 中的 Claude Code 通过现有 Claude for Slack 应用扩展，在检测到编码请求时自动路由到 Web 上的 Claude Code 会话。

**前置条件**：
- Pro/Max/Team/Enterprise 计划（含 Claude Code 访问权限）
- 启用 Claude Code on the web
- 至少一个 GitHub 仓库连接到 Claude Code
- Slack 账户通过 Claude 应用与 Claude 账户关联

#### 设置步骤

1. 工作区管理员从 [Slack 应用市场](https://slack.com/marketplace/A08SF47R6P4)安装 Claude 应用
2. 用户在 Claude 应用主页 → Connect，关联个人 Claude 账户
3. 在 `claude.ai/code` 连接 GitHub 账户并授权仓库
4. 选择路由模式：
   - **仅代码**：所有 `@Claude` 提及路由到 Claude Code 会话
   - **代码 + 聊天**：Claude 智能判断，编码任务路由到 Claude Code，其他到聊天
5. 在目标频道输入 `/invite @Claude`

> **注意**：Claude Code for Slack 仅在频道中工作，不支持直接消息（DM）。

完成后工作流：`@Claude` 提及 → Claude 检测编码意图 → 在 `claude.ai/code` 创建会话 → Slack 线程中发布进度更新 → 完成后 @mention 你并附 View Session/Create PR 按钮。

---

### 8. Sandboxing：无人值守时的安全隔离

无人值守运行意味着 Claude 不需要你逐条批准操作。这时隔离边界就是最后一道防线。

#### 内置 Bash 沙箱（`/sandbox`）

```
/sandbox
```

打开沙箱面板，选择模式：

- **自动允许模式**：沙箱化的 Bash 命令自动运行，不提示；无法沙箱化的回退到常规权限流程
- **常规权限模式**：沙箱化命令也要走权限提示，控制更严

默认边界：只能写入当前工作目录；读取整个文件系统（注意：默认仍可读取 `~/.aws/credentials`、`~/.ssh/`，需手动 `denyRead` 屏蔽）；网络访问首次需要新域名时提示。

**Windows 注意**：原生 Windows 不支持沙箱，需在 WSL2 内运行。Linux/WSL2 需安装 bubblewrap 和 socat：

```powershell
# 在 WSL2 中执行
wsl -- sudo apt-get install bubblewrap socat
```

#### 配置示例

```json
// .claude/settings.json
{
  "sandbox": {
    "enabled": true,
    "filesystem": {
      "allowWrite": ["~/.kube", "/tmp/build"],
      "denyRead": ["~/.aws", "~/.ssh"]
    }
  }
}
```

路径前缀规则：`/` 为绝对路径，`~/` 相对主目录，`./` 或无前缀相对项目根。

#### 沙箱方案选型

不同场景适合不同的隔离方式：

| 场景                                  | 推荐方案                              |
| ----------------------------------- | ---------------------------------- |
| 日常工作减少权限提示                         | 内置 `/sandbox`（Bash 沙箱）            |
| 无人值守运行（`--dangerously-skip-permissions` 或 auto mode） | Dev container / 容器 / VM / sandbox runtime |
| 隔离 MCP 服务器和 hooks，无需 Docker        | `@anthropic-ai/sandbox-runtime`    |
| 不受信任代码库                             | 专用 VM 或 Claude Code on the web    |
| 团队统一沙箱环境                            | 预配置 dev container                  |

**`sandbox-runtime`** 把整个 Claude Code 进程包在沙箱边界内（文件工具、hooks、MCP 服务器全部隔离）：

```bash
npx @anthropic-ai/sandbox-runtime claude
```

需要在 `~/.srt-settings.json` 预配置允许的写入路径和网络域，至少包含 `~/.claude`、`~/.claude.json` 以及 `api.anthropic.com`。

#### 权限模式 vs 沙箱的关系

两者互补，控制不同维度：

| 机制                               | 控制什么                | 替换提示的方式                 |
| -------------------------------- | ------------------- | ------------------------ |
| `/sandbox`                       | Bash 命令运行后能访问什么     | 沙箱边界（auto-allow 模式下）    |
| auto mode                        | 每个工具调用是否运行          | 行为分类器                    |
| `--dangerously-skip-permissions` | 每个工具调用是否运行          | 无（最危险）                   |

`--dangerously-skip-permissions` 完全删除按操作审查，**必须**在容器、VM 或 sandbox-runtime 内使用。

---

## 实操示例

### 示例 A：每次 push 自动检查拼写错误（PowerShell 脚本）

```powershell
# run-claude-lint.ps1
param([string]$BaseBranch = "main")

$diff = git diff $BaseBranch
if (-not $diff) {
    Write-Host "无 diff，跳过检查"
    exit 0
}

$result = $diff | claude --bare -p `
  "你是拼写检查员。对 diff 中每个拼写错误，格式：filename:line / 问题描述。没有错误则输出 OK。" `
  --output-format json

$parsed = $result | ConvertFrom-Json
Write-Host $parsed.result

if ($parsed.result -ne "OK") {
    exit 1
}
```

### 示例 B：GitHub Actions——每个 PR 自动安全审查

```yaml
# .github/workflows/security-review.yml
name: Security Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "审查这个 PR 的安全漏洞（SQL 注入、XSS、不安全反序列化、硬编码凭证等）。每个问题给出严重性和修复建议。"
          claude_args: "--max-turns 5 --append-system-prompt '你是安全工程师，只报告安全问题，不讨论代码风格。'"
```

### 示例 C：GitLab CI——定时夜间技术债扫描

```yaml
# .gitlab-ci.yml 片段
tech-debt-scan:
  stage: ai
  image: node:24-alpine3.21
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'  # 仅定时触发
  before_script:
    - apk add --no-cache git curl bash
    - curl -fsSL https://claude.ai/install.sh | bash
  script:
    - >
      claude
      -p "扫描仓库中的技术债：重复代码、过时依赖、TODO 注释超过 6 个月的。生成 Markdown 报告，按优先级排序。"
      --bare
      --permission-mode dontAsk
      --allowedTools "Read,Bash(find *),Bash(git log *)"
      --output-format json > /tmp/tech-debt.json
    - cat /tmp/tech-debt.json | python3 -c "import json,sys; print(json.load(sys.stdin)['result'])" > tech-debt-report.md
  artifacts:
    paths:
      - tech-debt-report.md
    expire_in: 1 week
```

### 示例 D：Routines——告警自动分诊（API 触发）

在 `claude.ai/code/routines` 创建例程：

**提示词**：
```
你是值班工程师助理。你会收到一个 Sentry 或 PagerDuty 告警正文（通过 text 字段传入）。
1. 提取堆栈跟踪，定位到具体文件和行号
2. 在仓库中找到对应代码，分析根本原因
3. 开一个草稿 PR，包含建议修复和 "closes #<告警ID>" 说明
4. 在 PR 描述中写：根本原因、影响范围、修复方案、测试建议
```

**触发器**：API + 每晚定时汇总

告警系统调用（PowerShell 写法）：
```powershell
$body = @{
    text = "Sentry alert: NullPointerException in UserService.java:142. Stack: ..."
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.anthropic.com/v1/claude_code/routines/trig_01XXXXX/fire" `
  -Headers @{
    "Authorization" = "Bearer $env:ROUTINE_TOKEN"
    "anthropic-beta" = "experimental-cc-routine-2026-04-01"
    "anthropic-version" = "2023-06-01"
    "Content-Type" = "application/json"
  } `
  -Body $body
```

---

## 动手练习

**练习 1（基础）**：用 `claude -p` 把当前目录的 `README.md` 管道进去，要求 Claude 以 JSON 格式提取所有代码块的语言标记，用 `--output-format json --json-schema` 参数，验证 `structured_output` 字段的内容。

**练习 2（进阶）**：在一个有 PR 活动的项目里启动 `/loop`，不指定间隔，让 Claude 动态决定轮询频率，观察它如何根据 CI 状态调整等待时间。运行 5 分钟后按 `Esc` 停止。

**练习 3（CI 集成）**：在你的 GitHub 仓库配置 `claude-code-action@v1`，触发器为 `pull_request_review_comment`，`prompt` 为空（自动响应 `@claude` 提及）。在一个 PR 评论里写 `@claude 这段代码有什么改进空间？` 验证 Claude 是否回复。

**练习 4（云端例程）**：用 `/schedule` 创建一个"明天早 9 点总结昨天合并的 PR"的一次性例程。通过 `claude.ai/code/routines` 确认它已保存，并观察例程运行后生成的会话。

**练习 5（沙箱安全）**：在 WSL2（或 macOS/Linux）中启动 Claude Code，运行 `/sandbox` 开启自动允许模式，在 `.claude/settings.json` 中配置 `denyRead: ["~/.ssh", "~/.aws"]`，验证 `cat ~/.ssh/id_rsa` 在沙箱内被拒绝，但 `cat /books/claude-code-advanced/` 正常读取。

---

## 常见坑与注意事项

### PowerShell 管道中的编码问题

PowerShell 默认 UTF-16LE 可能导致非 ASCII 字符乱码。建议：

```powershell
# 强制 UTF-8 输出
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONUTF8 = "1"

Get-Content file.txt | claude -p "分析这个文件"
```

### `--bare` 与本地配置的取舍

`--bare` 跳过所有本地配置（包括 MCP 服务器），适合 CI 保证一致性。但如果你的 CI 需要特定 MCP 服务器（如 CodeGraph），记得用 `--mcp-config` 显式传入：

```powershell
claude --bare -p "分析代码结构" --mcp-config '{"mcpServers":{"codegraph":{"command":"npx","args":["codegraph-mcp"]}}}'
```

### 退出码与 CI 集成

`claude -p` 失败时返回非零退出码，但"Claude 认为任务失败"和"claude 进程本身崩溃"的退出码含义不同。建议配合 `--output-format json` 解析 `result` 字段判断任务语义层面的成败，而不是只靠退出码。

### GitHub Actions 中的 API 成本控制

- 用 `claude_args: "--max-turns 5"` 防止过度迭代
- 设置工作流级 `timeout-minutes` 防止失控作业
- 使用 GitHub 并发控制限制并行运行数

```yaml
concurrency:
  group: claude-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

### Routines 的安全边界

Routines 完全自主运行，无权限提示：
- 只包含例程实际需要的 connectors（删除不必要的，避免意外写入）
- 默认只能推送 `claude/` 前缀的分支，需要推送 main/master 时才启用 "Allow unrestricted branch pushes"
- 运行列表中的绿色状态只代表会话正常退出，不代表任务成功——需要打开会话查看实际输出

### Channels 安全性

发送者允许列表是关键安全边界：
- 配对后立即执行 `policy allowlist`，防止任何陌生人向 Claude 发指令
- 能通过 channel 回复的人可以批准/拒绝你会话中的工具调用——只列入你信任的发送者
- Team/Enterprise 需要管理员在 `claude.ai/admin-settings/claude-code` 启用 `channelsEnabled`

### 沙箱的局限性

沙箱降低风险，但不是完整隔离边界：

1. **网络过滤**：内置代理不终止 TLS，基于主机名决策。恶意代码可能利用 domain fronting 绕过。高安全场景需要配置 TLS 终止的自定义代理
2. **默认读取范围过宽**：`~/.aws/credentials`、`~/.ssh/` 默认可读，记得加 `denyRead`
3. **仅限 Bash 工具**：Read、Edit、WebFetch 工具不经过 Bash 沙箱，由权限系统控制；MCP 服务器和 hooks 是独立进程，也不在 Bash 沙箱内
4. **环境变量继承**：沙箱化的 Bash 命令默认继承父进程环境（包括凭证）。可设置 `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` 从子进程移除凭证
5. **`--dangerously-skip-permissions`** 在 Linux/macOS 以 root 身份运行时被阻止，容器内以非 root 用户运行 Claude Code 是推荐做法

---

## 掌握标志（自测清单）

- [ ] 能用 `claude -p` 把构建日志管道进 Claude，提取结构化 JSON 错误摘要
- [ ] 知道 `--bare` 模式的适用场景，能正确区分它与普通 `-p` 的区别
- [ ] 能用 `--allowedTools` 细粒度授权特定 Bash 子命令（前缀匹配语法）
- [ ] 能用 `/loop` 设置固定间隔轮询，能解释 7 天过期的含义
- [ ] 写过 `loop.md` 自定义默认维护提示词
- [ ] 能用 `/schedule` 创建定时例程，理解 Cloud Routines 与 `/loop` 的核心区别（关机是否继续运行）
- [ ] 配置过 GitHub Actions `claude-code-action@v1`，能通过 `@claude` 触发 PR 审查
- [ ] 了解 GitLab CI/CD 集成方式，能写出最小可用的 `.gitlab-ci.yml` 片段
- [ ] 成功配置过至少一个 Channel（Telegram/Discord/iMessage），完成配对和允许列表设置
- [ ] 能解释 Bash 沙箱、sandbox-runtime、dev container 三者的隔离范围差异，并知道哪种情况选哪种

---

## 延伸阅读

**官方文档**：

- [Headless 模式 / 以编程方式运行](https://code.claude.com/docs/zh-CN/headless)
- [Scheduled Tasks（/loop 与会话内调度）](https://code.claude.com/docs/zh-CN/scheduled-tasks)
- [Routines（云端例程）](https://code.claude.com/docs/zh-CN/routines)
- [GitHub Actions](https://code.claude.com/docs/zh-CN/github-actions)
- [GitLab CI/CD](https://code.claude.com/docs/zh-CN/gitlab-ci-cd)
- [Channels（外部事件推送）](https://code.claude.com/docs/zh-CN/channels)
- [Slack 集成](https://code.claude.com/docs/zh-CN/slack)
- [Sandboxing（Bash 沙箱配置）](https://code.claude.com/docs/zh-CN/sandboxing)
- [Sandbox Environments（隔离方案选型）](https://code.claude.com/docs/zh-CN/sandbox-environments)
- [CLI 参考](https://code.claude.com/docs/zh-CN/cli-reference)
- [Agent SDK 文档](https://code.claude.com/docs/zh-CN/agent-sdk/overview)

**系列其他章节**：

- 上一篇：[05-multi-agent-orchestration.md](/books/claude-code-advanced/05-multi-agent-orchestration/)——多智能体编排与子代理
- 下一篇：[07-agent-sdk.md](/books/claude-code-advanced/07-agent-sdk/)——用 Python/TypeScript Agent SDK 构建自定义自动化
- 工具与扩展基础：[04-mcp-and-tools.md](/books/claude-code-advanced/04-mcp-and-tools/)
- 自定义与配置：[03-customization-and-extensions.md](/books/claude-code-advanced/03-customization-and-extensions/)

