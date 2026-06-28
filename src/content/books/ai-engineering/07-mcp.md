---
title: 'MCP：标准化 AI 工具接口'
draft: false
---

MCP 是 AI 学习路线的第七章。

前面几章已经让 AI 具备了表达、结构化输出、工具调用、知识检索、效果评估和多步骤执行能力。到了 MCP 阶段，我们要解决工具接入方式的问题：怎样把文件系统、数据库、业务接口、知识库和本地脚本封装成 AI 可以统一访问的能力。

如果每个项目都用一套自定义工具协议，模型、客户端、服务端和权限逻辑会越来越混乱。MCP 的价值，是提供一套统一的连接方式，让 AI 客户端可以发现工具、读取资源、使用提示词模板，并以一致的方式调用外部系统。

这一章要解决的问题是：

> 如何把外部能力封装成 AI 可以统一访问、可描述、可鉴权、可审计的工具和资源。

学完这一章，你应该能做到三件事：

- 说清 MCP server、MCP client、tools、resources、prompts 的职责
- 设计一个简单 MCP server，把业务能力接入 AI 工作流
- 为 MCP 工具增加鉴权、权限控制、返回结构和错误处理

## 1. MCP 是什么

MCP 可以理解成 AI 应用和外部能力之间的标准连接层。

它把外部能力包装成统一接口，让 AI 客户端可以通过一致的方式访问：

- tools：可执行动作
- resources：可读取资料
- prompts：可复用提示词模板

典型关系如下：

```text
AI Client
  ↓
MCP Client
  ↓
MCP Server
  ↓
文件系统 / 数据库 / API / 文档库 / 本地脚本
```

AI 客户端负责发起请求，MCP server 负责暴露能力。业务系统无需直接塞进模型上下文，只需要按协议提供工具和资源。

## 2. 为什么需要 MCP

Tool Calling 已经能让 AI 调用函数，但在真实项目中会遇到几个问题：

- 不同工具接入方式不统一
- 工具描述分散在多个项目里
- 权限逻辑容易重复实现
- AI 客户端很难自动发现可用能力
- 资源读取和工具调用边界不清
- 本地能力和远程业务系统难以统一管理

MCP 能带来几个直接收益：

- 工具接入标准化
- 资源暴露标准化
- 客户端可以发现服务端能力
- 权限和鉴权可以集中设计
- 工具说明、参数和返回值更清楚
- 本地系统和远程系统都能接入 AI 工作流
- 可复用能力更容易迁移到不同 AI 客户端

MCP 适合把已有系统接入 AI，而无需为每个客户端写一套专用适配。

## 3. MCP 的基本组成

一个 MCP 体系通常包含这些角色：

- MCP server
- MCP client
- tools
- resources
- prompts
- transport
- auth
- permission
- logging

简化理解：

```text
MCP server：提供能力
MCP client：连接能力
tools：执行动作
resources：读取资料
prompts：复用提示词
auth：确认身份
permission：控制能做什么
logging：记录调用过程
```

这些组成部分共同决定 MCP 接入是否稳定、安全、可维护。

## 4. MCP server

MCP server 是能力提供方。

它可以暴露：

- 本地文件系统
- 数据库查询
- 项目文档
- 测试平台
- 运维系统
- 工单系统
- 个人知识库
- 内部业务 API

示例：

```text
一个项目文档 MCP server 可以提供：
1. search_docs：搜索文档
2. read_doc：读取指定文档
3. list_modules：列出文档模块
4. requirement_review_prompt：需求评审提示词模板
```

MCP server 的设计重点：

- 能力边界清楚
- 工具命名清楚
- 参数 schema 可校验
- 返回结构稳定
- 错误信息可理解
- 权限控制足够细
- 调用日志可追踪

## 5. MCP client

MCP client 是能力使用方。

它负责：

- 连接 MCP server
- 发现可用 tools、resources、prompts
- 把工具描述提供给模型
- 接收模型生成的调用参数
- 调用 MCP server
- 把结果交回模型

一个 AI 应用可以同时连接多个 MCP server。

示例：

```text
代码助手连接：
1. 文件系统 MCP
2. Git MCP
3. 数据库 MCP
4. 项目文档 MCP
5. CI 测试 MCP
```

这样，AI 可以在一个任务里读取代码、查看提交、查数据库、读文档和看测试结果。

## 6. tools

tools 是 MCP 中最接近 Tool Calling 的部分。

一个 tool 代表一个可执行动作。

常见工具示例：

- read_file
- search_files
- query_database
- call_api
- create_ticket
- run_test
- deploy_preview
- get_user_profile

工具定义要包含：

- name
- description
- input schema
- output structure
- error behavior
- permission requirement

示例：

```json
{
  "name": "search_docs",
  "description": "搜索项目文档，返回匹配文档的标题、路径和摘要",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索关键词或问题"
      },
      "module": {
        "type": "string",
        "description": "可选模块名，例如 auth、billing、admin"
      }
    },
    "required": ["query"]
  }
}
```

工具描述越明确，模型越容易选择正确工具。

## 7. resources

resources 是 MCP 中用于读取资料的能力。

它适合暴露相对静态或可浏览的内容，例如：

- 文档文件
- 配置说明
- 数据库 schema
- API 说明
- 项目结构
- 日志片段
- 知识库页面

resources 和 tools 的侧重点不同：

- resources 偏读取和浏览
- tools 偏执行动作

示例：

```text
resource URI：
docs://api/auth/login
schema://database/users
file://project/package.json
```

资源设计建议：

- URI 规则稳定
- 内容大小可控
- 元数据完整
- 权限过滤明确
- 敏感信息脱敏
- 读取失败时返回清晰错误

## 8. prompts

prompts 是 MCP 中的提示词模板能力。

它适合沉淀团队常用流程，例如：

- 需求分析模板
- 接口测试设计模板
- 代码审查模板
- 运维巡检模板
- 发布检查模板
- 文档总结模板

示例：

```text
prompt name：api_test_design

用途：
根据接口文档生成接口测试点。

输入：
- interface_doc
- business_context
- risk_level

输出：
- 正常场景
- 异常场景
- 边界场景
- 待确认问题
```

prompts 的价值，是把团队经验沉淀成可复用入口，让不同用户得到更一致的 AI 输出。

## 9. 鉴权

MCP server 连接真实系统时，必须考虑鉴权。

常见鉴权方式包括：

- 本地进程权限
- API key
- Bearer token
- OAuth
- session cookie
- mTLS
- 内网身份代理

鉴权需要回答几个问题：

- 谁在调用 MCP server
- 调用者来自哪个客户端
- 调用者是否有访问目标资源的权限
- 凭证如何保存
- 凭证是否会进入模型上下文
- 凭证过期后如何处理

基本原则：

- token 不进入模型上下文
- 错误信息不泄露密钥
- 日志中不记录完整凭证
- 高权限工具单独控制
- 本地开发和生产环境分开配置

鉴权做得清楚，MCP 才能接入更高价值的业务系统。

## 10. 权限控制

鉴权解决“你是谁”，权限控制解决“你能做什么”。

MCP 权限可以按这些维度设计：

- 用户
- 角色
- 项目
- 环境
- 工具
- 资源路径
- 操作类型
- 数据敏感级别

示例：

```text
普通用户：
- 可以读取公开文档
- 可以搜索项目知识库
- 不能查询用户隐私数据
- 不能执行部署工具

运维用户：
- 可以读取服务状态
- 可以查看脱敏日志
- 重启服务需要二次确认
- 生产发布需要审批
```

权限控制要在 MCP server 端执行。客户端提示和模型规则只能作为辅助说明。

## 11. 工具描述设计

工具描述直接影响模型选择工具的准确率。

好的工具描述应包含：

- 工具能做什么
- 适合什么场景
- 不适合什么场景
- 需要哪些参数
- 参数含义和边界
- 返回结果包含什么
- 失败时如何表现

示例：

```text
search_docs：
在项目文档库中搜索与问题相关的 Markdown 文档。
适合查找需求、接口说明、错误码、配置说明。
返回标题、路径、摘要和更新时间。
```

工具描述要避免过于泛化的名字，例如 `handle`、`process`、`do_task`。清晰命名能显著降低误调用。

## 12. 返回内容设计

MCP 工具返回内容要稳定。

建议统一结构：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "code": "OK",
  "metadata": {}
}
```

失败示例：

```json
{
  "success": false,
  "data": null,
  "error": "当前用户没有权限读取该资源",
  "code": "PERMISSION_DENIED",
  "metadata": {
    "resource": "docs://finance/internal"
  }
}
```

返回内容设计要注意：

- 成功和失败都结构化
- 错误码稳定
- 错误信息给模型看得懂
- 敏感信息脱敏
- 大内容分页或摘要化
- 保留可追踪 metadata

## 13. MCP 实战练习

可以按下面顺序练习：

1. 写一个文件系统 MCP，只允许读取指定目录
2. 写一个项目文档 MCP，支持搜索和读取文档
3. 写一个数据库查询 MCP，只允许 SELECT
4. 写一个测试平台 MCP，支持查询测试结果
5. 写一个个人知识库 MCP，支持按标签检索
6. 给 MCP server 增加 API key 鉴权
7. 给工具增加权限检查
8. 给返回结果增加统一结构
9. 记录每次工具调用日志
10. 设计一组 MCP 工具调用 Eval

每个练习都可以检查三个问题：

- AI 是否能发现并正确使用工具
- 权限是否在 server 端生效
- 返回结果是否方便模型继续处理

## 14. 阶段验收标准

学完这一章，可以用下面的问题检查自己：

- 我能不能说明 MCP server 和 MCP client 的职责？
- 我能不能把一个业务函数封装成 MCP tool？
- 我能不能把文档或 schema 暴露成 resource？
- 我能不能把常用流程沉淀成 prompt？
- 我能不能设计清晰的工具描述？
- 我能不能为工具参数写 schema？
- 我能不能为 MCP server 增加鉴权？
- 我能不能按用户权限过滤工具和资源？
- 我能不能设计统一返回结构？
- 我能不能记录 MCP 调用日志？

如果这些问题大多数都能做到，说明 MCP 阶段已经基本合格。

## 15. 本章总结

MCP 的核心是标准化 AI 与外部能力的连接方式。

一套可用的 MCP 接入，建议至少包含：

- MCP server
- MCP client
- tools
- resources
- prompts
- 鉴权
- 权限控制
- 工具描述设计
- 参数 schema
- 返回内容设计
- 错误处理
- 审计日志

MCP 让业务系统、数据源、本地能力和知识库可以更稳定地进入 AI 工作流。

这一章的目标很明确：把外部能力封装成统一、可发现、可调用、可控制、可追踪的 AI 接口。

