---
title: 'Tool Calling：让 AI 调用工具'
draft: false
---

Tool Calling 是 AI 学习路线的第三章。

第一章 Prompt 解决的是“怎么把需求讲清楚”。第二章 Structured Output 解决的是“怎么让 AI 输出可被程序处理”。到了第三章，我们要进一步解决“怎么让 AI 调用外部能力完成真实动作”。

在只聊天的场景里，AI 主要负责生成文字。但在真实项目里，很多任务需要访问外部系统，例如查询天气、读取文件、调用接口、查询数据库、执行命令、创建工单、发送通知。模型本身无法直接完成这些动作，需要由程序把外部能力封装成工具，再让 AI 在合适的时候选择并调用。

这一章要解决的问题是：

> 如何把外部函数、API、文件系统或命令行封装成 AI 可以安全调用的工具。

学完这一章，你应该能做到三件事：

- 设计一个清晰的 tool schema
- 让 AI 根据任务选择合适工具并传入正确参数
- 对工具调用失败、权限风险和危险操作进行控制

## 1. Tool Calling 是什么

Tool Calling 指的是让 AI 在回答过程中调用外部工具。

这里的“工具”可以是：

- 一个普通函数
- 一个 HTTP API
- 一个数据库查询方法
- 一个文件读取方法
- 一个命令执行方法
- 一个业务系统接口
- 一个自动化脚本入口

模型负责判断“什么时候该用哪个工具”和“应该传什么参数”。程序负责真正执行工具，并把执行结果返回给模型。模型再根据工具结果继续生成回答或决定下一步动作。

一个典型流程如下：

```text
用户提出任务
  ↓
AI 判断需要调用工具
  ↓
AI 生成工具名和参数
  ↓
程序执行工具
  ↓
程序把结果返回给 AI
  ↓
AI 基于结果输出最终回答
```

示例：

```text
用户：帮我查一下北京今天的天气。

AI 选择工具：get_weather
AI 传入参数：{"city": "北京", "date": "today"}
程序执行查询
程序返回：{"temperature": "18-26°C", "condition": "晴"}
AI 回答：北京今天晴，气温 18-26°C。
```

Tool Calling 的核心价值，是让 AI 从“只会生成内容”升级为“可以连接外部能力并完成任务”。

## 2. 为什么需要 Tool Calling

AI 模型有几个天然限制：

- 无法直接读取你的本地文件
- 无法直接查询你的数据库
- 无法直接调用你的内部接口
- 无法直接知道实时天气、库存、订单、部署状态
- 无法直接执行命令或修改系统

Tool Calling 可以把这些外部能力接进 AI 工作流。

它能带来几个直接收益：

- 获取实时数据
- 使用私有系统能力
- 执行业务动作
- 连接本地文件和命令行
- 让 AI 结果可以驱动自动化流程
- 把复杂任务拆成可执行步骤

从这一章开始，AI 就开始进入真实系统边界。工具设计越清楚，系统越稳定；权限控制越严谨，风险越可控。

## 3. Tool Calling 的基本组成

一个工具通常包含四个部分：

- 工具名
- 工具描述
- 参数 schema
- 返回值设计

示例：

```json
{
  "name": "get_weather",
  "description": "查询指定城市在指定日期的天气信息",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "城市名称，例如：北京、上海、广州"
      },
      "date": {
        "type": "string",
        "description": "查询日期，例如：today、tomorrow、2026-05-28"
      }
    },
    "required": ["city", "date"]
  }
}
```

这个 schema 告诉模型三件事：

- 工具可以做什么
- 调用工具需要哪些参数
- 每个参数应该是什么类型和含义

模型看到用户问题后，会根据工具描述和参数规则生成调用参数。程序接到参数后，再执行真实函数。

## 4. function calling

function calling 是 Tool Calling 最常见的形式。

它的基本思想是：把一个函数暴露给模型，让模型在需要时生成函数调用。

示例函数：

```ts
async function getWeather(city: string, date: string) {
  return {
    city,
    date,
    condition: "晴",
    temperature: "18-26°C"
  };
}
```

对应的工具定义：

```json
{
  "name": "get_weather",
  "description": "查询天气信息",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "城市名称"
      },
      "date": {
        "type": "string",
        "description": "日期"
      }
    },
    "required": ["city", "date"]
  }
}
```

用户提问：

```text
帮我查一下上海明天的天气。
```

模型可能生成：

```json
{
  "tool": "get_weather",
  "arguments": {
    "city": "上海",
    "date": "tomorrow"
  }
}
```

程序执行工具后，把结果返回给模型：

```json
{
  "city": "上海",
  "date": "tomorrow",
  "condition": "多云",
  "temperature": "20-27°C"
}
```

最后模型基于工具结果回答用户。

## 5. tool schema 设计

tool schema 是工具调用稳定性的关键。

一个好 schema 需要做到：

- 工具名清晰
- 工具描述具体
- 参数类型明确
- 必填字段明确
- 参数含义明确
- 枚举值尽量固定
- 输入边界可校验

### 5.1 工具名

工具名应该表达动作和对象。

推荐写法：

```text
get_weather
read_file
search_documents
query_database
create_ticket
send_notification
run_command
```

不推荐写法：

```text
do_it
handle
process
tool1
api_call
```

工具名越具体，模型越容易选择正确工具。

### 5.2 工具描述

工具描述要说明工具能做什么、适合什么场景、有什么限制。

示例：

```text
读取工作区内指定路径的文本文件。只支持 .txt、.md、.json 文件，不支持读取工作区外的路径。
```

这个描述比“读取文件”更清楚，因为它说明了：

- 读取范围
- 支持类型
- 禁止范围

### 5.3 参数设计

参数设计要尽量结构化。

问题写法：

```json
{
  "query": "查一下北京今天的天气"
}
```

更清楚的写法：

```json
{
  "city": "北京",
  "date": "today"
}
```

第二种写法更容易校验，也更容易复用。

参数设计建议：

- 一个字段只表达一个含义
- 能用枚举就用枚举
- 能拆开的字段尽量拆开
- 对路径、日期、数量加边界说明
- 对危险参数加白名单限制

### 5.4 返回值设计

工具返回值要方便模型继续处理，也要方便程序记录日志。

推荐包含：

- `success`：是否执行成功
- `data`：成功时的数据
- `error`：失败时的错误信息
- `code`：错误码或状态码
- `metadata`：可选的补充信息

示例：

```json
{
  "success": true,
  "data": {
    "city": "北京",
    "condition": "晴",
    "temperature": "18-26°C"
  },
  "error": null,
  "code": "OK",
  "metadata": {
    "source": "weather_api",
    "cached": false
  }
}
```

失败示例：

```json
{
  "success": false,
  "data": null,
  "error": "city is required",
  "code": "VALIDATION_ERROR",
  "metadata": {}
}
```

返回值统一之后，模型和程序都更容易处理异常。

## 6. 参数校验

工具调用不能完全依赖模型自觉传对参数。程序必须做参数校验。

常见校验包括：

- 必填字段是否存在
- 字段类型是否正确
- 字符串长度是否合理
- 数字范围是否合理
- 日期格式是否正确
- 枚举值是否在允许范围内
- 文件路径是否在允许目录内
- SQL 查询是否只读
- 命令是否在白名单内

示例：

```ts
type ReadFileArgs = {
  path: string;
};

function validateReadFileArgs(args: ReadFileArgs) {
  if (!args.path) {
    throw new Error("path is required");
  }

  if (args.path.includes("..")) {
    throw new Error("path cannot include parent directory traversal");
  }

  if (!args.path.endsWith(".md") && !args.path.endsWith(".txt")) {
    throw new Error("only .md and .txt files are allowed");
  }
}
```

参数校验是工具安全的第一道门。

## 7. 工具调用失败处理

工具调用可能失败。失败原因通常包括：

- 参数缺失
- 参数格式错误
- 外部 API 超时
- 数据库连接失败
- 文件不存在
- 权限不足
- 命令执行失败
- 第三方服务返回错误

失败处理建议：

- 给出明确错误码
- 保留原始错误日志
- 给模型返回简短可理解的错误信息
- 区分可重试和不可重试错误
- 对超时、限流、网络抖动设置重试策略
- 对危险操作失败禁止自动重试

示例返回：

```json
{
  "success": false,
  "code": "FILE_NOT_FOUND",
  "error": "目标文件不存在，请确认路径是否正确。",
  "data": null
}
```

模型拿到这个结果后，可以继续向用户说明问题，也可以请求用户补充正确路径。

## 8. 多工具选择

真实任务里经常会有多个工具。

例如：

- `read_file`：读取文件
- `search_files`：搜索文件
- `query_database`：查询数据库
- `call_api`：调用接口
- `run_command`：执行命令

用户提出任务：

```text
帮我看一下项目启动失败的原因。
```

模型可能需要按顺序使用多个工具：

1. 调用 `read_file` 查看 `package.json`
2. 调用 `run_command` 执行启动命令
3. 调用 `read_file` 查看报错涉及的配置文件
4. 调用 `search_files` 搜索错误关键词
5. 汇总原因和修复建议

多工具选择要注意：

- 每个工具职责单一
- 工具描述互相区分
- 相似工具要写清使用场景
- 高风险工具要加确认机制
- 工具结果要能支撑下一步判断

如果两个工具描述太接近，模型容易选错。可以通过补充描述来降低混淆。

## 9. 人工确认机制

Tool Calling 一旦连接真实系统，就可能产生实际影响。涉及修改、删除、付款、发布、重启、发消息等动作时，需要加入人工确认。

适合人工确认的场景包括：

- 删除文件
- 修改数据库
- 执行部署
- 重启服务
- 发送邮件或通知
- 创建订单
- 发起付款
- 修改权限
- 运行高风险命令

确认前应该展示：

- 将要调用的工具
- 将要传入的参数
- 影响范围
- 风险点
- 可回滚方式

示例：

```text
即将执行工具：delete_file
目标路径：docs/old-plan.md
影响范围：删除该文件
风险提示：删除后需要从 Git 历史或备份恢复

请确认是否继续。
```

人工确认机制可以防止模型误操作，也能让用户理解即将发生的动作。

## 10. 危险操作拦截

有些工具能力风险很高，必须在程序层做拦截。

高风险操作包括：

- 删除文件或目录
- 批量修改数据
- 执行 shell 命令
- 访问敏感路径
- 查询敏感数据
- 调用付款接口
- 修改生产环境配置
- 上传密钥或 token

常见拦截方式：

- 路径限制
- 命令白名单
- 参数黑名单
- 只读模式
- 沙箱执行
- 二次确认
- 权限分级
- 审计日志

命令执行工具尤其需要谨慎。

示例策略：

```text
run_command 工具规则：
1. 默认只允许执行 npm test、npm run lint、npm run build。
2. 禁止执行 rm、del、format、shutdown、curl 上传敏感文件等命令。
3. 禁止访问工作区外路径。
4. 需要修改文件或删除文件时，必须先展示计划并等待确认。
5. 每次执行记录命令、参数、时间、调用用户和结果。
```

安全边界要写在程序里，不能只写在 Prompt 里。

## 11. 常见工具示例

### 11.1 天气查询工具

工具定义：

```json
{
  "name": "get_weather",
  "description": "查询指定城市的天气信息",
  "parameters": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "城市名称"
      },
      "date": {
        "type": "string",
        "description": "日期，支持 today、tomorrow 或 YYYY-MM-DD"
      }
    },
    "required": ["city"]
  }
}
```

适合练习：

- 参数抽取
- 默认值处理
- API 调用
- 错误返回

### 11.2 文件读取工具

工具定义：

```json
{
  "name": "read_file",
  "description": "读取工作区内指定路径的文本文件",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "相对工作区的文件路径"
      }
    },
    "required": ["path"]
  }
}
```

安全要求：

- 限制工作区范围
- 禁止 `..` 路径穿越
- 限制文件大小
- 限制文件类型
- 敏感文件需要拒绝读取或脱敏

### 11.3 数据库查询工具

工具定义：

```json
{
  "name": "query_database",
  "description": "执行只读数据库查询，用于获取业务数据",
  "parameters": {
    "type": "object",
    "properties": {
      "sql": {
        "type": "string",
        "description": "只允许 SELECT 查询"
      }
    },
    "required": ["sql"]
  }
}
```

安全要求：

- 只允许 SELECT
- 禁止 UPDATE、DELETE、DROP、TRUNCATE
- 设置最大返回行数
- 设置超时时间
- 对敏感字段脱敏
- 记录审计日志

更稳妥的做法是提供业务化参数：

```json
{
  "name": "get_order_by_id",
  "description": "根据订单 ID 查询订单概要",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "订单 ID"
      }
    },
    "required": ["order_id"]
  }
}
```

业务化工具比直接暴露 SQL 更容易控制风险。

### 11.4 命令执行工具

工具定义：

```json
{
  "name": "run_command",
  "description": "在工作区内执行允许列表中的命令",
  "parameters": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "description": "要执行的命令"
      },
      "cwd": {
        "type": "string",
        "description": "执行目录，必须在工作区内"
      }
    },
    "required": ["command"]
  }
}
```

安全要求：

- 命令白名单
- 工作区路径限制
- 超时限制
- 输出长度限制
- 禁止交互式阻塞命令
- 删除、移动、上传、发布类命令需要人工确认

命令执行工具能力很强，适合学习时放在最后练习。

## 12. Tool Calling Prompt 写法

设计工具后，还需要写清楚模型如何使用工具。

示例 Prompt：

```text
你是一个项目排障助手。

你可以使用以下工具：
1. read_file：读取工作区内的文本文件。
2. search_files：搜索工作区内的文件名或文本内容。
3. run_command：执行允许列表中的命令。

规则：
1. 如果问题需要真实文件内容，请先读取文件。
2. 如果不知道文件位置，请先搜索。
3. 如果需要验证构建或测试结果，可以执行命令。
4. 涉及删除、覆盖、发布、上传、修改数据库等动作时，必须先请求用户确认。
5. 工具返回失败时，先解释失败原因，再决定是否需要用户补充信息。

任务：
请帮我分析项目启动失败的原因。
```

这个 Prompt 明确了工具清单、使用规则和风险边界。

## 13. Tool Calling 和 Structured Output 的关系

Tool Calling 经常依赖 Structured Output。

原因很简单：模型调用工具时，需要输出结构化参数。

例如：

```json
{
  "tool": "read_file",
  "arguments": {
    "path": "package.json"
  }
}
```

如果参数格式不稳定，程序就无法可靠执行工具。所以第二章学到的 JSON、schema、字段校验，在第三章会继续使用。

可以这样理解两者关系：

- Structured Output 让 AI 输出稳定数据
- Tool Calling 让稳定数据驱动外部工具

先把结构化输出练扎实，再学习工具调用，会更容易理解工程实现。

## 14. 常见问题

### 14.1 工具描述太模糊

问题示例：

```text
工具：handle_task
描述：处理任务
```

更清楚的写法：

```text
工具：search_documents
描述：在项目文档库中搜索与用户问题相关的 Markdown 文档，返回标题、路径和摘要。
```

### 14.2 参数过于自由

问题示例：

```json
{
  "input": "帮我查一下订单 123 的状态"
}
```

更清楚的写法：

```json
{
  "order_id": "123"
}
```

参数越自由，程序越难校验。

### 14.3 直接暴露高风险能力

问题示例：

```text
允许 AI 执行任意 shell 命令。
```

更稳妥的写法：

```text
只允许 AI 执行白名单命令，例如 npm test、npm run lint、npm run build。其他命令需要人工确认。
```

### 14.4 工具返回值缺少状态

问题示例：

```json
{
  "message": "文件不存在"
}
```

更清楚的写法：

```json
{
  "success": false,
  "code": "FILE_NOT_FOUND",
  "error": "文件不存在",
  "data": null
}
```

统一返回结构后，模型和程序都更容易处理失败。

### 14.5 缺少审计日志

工具调用一旦进入真实系统，就应该记录日志。

建议记录：

- 用户请求
- 模型选择的工具
- 工具参数
- 执行时间
- 执行结果
- 错误信息
- 是否经过人工确认

审计日志可以用于排查问题、复盘风险和优化工具设计。

## 15. Tool Calling 练习清单

可以按下面顺序练习：

1. 写一个天气查询工具
2. 写一个文件读取工具
3. 写一个文档搜索工具
4. 写一个数据库只读查询工具
5. 写一个命令执行工具，并加入白名单
6. 给工具返回值增加 `success`、`data`、`error`、`code`
7. 给参数增加 schema 校验
8. 给危险操作增加人工确认
9. 让 AI 根据任务自动选择工具
10. 记录每一次工具调用日志

每个练习都可以检查三个问题：

- 模型是否选对工具
- 参数是否符合 schema
- 工具失败时是否能给出清楚反馈

## 16. 阶段验收标准

学完这一章，可以用下面的问题检查自己：

- 我能不能把一个函数封装成 AI 工具？
- 我能不能写出清楚的工具描述？
- 我能不能设计可校验的工具参数？
- 我能不能设计统一的工具返回值？
- 我能不能处理工具调用失败？
- 我能不能让 AI 在多个工具中选择合适工具？
- 我能不能给危险操作加确认和拦截？
- 我能不能记录工具调用日志？

如果这些问题大多数都能做到，说明 Tool Calling 阶段已经基本合格。

## 17. 本章总结

Tool Calling 的核心是把外部能力封装成模型可以理解、程序可以执行、风险可以控制的工具。

一套可用的 Tool Calling 设计，建议至少包含：

- 清晰的工具名
- 明确的工具描述
- 可校验的参数 schema
- 统一的返回值结构
- 完整的失败处理
- 多工具选择规则
- 人工确认机制
- 危险操作拦截
- 审计日志

Tool Calling 是 AI 工程化路线中的关键一步。它让 AI 可以连接函数、API、文件系统、数据库和命令行，从生成内容走向执行任务。

这一章的目标很明确：让 AI 能调用工具，同时让每一次调用都可理解、可校验、可追踪、可控制。

