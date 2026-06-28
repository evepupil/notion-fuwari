---
title: 'Structured Output：让 AI 输出可被程序处理的结果'
draft: false
---

Structured Output 是 AI 学习路线的第二章。

第一章 Prompt 解决的是“怎么把需求讲清楚”。到了第二章，我们要进一步解决“怎么让 AI 的输出可以被程序稳定读取”。

在日常聊天里，自然语言输出已经够用。但在真实项目里，AI 的结果经常要继续进入代码流程，例如保存到数据库、调用接口、生成测试用例、驱动工具执行、进入审批流。这时输出内容必须稳定、字段必须明确、类型必须可校验。

这一章要解决的问题是：

> 如何让 AI 输出符合固定结构的数据，并让程序可以解析、校验和继续使用。

## 1. Structured Output 是什么

Structured Output 指的是让 AI 按照预先定义的结构输出内容。

常见结构包括：

- JSON
- YAML
- Markdown 表格
- CSV
- XML
- 固定字段清单
- 符合 JSON Schema 的对象

其中，JSON 是最常见的结构化输出格式，因为它可以直接被绝大多数编程语言解析。

一个普通自然语言输出可能是这样：

```text
这个用户叫张三，年龄 28 岁，是高级会员。
```

结构化输出可以写成这样：

```json
{
  "name": "张三",
  "age": 28,
  "membership": "premium"
}
```

第二种结果更适合程序处理。代码可以直接读取 `name`、`age`、`membership`，并继续执行后续逻辑。

## 2. 为什么需要 Structured Output

AI 自然语言输出有几个常见问题：

- 同一个问题，每次表达方式可能不同
- 字段名称可能变化
- 结果里可能混入解释文字
- 数字、布尔值、数组可能变成普通文本
- 缺少字段时程序难以判断
- 输出格式错误时后续流程会中断

Structured Output 的价值在于让 AI 输出更接近程序接口。

它能带来几个直接收益：

- 程序更容易解析
- 数据更容易校验
- 后续工具更容易调用
- 自动化流程更稳定
- 错误更容易定位
- 测试和回归更方便

从这一章开始，AI 的输出就逐渐从“给人看”走向“给系统用”。

## 3. 最简单的 JSON 输出

初学 Structured Output，可以先从明确要求 JSON 开始。

示例 Prompt：

```text
请从下面这段文本中提取用户信息。

要求：
1. 只输出 JSON。
2. 不要输出解释文字。
3. 字段包括 name、age、city。
4. 如果字段不存在，值使用 null。

文本：
张三今年 28 岁，目前住在杭州。
```

期望输出：

```json
{
  "name": "张三",
  "age": 28,
  "city": "杭州"
}
```

这个例子已经包含几个重要规则：

- 只输出 JSON
- 字段名固定
- 缺失字段用 `null`
- 不加额外解释

这些规则能减少解析失败的概率。

## 4. 字段设计

Structured Output 的第一步，是设计字段。

字段设计要关注几件事：

- 字段名是否稳定
- 字段含义是否清楚
- 字段类型是否明确
- 字段是否允许为空
- 字段是否有枚举范围
- 字段之间是否存在依赖关系

示例：

```json
{
  "title": "登录接口密码错误",
  "priority": "P1",
  "category": "异常场景",
  "steps": [
    "输入已注册手机号",
    "输入错误密码",
    "点击登录"
  ],
  "expectedResult": "提示账号或密码错误，登录失败"
}
```

这里的字段含义比较明确：

- `title`：用例标题，字符串
- `priority`：优先级，枚举值
- `category`：场景分类，枚举值
- `steps`：操作步骤，字符串数组
- `expectedResult`：预期结果，字符串

如果字段设计混乱，后面的 schema、校验、工具调用都会变得困难。

## 5. 类型约束

结构化输出里，字段类型非常重要。

常见类型包括：

- string
- number
- integer
- boolean
- array
- object
- null

示例：

```json
{
  "name": "张三",
  "age": 28,
  "isActive": true,
  "tags": ["vip", "paid_user"],
  "profile": {
    "city": "杭州",
    "company": null
  }
}
```

不同类型对应不同处理方式：

- 字符串可以展示和搜索
- 数字可以计算和排序
- 布尔值可以做条件判断
- 数组可以循环处理
- 对象可以表达嵌套结构
- null 可以表示信息缺失

Prompt 里应该明确字段类型，尤其是数字、布尔值、数组和嵌套对象。

## 6. JSON Schema

JSON Schema 是描述 JSON 数据结构的标准方式。

它可以定义：

- 对象有哪些字段
- 字段是什么类型
- 哪些字段必填
- 字符串长度限制
- 数字范围
- 枚举值范围
- 数组元素类型
- 嵌套对象结构

示例 schema：

```json
{
  "type": "object",
  "required": ["title", "priority", "category", "steps", "expectedResult"],
  "properties": {
    "title": {
      "type": "string"
    },
    "priority": {
      "type": "string",
      "enum": ["P0", "P1", "P2", "P3"]
    },
    "category": {
      "type": "string",
      "enum": ["正常场景", "异常场景", "边界场景"]
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "expectedResult": {
      "type": "string"
    }
  }
}
```

这个 schema 说明：AI 输出必须是一个对象，必须包含五个字段，并且 `priority` 和 `category` 只能从指定范围里选择。

## 7. 用 Schema 写 Prompt

把 schema 放进 Prompt，可以明显提高输出稳定性。

示例：

```text
请根据下面的登录需求生成一个测试用例对象。

要求：
1. 只输出 JSON。
2. 不要使用 Markdown 代码块。
3. 输出必须符合下面的 schema。

schema：
{
  "type": "object",
  "required": ["title", "priority", "category", "steps", "expectedResult"],
  "properties": {
    "title": { "type": "string" },
    "priority": { "type": "string", "enum": ["P0", "P1", "P2", "P3"] },
    "category": { "type": "string", "enum": ["正常场景", "异常场景", "边界场景"] },
    "steps": { "type": "array", "items": { "type": "string" } },
    "expectedResult": { "type": "string" }
  }
}

登录需求：
用户输入手机号和密码后点击登录。密码错误时，系统提示账号或密码错误。
```

期望输出：

```json
{
  "title": "密码错误时登录失败",
  "priority": "P1",
  "category": "异常场景",
  "steps": [
    "输入已注册手机号",
    "输入错误密码",
    "点击登录"
  ],
  "expectedResult": "系统提示账号或密码错误，用户无法登录"
}
```

在真实项目里，还应该用代码再次校验输出。Prompt 约束可以降低错误率，代码校验负责兜底。

## 8. 输出校验

Structured Output 的关键动作是校验。

校验可以检查：

- JSON 是否能解析
- 必填字段是否存在
- 字段类型是否正确
- 枚举值是否合法
- 字符串是否为空
- 数组是否为空
- 数据是否符合业务规则

JavaScript / TypeScript 项目常用 Zod：

```ts
import { z } from "zod";

const testCaseSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  category: z.enum(["正常场景", "异常场景", "边界场景"]),
  steps: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(1)
});

const parsed = testCaseSchema.safeParse(aiOutput);

if (!parsed.success) {
  console.log(parsed.error);
}
```

Python 项目常用 Pydantic：

```python
from pydantic import BaseModel
from typing import Literal

class TestCase(BaseModel):
    title: str
    priority: Literal["P0", "P1", "P2", "P3"]
    category: Literal["正常场景", "异常场景", "边界场景"]
    steps: list[str]
    expectedResult: str
```

校验通过后，数据才能进入下一步流程。

## 9. 失败重试和格式修复

AI 输出结构化数据时，常见失败包括：

- JSON 少了逗号
- 字段名拼错
- 输出里带了解释文字
- 数组被写成字符串
- 枚举值超出范围
- 必填字段缺失

处理方式通常有三种。

### 9.1 直接重试

当输出完全不可用时，可以重新请求模型。

示例：

```text
上一次输出无法解析为 JSON。请重新输出，要求只返回 JSON，不要包含解释文字。
```

### 9.2 带错误信息修复

当 JSON 接近正确时，可以把校验错误发回模型，让它修复。

示例：

```text
下面的 JSON 没有通过 schema 校验。

校验错误：
priority must be one of P0, P1, P2, P3

原始 JSON：
...

请修复为符合 schema 的 JSON，只输出修复后的 JSON。
```

### 9.3 程序侧修复

一些简单问题可以由程序处理，例如去掉代码块包裹、移除前后空白、解析字符串里的 JSON。

但程序侧修复要谨慎，尤其涉及金额、权限、用户身份、扣费、删除等高风险场景时，应该要求模型重新输出并通过严格校验。

## 10. 数组输出

很多任务需要输出列表，例如测试用例列表、任务清单、风险清单、文章大纲。

示例：

```json
[
  {
    "title": "正确手机号和密码登录成功",
    "priority": "P0",
    "category": "正常场景"
  },
  {
    "title": "密码错误时登录失败",
    "priority": "P1",
    "category": "异常场景"
  }
]
```

数组输出要注意：

- 数组元素结构要统一
- 不要让模型输出多个不同结构的对象
- 最好限制数量
- 最好要求排序规则
- 空数组要有明确含义

示例 Prompt：

```text
请生成测试用例数组。

要求：
1. 只输出 JSON array。
2. 最多输出 10 条。
3. 每个对象字段相同。
4. 按优先级从 P0 到 P3 排序。
5. 如果没有可生成的用例，输出空数组 []。
```

## 11. 枚举值设计

枚举值可以减少模型自由发挥。

例如优先级：

```json
["P0", "P1", "P2", "P3"]
```

例如任务状态：

```json
["pending", "in_progress", "blocked", "done"]
```

例如风险等级：

```json
["low", "medium", "high", "critical"]
```

枚举值设计要稳定。不要今天用 `high`，明天用 `严重`，后天又用 `P1`。字段一旦进入程序流程，就应该尽量保持长期兼容。

## 12. 空值和缺失信息

Structured Output 里一定要提前规定信息缺失时的处理方式。

常见策略：

- 使用 `null`
- 使用空字符串 `""`
- 使用空数组 `[]`
- 使用 `unknown`
- 增加 `missingFields` 字段
- 增加 `assumptions` 字段

推荐做法：

```json
{
  "name": "张三",
  "phone": null,
  "missingFields": ["phone"],
  "assumptions": []
}
```

这样程序可以明确知道：手机号缺失，并且当前结果没有依赖额外假设。

## 13. 面向工具调用的结构化输出

Tool Calling 的前置能力就是 Structured Output。

例如一个文件读取工具需要参数：

```json
{
  "path": "C:/project/README.md"
}
```

一个数据库查询工具需要参数：

```json
{
  "table": "users",
  "filters": {
    "status": "active"
  },
  "limit": 20
}
```

如果 AI 不能稳定输出工具参数，工具调用就会失败。

所以在学习 Tool Calling 之前，要先掌握：

- 参数对象怎么设计
- 字段类型怎么限制
- 缺失字段怎么处理
- 高风险参数怎么审批
- 工具返回值怎么结构化

Structured Output 是 Tool Calling 的基础。

## 14. 面向 RAG 的结构化输出

RAG 场景也需要 Structured Output。

例如一个带引用的回答可以设计成：

```json
{
  "answer": "登录失败时系统会提示账号或密码错误。",
  "citations": [
    {
      "source": "需求文档",
      "section": "登录流程",
      "quote": "密码错误时提示账号或密码错误"
    }
  ],
  "confidence": "high",
  "missingInfo": []
}
```

这种结构可以让程序继续做：

- 引用展示
- 置信度判断
- 缺失信息提示
- 答案审核
- 回归测试

在知识库问答里，结构化输出可以帮助控制幻觉。

## 15. 常见错误

### 15.1 只说“输出 JSON”

只要求 JSON 还不够，还要说明字段、类型、空值、枚举、数量限制。

更好的写法：

```text
只输出 JSON object，字段包括 title、priority、steps。priority 只能是 P0、P1、P2、P3。steps 必须是字符串数组。
```

### 15.2 字段名经常变化

例如一会儿叫 `expectedResult`，一会儿叫 `expect_result`，一会儿叫 `预期结果`。

字段名应该提前固定。

### 15.3 输出里混入解释文字

错误输出：

```text
下面是你要的 JSON：
{
  "name": "张三"
}
```

这会增加解析成本。应明确要求：

```text
只输出 JSON，不要输出任何解释、前缀、后缀或 Markdown 代码块。
```

### 15.4 没有校验

仅依赖 Prompt 约束风险很高。AI 可能偶尔输出错误格式，程序必须校验。

### 15.5 Schema 太复杂

初学阶段不要一开始设计过深的嵌套结构。结构越复杂，模型越容易出错，调试成本也越高。

可以先从扁平对象开始，再逐步增加数组和嵌套对象。

## 16. 实战练习

可以按下面顺序练习。

### 练习一：文本信息抽取

输入一段用户介绍，让 AI 输出：

```json
{
  "name": "string",
  "age": "number | null",
  "city": "string | null",
  "job": "string | null"
}
```

目标：熟悉固定字段和空值处理。

### 练习二：测试用例结构化

输入一段需求，让 AI 输出测试用例数组：

```json
[
  {
    "title": "string",
    "priority": "P0 | P1 | P2 | P3",
    "category": "正常场景 | 异常场景 | 边界场景",
    "steps": ["string"],
    "expectedResult": "string"
  }
]
```

目标：熟悉数组、枚举值和统一对象结构。

### 练习三：错误日志结构化

输入错误日志，让 AI 输出：

```json
{
  "errorType": "string",
  "keyMessage": "string",
  "possibleCauses": ["string"],
  "nextChecks": ["string"]
}
```

目标：把排障结果变成可跟踪数据。

### 练习四：文章大纲结构化

输入一个主题，让 AI 输出：

```json
{
  "title": "string",
  "summary": "string",
  "sections": [
    {
      "heading": "string",
      "points": ["string"]
    }
  ]
}
```

目标：用结构化方式生成写作骨架。

### 练习五：写一个校验器

用 Zod 或 Pydantic 校验 AI 输出。

目标：

- 解析成功时输出结构化对象
- 解析失败时打印错误原因
- 尝试让 AI 根据错误信息修复输出

## 17. 阶段验收标准

学完这一章，可以用下面的问题检查自己：

- 我能不能设计稳定字段名？
- 我能不能区分 string、number、boolean、array、object？
- 我能不能规定必填字段和可空字段？
- 我能不能用枚举值限制模型输出？
- 我能不能写出简单 JSON Schema？
- 我能不能用 Zod 或 Pydantic 校验 AI 输出？
- 我能不能处理 JSON 解析失败？
- 我能不能让 AI 根据校验错误修复结果？

如果这些问题大多数都能做到，Structured Output 阶段就具备了继续学习 Tool Calling 的基础。

## 18. 本章总结

Structured Output 的核心是让 AI 输出稳定、可解析、可校验的数据。

这一章需要掌握：

- JSON 输出
- 字段设计
- 类型约束
- JSON Schema
- 输出校验
- 失败重试
- 格式修复
- 空值处理
- 枚举值设计

Prompt 让 AI 听懂任务，Structured Output 让 AI 的结果进入程序流程。

掌握这一章后，后续学习 Tool Calling、RAG、Agent、MCP 都会更顺畅。因为这些能力都依赖稳定的数据结构、清晰的参数设计和可靠的输出校验。

