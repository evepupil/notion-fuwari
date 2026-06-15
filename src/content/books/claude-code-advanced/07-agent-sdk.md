---
title: '阶段 7 · Agent SDK——用 Claude Code 引擎构建你自己的代理'
draft: false
---

> 把 Claude Code 的工具执行引擎嵌进你的应用，以编程方式驱动完整的代理循环

---

## 这篇你会学到

- Agent SDK 是什么、它和 CLI / Anthropic Client SDK / Managed Agents 的区别
- 何时该走 SDK 而非继续用 CLI
- Python 与 TypeScript 两个 SDK 的安装、核心 API 和最小可运行示例
- Agent Loop 在 SDK 中如何运作：消息类型、轮次机制、上下文压缩
- 自定义工具：用进程内 MCP 服务器为 Claude 提供你自己的函数
- 结构化输出：用 Pydantic / Zod 获得类型安全的 JSON 结果
- 实时流式输出：StreamEvent、逐 token 响应、工具调用进度展示
- 系统提示词与权限控制
- 生产托管：容器配置、会话持久化、OpenTelemetry 可观测性、多租户隔离

---

## 为什么/何时需要 SDK

### Agent SDK 是什么

Agent SDK 是一个独立的库包（Python `claude-agent-sdk`，TypeScript `@anthropic-ai/claude-agent-sdk`），它把 Claude Code CLI 封装成可编程的子进程，并在你的代码中暴露出一个异步迭代器接口。调用 `query()` 后，SDK 在后台启动 `claude` 进程、通过 stdio 与其通信，把工具执行、上下文管理、重试全部包办，你只需消费消息流。

**关键点**：TypeScript SDK 会为你的平台捆绑一个 Claude Code 二进制作为可选依赖，**无需单独安装 CLI**。Python SDK 也不依赖系统已有的 CLI。

### 三个选择的边界

| | Agent SDK | Anthropic Client SDK | Managed Agents |
|---|---|---|---|
| **工具执行** | SDK 自动执行 | 你自己实现 tool loop | Anthropic 托管沙箱执行 |
| **运行位置** | 你的进程/基础设施 | 你的进程 | Anthropic 管理的基础设施 |
| **接口** | Python / TS 库 | Python / TS 库 | REST API |
| **适合场景** | 产品化代理、CI/CD、本地文件操作 | 单轮或自定义 tool loop | 生产级异步会话、无需自维护沙箱 |

### CLI 够用的场景继续用 CLI

| 场景 | 最佳选择 |
|---|---|
| 交互式编码/探索 | CLI |
| 一次性脚本任务 | CLI 或 `claude -p` |
| CI/CD 流水线 | SDK |
| 自定义应用程序 | SDK |
| 生产自动化、多租户服务 | SDK（或 Managed Agents）|

---

## 核心概念

### 安装

**TypeScript（PowerShell/Windows）**：
```powershell
npm install @anthropic-ai/claude-agent-sdk
```

**Python（Windows PowerShell，需要 Python 3.10+）**：
```powershell
# 检查版本
py --version

# 创建虚拟环境
py -m venv .venv
.venv\Scripts\Activate.ps1
# 如果 PowerShell 报执行策略错误，先运行：
# Set-ExecutionPolicy -Scope Process RemoteSigned

pip install claude-agent-sdk
```

**API 密钥**（放入 `.env` 或 PowerShell 会话环境变量）：
```powershell
$env:ANTHROPIC_API_KEY = "your-api-key"
```

SDK 也支持 Bedrock（`CLAUDE_CODE_USE_BEDROCK=1`）、Vertex AI（`CLAUDE_CODE_USE_VERTEX=1`）、Azure（`CLAUDE_CODE_USE_FOUNDRY=1`）。

---

### Agent Loop：循环是如何运转的

每次调用 `query()` 都会启动一个代理循环，流程如下：

```
你的代码 → query() → 子进程 claude CLI
                         ↓
              Claude 接收 prompt + 工具定义
                         ↓
                  评估 → 决策
                    ↙         ↘
              文本响应        工具调用
                              ↓
                         SDK 执行工具
                              ↓
                       结果反馈给 Claude
                              ↓
                    重复，直到无工具调用
                         ↓
                    返回 ResultMessage
```

**轮次（Turn）**：每次 Claude 发出工具调用、SDK 执行后返回结果，算一个轮次。最后一次无工具调用的纯文本响应结束循环。

**控制参数**：
- `max_turns` / `maxTurns`：最大工具使用轮次（默认无限制，生产必须设置）
- `max_budget_usd` / `maxBudgetUsd`：成本上限，超过则停止
- `effort`：推理深度，`"low"` / `"medium"` / `"high"` / `"xhigh"` / `"max"`

### 消息类型速查

| 类型 | 触发时机 | 关键字段 |
|---|---|---|
| `SystemMessage`（`subtype: "init"`） | 会话初始化 | `session_id`（嵌套在 `.data` 中） |
| `AssistantMessage` | 每次 Claude 响应 | `.content`（TextBlock、ToolUseBlock） |
| `UserMessage` | 每次工具执行完成 | `.content`（工具结果） |
| `StreamEvent` | 启用部分消息时 | `.event`（原始 API 流事件） |
| `ResultMessage` | 循环结束 | `.subtype`、`.result`、`.total_cost_usd`、`.session_id` |

**Python 检查类型**：`isinstance(msg, ResultMessage)`
**TypeScript 检查类型**：`msg.type === "result"`

`ResultMessage.subtype` 的值：

| subtype | 含义 |
|---|---|
| `success` | 正常完成，`.result` 字段有效 |
| `error_max_turns` | 达到轮次上限 |
| `error_max_budget_usd` | 达到预算上限 |
| `error_during_execution` | API 失败或请求被取消 |
| `error_max_structured_output_retries` | 结构化输出重试耗尽 |

### 上下文窗口与自动压缩

上下文跨轮次累积（提示 + 工具定义 + 对话历史 + 工具输入输出），接近上限时 SDK 自动压缩：用摘要替换旧消息，触发 `compact_boundary` 系统消息。

持久指令放进 `CLAUDE.md`，压缩器每次请求都会重新注入它，而不是丢失在摘要里。可以在 `CLAUDE.md` 里写明摘要保留策略：

```markdown
# Summary instructions
When summarizing this conversation, always preserve:
- The current task objective and acceptance criteria
- File paths that have been read or modified
- Test results and error messages
```

---

### 权限与工具控制

```
disallowedTools（裸名）→ 从 Claude 上下文中移除该工具
disallowedTools（作用域规则）→ 工具可见，但阻止匹配的调用
allowedTools → 预批准，调用时不弹权限确认
permissionMode → 处理所有不在上面两条规则内的工具
```

**permissionMode 对照**：

| 模式 | 行为 | 推荐场景 |
|---|---|---|
| `"default"` | 触发 `canUseTool` 回调；没有回调就拒绝 | 交互式 UI |
| `"acceptEdits"` | 自动批准文件编辑及常见文件系统命令 | 开发机器上的自主代理 |
| `"plan"` | 只读工具运行，不修改文件 | 预览/规划阶段 |
| `"dontAsk"` | 只有 `allowedTools` 中的工具运行，其余拒绝 | 锁定的无头代理 |
| `"auto"`（仅 TS） | 模型分类器决定每次调用 | 安全防护自主代理 |
| `"bypassPermissions"` | 所有工具运行，不提示 | 隔离的 CI 沙箱 |

---

### 系统提示词定制

```python
# Python：纯字符串
options = ClaudeAgentOptions(
    system_prompt="你是一名资深 Python 工程师，严格遵守 PEP 8。"
)

# Python：在 Claude Code 预设基础上追加
options = ClaudeAgentOptions(
    system_prompt={"type": "preset", "preset": "claude_code", "append": "额外约束..."}
)
```

```typescript
// TypeScript
options: {
  systemPrompt: "你是一名资深 TypeScript 工程师，所有函数必须有类型注解。"
}
// 或追加到 Claude Code 预设
options: {
  systemPrompt: { type: "preset", preset: "claude_code", append: "额外约束..." }
}
```

---

## 实操示例

### 示例一：最小可运行 Query（Python + TypeScript）

**Python**（`agent_basic.py`）：

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage


async def main():
    async for message in query(
        prompt="列出当前目录下所有 .py 文件，并统计总行数。",
        options=ClaudeAgentOptions(
            allowed_tools=["Bash", "Glob"],
            permission_mode="acceptEdits",
            max_turns=10,
            max_budget_usd=0.50,
        ),
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text, end="")
                elif hasattr(block, "name"):
                    print(f"\n[调用工具: {block.name}]")
        elif isinstance(message, ResultMessage):
            if message.subtype == "success":
                print(f"\n\n完成。花费：${message.total_cost_usd:.4f}")
            else:
                print(f"\n停止原因：{message.subtype}")


asyncio.run(main())
```

运行：
```powershell
python agent_basic.py
```

**TypeScript**（`agent_basic.ts`）：

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "列出当前目录下所有 .ts 文件，并统计总行数。",
  options: {
    allowedTools: ["Bash", "Glob"],
    permissionMode: "acceptEdits",
    maxTurns: 10,
    maxBudgetUsd: 0.50,
  },
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if ("text" in block) process.stdout.write(block.text);
      else if ("name" in block) console.log(`\n[调用工具: ${block.name}]`);
    }
  } else if (message.type === "result") {
    if (message.subtype === "success") {
      console.log(`\n\n完成。花费：$${message.total_cost_usd.toFixed(4)}`);
    } else {
      console.log(`\n停止原因：${message.subtype}`);
    }
  }
}
```

运行：
```powershell
npx tsx agent_basic.ts
```

---

### 示例二：自定义工具（进程内 MCP 服务器）

自定义工具通过 SDK 内置的进程内 MCP 服务器注册，工具名格式为 `mcp__{服务器名}__{工具名}`。

**Python**（`agent_custom_tools.py`）：

```python
import asyncio
import json
from typing import Any
import httpx
from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    ResultMessage,
    tool,
    create_sdk_mcp_server,
    ToolAnnotations,
)


# 1. 用 @tool 装饰器定义工具
@tool(
    "get_weather",
    "获取指定经纬度的当前气温（摄氏度）",
    {"latitude": float, "longitude": float},
    annotations=ToolAnnotations(readOnlyHint=True),  # 只读，可并行调用
)
async def get_weather(args: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": args["latitude"],
                "longitude": args["longitude"],
                "current": "temperature_2m",
                "temperature_unit": "celsius",
            },
        )
    data = resp.json()
    temp = data["current"]["temperature_2m"]
    return {"content": [{"type": "text", "text": f"当前气温：{temp}°C"}]}


@tool(
    "calculate",
    "执行基础四则运算",
    {
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "数学表达式，如 '2 + 3 * 4'"},
        },
        "required": ["expression"],
    },
)
async def calculate(args: dict[str, Any]) -> dict[str, Any]:
    try:
        # 仅允许安全的数学字符
        expr = args["expression"]
        allowed = set("0123456789+-*/()., ")
        if not all(c in allowed for c in expr):
            return {
                "content": [{"type": "text", "text": "表达式包含不允许的字符"}],
                "is_error": True,
            }
        result = eval(expr)  # noqa: S307 — 已做字符白名单过滤
        return {"content": [{"type": "text", "text": f"结果：{result}"}]}
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"计算失败：{e}"}],
            "is_error": True,
        }


# 2. 把工具注册到进程内 MCP 服务器
tools_server = create_sdk_mcp_server(
    name="mytools",
    version="1.0.0",
    tools=[get_weather, calculate],
)


async def main():
    async for message in query(
        prompt="北京（纬度 39.9，经度 116.4）现在多少度？顺便算一下 (39.9 + 116.4) * 2",
        options=ClaudeAgentOptions(
            mcp_servers={"mytools": tools_server},
            # 通配符允许所有 mytools 下的工具
            allowed_tools=["mcp__mytools__*"],
            # 不允许 Claude 使用内置 Bash 工具
            tools=[],  # 清空内置工具，仅使用自定义工具
        ),
    ):
        if isinstance(message, ResultMessage) and message.subtype == "success":
            print(message.result)


asyncio.run(main())
```

**TypeScript**（`agent_custom_tools.ts`）：

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// 1. 定义工具（Zod schema 自动推导 handler 参数类型）
const getWeather = tool(
  "get_weather",
  "获取指定经纬度的当前气温（摄氏度）",
  {
    latitude: z.number().describe("纬度"),
    longitude: z.number().describe("经度"),
  },
  async (args) => {
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current=temperature_2m&temperature_unit=celsius`
    );
    const data: any = await resp.json();
    return {
      content: [{ type: "text", text: `当前气温：${data.current.temperature_2m}°C` }],
    };
  },
  { annotations: { readOnlyHint: true } }
);

const calculate = tool(
  "calculate",
  "执行基础四则运算",
  {
    expression: z.string().describe("数学表达式，如 '2 + 3 * 4'"),
  },
  async (args) => {
    const allowed = /^[0-9+\-*/().,\s]+$/;
    if (!allowed.test(args.expression)) {
      return {
        content: [{ type: "text", text: "表达式包含不允许的字符" }],
        isError: true,
      };
    }
    try {
      const result = Function(`"use strict"; return (${args.expression})`)();
      return { content: [{ type: "text", text: `结果：${result}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `计算失败：${e}` }], isError: true };
    }
  }
);

// 2. 创建进程内 MCP 服务器
const toolsServer = createSdkMcpServer({
  name: "mytools",
  version: "1.0.0",
  tools: [getWeather, calculate],
});

// 3. 注入到 query
for await (const message of query({
  prompt: "北京（纬度 39.9，经度 116.4）现在多少度？顺便算一下 (39.9 + 116.4) * 2",
  options: {
    mcpServers: { mytools: toolsServer },
    allowedTools: ["mcp__mytools__*"],
    tools: [],  // 清空内置工具
  },
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

---

### 示例三：结构化输出

结构化输出在 `output_format` / `outputFormat` 中传入 JSON Schema，结果在 `ResultMessage.structured_output` 里。

**Python（使用 Pydantic）**：

```python
import asyncio
from pydantic import BaseModel
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage


class BugReport(BaseModel):
    file_path: str
    line_number: int
    severity: str          # "low" | "medium" | "high"
    description: str
    suggested_fix: str


class CodeReview(BaseModel):
    bugs: list[BugReport]
    overall_quality: str   # "good" | "needs_improvement" | "critical"
    summary: str


async def main():
    async for message in query(
        prompt="Review the auth.py file for bugs and security issues.",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Glob"],
            output_format={
                "type": "json_schema",
                "schema": CodeReview.model_json_schema(),
            },
        ),
    ):
        if isinstance(message, ResultMessage):
            if message.subtype == "success" and message.structured_output:
                review = CodeReview.model_validate(message.structured_output)
                print(f"整体质量：{review.overall_quality}")
                print(f"摘要：{review.summary}")
                for bug in review.bugs:
                    print(f"  [{bug.severity}] {bug.file_path}:{bug.line_number} — {bug.description}")
            elif message.subtype == "error_max_structured_output_retries":
                print("结构化输出生成失败，尝试简化 schema 或提示词。")


asyncio.run(main())
```

**TypeScript（使用 Zod）**：

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const BugReport = z.object({
  file_path: z.string(),
  line_number: z.number(),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
  suggested_fix: z.string(),
});

const CodeReview = z.object({
  bugs: z.array(BugReport),
  overall_quality: z.enum(["good", "needs_improvement", "critical"]),
  summary: z.string(),
});

type CodeReview = z.infer<typeof CodeReview>;

for await (const message of query({
  prompt: "Review the auth.ts file for bugs and security issues.",
  options: {
    allowedTools: ["Read", "Glob"],
    outputFormat: {
      type: "json_schema",
      schema: z.toJSONSchema(CodeReview),
    },
  },
})) {
  if (message.type === "result") {
    if (message.subtype === "success" && message.structured_output) {
      const parsed = CodeReview.safeParse(message.structured_output);
      if (parsed.success) {
        const review: CodeReview = parsed.data;
        console.log(`整体质量：${review.overall_quality}`);
        review.bugs.forEach((bug) =>
          console.log(`  [${bug.severity}] ${bug.file_path}:${bug.line_number} — ${bug.description}`)
        );
      }
    } else if (message.subtype === "error_max_structured_output_retries") {
      console.error("结构化输出生成失败");
    }
  }
}
```

---

### 示例四：实时流式输出

启用 `include_partial_messages` / `includePartialMessages` 后，SDK 额外产生 `StreamEvent`（Python）/ `SDKPartialAssistantMessage`（TypeScript）。

**Python 流式展示文本 + 工具进度**：

```python
import asyncio
import sys
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage
from claude_agent_sdk.types import StreamEvent


async def stream_with_progress():
    options = ClaudeAgentOptions(
        include_partial_messages=True,
        allowed_tools=["Read", "Glob", "Grep"],
        max_turns=15,
    )

    in_tool = False  # 跟踪当前是否在工具调用内

    async for message in query(
        prompt="在代码库里找出所有 TODO 注释，按文件汇总。", options=options
    ):
        if isinstance(message, StreamEvent):
            event = message.event
            etype = event.get("type")

            if etype == "content_block_start":
                block = event.get("content_block", {})
                if block.get("type") == "tool_use":
                    print(f"\n⟳ {block.get('name')}...", end="", flush=True)
                    in_tool = True

            elif etype == "content_block_delta":
                delta = event.get("delta", {})
                if delta.get("type") == "text_delta" and not in_tool:
                    sys.stdout.write(delta.get("text", ""))
                    sys.stdout.flush()

            elif etype == "content_block_stop" and in_tool:
                print(" 完成", flush=True)
                in_tool = False

        elif isinstance(message, ResultMessage):
            print(f"\n\n── 任务结束（{message.subtype}），花费 ${message.total_cost_usd:.4f} ──")


asyncio.run(stream_with_progress())
```

**TypeScript 流式展示**：

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

let inTool = false;

for await (const message of query({
  prompt: "在代码库里找出所有 TODO 注释，按文件汇总。",
  options: {
    includePartialMessages: true,
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 15,
  },
})) {
  if (message.type === "stream_event") {
    const ev = message.event;

    if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
      process.stdout.write(`\n⟳ ${ev.content_block.name}...`);
      inTool = true;
    } else if (ev.type === "content_block_delta") {
      if (ev.delta.type === "text_delta" && !inTool) {
        process.stdout.write(ev.delta.text);
      }
    } else if (ev.type === "content_block_stop" && inTool) {
      console.log(" 完成");
      inTool = false;
    }
  } else if (message.type === "result") {
    console.log(`\n\n── 任务结束（${message.subtype}），花费 $${message.total_cost_usd.toFixed(4)} ──`);
  }
}
```

---

### 示例五：会话恢复（多轮上下文保持）

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, SystemMessage, ResultMessage


async def multi_turn():
    session_id = None

    # 第一轮：读取项目结构
    async for message in query(
        prompt="读取项目的认证模块，理解它的结构。",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Glob"]),
    ):
        if isinstance(message, SystemMessage) and message.subtype == "init":
            session_id = message.data["session_id"]
        elif isinstance(message, ResultMessage) and message.subtype == "success":
            print("第一轮完成：", message.result[:100], "...")

    print(f"\n会话 ID：{session_id}")

    # 第二轮：在同一会话上下文中继续
    async for message in query(
        prompt="现在找出所有调用了认证模块的地方。",  # 'it' 指代上轮读取的模块
        options=ClaudeAgentOptions(
            resume=session_id,
            allowed_tools=["Glob", "Grep"],
        ),
    ):
        if isinstance(message, ResultMessage) and message.subtype == "success":
            print("\n第二轮完成：", message.result[:200])


asyncio.run(multi_turn())
```

---

## 生产托管要点

### 子进程模型

`query()` 每次调用启动一个 `claude` CLI 子进程，通过 stdio 通信。**N 个并发会话 = N 个子进程**。默认继承当前工作目录，多租户场景必须为每个会话显式传 `cwd`：

```python
options = ClaudeAgentOptions(cwd="/work/tenant-a-session-xyz")
```

```typescript
options: { cwd: "/work/tenant-a-session-xyz" }
```

### 容器资源起点

每个代理进程建议至少 1 GiB RAM、5 GiB 磁盘。实际用量随会话长度增长，根据真实压测数据调整。

每台主机可承载代理数估算：
```
可承载代理数 = (主机 RAM - 系统开销) / 每个会话峰值 RSS
```

### OpenTelemetry 可观测性

在容器环境变量中设置，无需改代码：

```powershell
# .env 或容器环境变量
$env:CLAUDE_CODE_ENABLE_TELEMETRY = "1"
$env:CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1"  # 启用 trace
$env:OTEL_TRACES_EXPORTER = "otlp"
$env:OTEL_METRICS_EXPORTER = "otlp"
$env:OTEL_LOGS_EXPORTER = "otlp"
$env:OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"
$env:OTEL_EXPORTER_OTLP_ENDPOINT = "http://your-collector:4318"
```

### 多租户隔离

在共享容器中避免租户间状态泄漏：

```python
options = ClaudeAgentOptions(
    cwd=tenant_dir,
    setting_sources=[],       # 不加载文件系统设置（CLAUDE.md 等）
    env={
        "CLAUDE_CONFIG_DIR": f"/configs/{tenant_id}",
        "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",  # 禁用自动内存注入
    },
)
```

```typescript
// TypeScript 的 env 是替换而非合并，必须展开 process.env
options: {
  cwd: tenantDir,
  settingSources: [],
  env: {
    ...process.env,                          // 保留 PATH、ANTHROPIC_API_KEY 等
    CLAUDE_CONFIG_DIR: `/configs/${tenantId}`,
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
  },
}
```

### 会话持久化

默认会话记录写在 `~/.claude/projects/`（或 `CLAUDE_CONFIG_DIR/projects/`），容器重启后丢失。如需跨实例恢复，实现 `SessionStore` 适配器（参考实现支持 S3、Redis、Postgres），通过 `session_store` / `sessionStore` 选项传入。

---

## 动手练习

1. **最小代理**：用 Python 或 TypeScript 写一个代理，让它读取你项目里某个真实的源文件，找出潜在的 bug 并打印分析结果。要求：设置 `max_turns=5`、`max_budget_usd=0.10`，正确处理 `error_max_turns` 子类型。

2. **自定义工具接入数据库**：定义一个 `query_sqlite` 工具，接收 SQL 语句，查询本地 SQLite 文件并返回结果。用 `is_error: true` 处理非法 SQL 或查询失败。注意只允许 SELECT 语句（白名单检查）。

3. **结构化代码审查报告**：在练习 1 的基础上加上结构化输出：定义包含 `bugs`（数组，含 `severity`、`description`、`file`、`line`）和 `summary` 的 Pydantic/Zod schema，让代理输出类型安全的 JSON 报告，并把它写入 `review-report.json`。

4. **流式 Web API**：用 FastAPI（Python）或 Hono/Express（TypeScript）暴露一个 `/analyze` POST 端点，接收 `{ "prompt": "..." }`，启用 `include_partial_messages`，把 `text_delta` 事件以 Server-Sent Events 格式实时推送给客户端。

5. **多租户沙箱**：模拟两个租户并发运行代理，每个租户有独立的 `cwd`、`CLAUDE_CONFIG_DIR`，并确认两者的文件操作互不干扰。用 Python `asyncio.gather` 或 TypeScript `Promise.all` 并发启动。

---

## 常见坑与注意事项

**TypeScript `env` 是替换不是合并**
TypeScript SDK 的 `env` 字段完全替换子进程的环境变量。如果不展开 `...process.env`，`PATH`、`ANTHROPIC_API_KEY` 等全部丢失，导致子进程启动失败或 API 调用出错。Python 的 `env` 字段是合并在继承环境上的，行为相反。

**`result` 字段在失败时不存在**
`ResultMessage.result` 仅在 `subtype === "success"` 时有值，其他子类型下访问会得到 `undefined` / `None`。永远先检查 `subtype` 再读取 `result`。

**`max_turns` 没有默认上限**
不设置 `max_turns` 时循环真的会无限运行（直到任务完成或手动中断）。开放式提示（如「改进这个代码库」）可能跑出巨额账单，生产环境务必设置。

**AssistantMessage 在 TypeScript 中有嵌套层**
TypeScript 的 `AssistantMessage` 内容在 `message.message.content`，Python 在 `message.content`。初学者常写成 `message.content` 直接取，拿到的是 `undefined`。

**自定义工具中抛出未捕获异常会终止整个 query()**
工具 handler 里抛出的异常会直接终止代理循环，Claude 看不到错误。正确做法是 try/catch 后返回 `{ ..., is_error: true }` / `{ ..., isError: true }`，让 Claude 基于错误信息决定下一步。

**进程内 MCP 服务器工具默认串行执行**
自定义工具默认串行调用。对无副作用的查询类工具设置 `readOnlyHint: true`（`ToolAnnotations`），SDK 才会允许与其他只读工具并行调用，提升效率。

**Python SDK `@tool` 不支持 `structuredContent`**
Python 的 `@tool` 装饰器只转发 `content` 和 `is_error`。如果需要在工具结果中返回 `structuredContent`，需要运行独立的外部 MCP 服务器进程。

**结构化输出 schema 越简单越可靠**
嵌套层级深、必填字段多的 schema 更容易触发 `error_max_structured_output_retries`。先从扁平 schema 开始，按需增加嵌套；把任务不一定有的字段标为可选。

**从 `claude -p`（headless CLI）迁移**
如果你之前用 `claude -p "prompt" --output-format json` 驱动代理，SDK 的 `query()` 是对应替代品：更强的错误处理、结构化消息流、会话恢复、hooks 支持，同时免去 shell 转义和跨平台兼容问题。

**订阅计划的 Agent SDK 额度独立计费（2026-06-15 起）**
从 2026-06-15 起，在订阅计划下使用 Agent SDK（包括 `claude -p`）会从单独的月度 Agent SDK 积分扣费，与交互式使用额度分开。API key 计费方式不变。

---

## 掌握标志

- [ ] 能解释 Agent SDK、Anthropic Client SDK、Managed Agents 三者的核心区别，并能针对具体场景做出选择
- [ ] 能在 Windows PowerShell 环境下正确安装 Python / TypeScript SDK，并设置 API key
- [ ] 理解 Agent Loop 的轮次机制，知道 `max_turns`、`effort`、`permissionMode` 各自控制什么
- [ ] 能区分并正确处理 `SystemMessage`、`AssistantMessage`、`UserMessage`、`StreamEvent`、`ResultMessage` 五种消息类型
- [ ] 能用 `@tool` / `tool()` + `create_sdk_mcp_server` / `createSdkMcpServer` 定义自定义工具并注入到 `query()`
- [ ] 能用 Pydantic / Zod 定义 schema，用 `output_format` / `outputFormat` 获取类型安全的结构化输出，并正确处理 `error_max_structured_output_retries`
- [ ] 能启用 `include_partial_messages` / `includePartialMessages`，从 `StreamEvent` 中提取 `text_delta` 和工具调用进度
- [ ] 知道 TypeScript 的 `env` 字段替换而非合并环境变量，能避免这个陷阱
- [ ] 能配置 OTEL 环境变量实现代理可观测性，知道 `CLAUDE_CODE_ENABLE_TELEMETRY` 等关键变量
- [ ] 能用 `setting_sources=[]` + `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` 实现多租户隔离

---

## 延伸阅读

### 官方文档

- [Agent SDK 概览](https://code.claude.com/docs/zh-CN/agent-sdk/overview)
- [快速开始](https://code.claude.com/docs/zh-CN/agent-sdk/quickstart)
- [代理循环详解](https://code.claude.com/docs/zh-CN/agent-sdk/agent-loop)
- [自定义工具（进程内 MCP）](https://code.claude.com/docs/zh-CN/agent-sdk/custom-tools)
- [结构化输出](https://code.claude.com/docs/zh-CN/agent-sdk/structured-outputs)
- [实时流式输出](https://code.claude.com/docs/zh-CN/agent-sdk/streaming-output)
- [托管与部署](https://code.claude.com/docs/zh-CN/agent-sdk/hosting)
- [Python SDK API 参考](https://code.claude.com/docs/zh-CN/agent-sdk/python)
- [TypeScript SDK API 参考](https://code.claude.com/docs/zh-CN/agent-sdk/typescript)
- [示例代理（GitHub）](https://github.com/anthropics/claude-agent-sdk-demos)
- [托管 Cookbook（Docker / Modal / Kubernetes）](https://github.com/anthropics/claude-cookbooks/tree/main/claude_agent_sdk/hosting)

### 系列其他文章

| 文件 | 主题 |
|---|---|
| [00-foundations.md](/books/claude-code-advanced/00-foundations/) | CLI 核心基础 |
| [01-context-engineering.md](/books/claude-code-advanced/01-context-engineering/) | 上下文工程 |
| [02-workflow-and-sessions.md](/books/claude-code-advanced/02-workflow-and-sessions/) | 工作流与会话管理 |
| [03-customization-and-extensions.md](/books/claude-code-advanced/03-customization-and-extensions/) | 定制化与扩展 |
| [04-mcp-and-tools.md](/books/claude-code-advanced/04-mcp-and-tools/) | MCP 与工具集成 |
| [05-multi-agent-orchestration.md](/books/claude-code-advanced/05-multi-agent-orchestration/) | 多代理编排 |
| [06-automation.md](/books/claude-code-advanced/06-automation/) | 自动化与 CI/CD |

---

> **本系列到此完结。** 七篇文章覆盖了从 Claude Code 基础操作到 Agent SDK 产品化开发的完整路径。后续官方文档更新、新 SDK 版本发布时，建议直接查阅 [code.claude.com/docs](https://code.claude.com/docs/zh-CN/) 获取最新信息。

