---
title: '阶段 1 · 上下文工程——决定 Claude Code 上限的核心内功'
draft: false
---

> 你能给 Claude 多少准确的上下文、以多低的 token 成本维持它，直接决定了每个会话的质量天花板。

---

## 这篇你会学到

- CLAUDE.md 五层分层机制：企业级 / 用户级 / 项目级 / 本地级 / 子目录级，各自加载时机和优先级
- `@path` 导入语法与 `.claude/rules/` 路径范围规则的组织方式
- Auto-memory 自动记忆：Claude 工作时如何为自己做笔记、存在哪里、加载多少
- `/memory`、`#` 快捷写入、手动编辑记忆的正确姿势
- 上下文窗口的三层结构与 `/context` 实时查看
- `/compact` 手动压缩 vs 自动压缩触发，`/clear` 的适用场景
- Prompt caching 原理、命中条件、哪些操作会破坏缓存、如何验证缓存健康度
- 高质量 CLAUDE.md 的范例结构（可直接照搬）

---

## 为什么重要

每个 Claude Code 会话都从零开始——模型不记得上次的任何东西。决定它"记得多少"的，是你在会话开始前注入了什么上下文，以及会话过程中这些上下文是否还存活在窗口里。

进阶开发者常见的失效模式有三种：

1. **CLAUDE.md 写得太随意**：塞满废话，真正有用的约定淹没在噪音里，Claude 遵循率下降。
2. **不懂 prompt caching**：会话中途切换模型、随手 `/compact`，结果每个回合都在重算 10 万 token 的历史，费钱还慢。
3. **不用 auto-memory**：每个新会话都要重新交代同样的背景，重复劳动。

把这三件事做对，你的 Claude Code 使用质量会出现量级跳跃。

---

## 核心概念

### 1. CLAUDE.md 分层机制

#### 五个层级与加载顺序

按**从最宽到最窄**排列，所有发现的文件拼接注入上下文，后面的文件在上下文中靠后出现（优先级更高）：

| 层级 | 路径（Windows） | 作用 | 共享范围 |
|------|----------------|------|----------|
| **托管策略** | `C:\Program Files\ClaudeCode\CLAUDE.md` | IT/DevOps 统一下发，不可被个人排除 | 机器上所有用户 |
| **用户级** | `%USERPROFILE%\.claude\CLAUDE.md`（即 `~/.claude/CLAUDE.md`） | 跨所有项目的个人偏好 | 你本人的所有项目 |
| **项目级** | `.\CLAUDE.md` 或 `.\.claude\CLAUDE.md` | 团队共享的项目约定，提交到版本控制 | 通过 git 共享给团队 |
| **本地级** | `.\CLAUDE.local.md` | 个人项目特定偏好，加入 `.gitignore` | 仅你自己 |
| **子目录级** | 任意子目录下的 `CLAUDE.md` | 按需加载，仅在 Claude 读取该目录文件时触发 | 同项目，按目录隔离 |

**关键加载逻辑**：

- Claude Code 从当前工作目录**向上遍历**目录树，找到的每个 `CLAUDE.md` / `CLAUDE.local.md` 都被拼接注入，父目录先于子目录。
- 项目根目录和祖先目录的 CLAUDE.md 在**启动时全量加载**。
- 子目录 CLAUDE.md **按需加载**：Claude 读取该子目录中的文件时才触发。
- CLAUDE.local.md 紧跟同级 CLAUDE.md 之后加载（个人笔记优先覆盖）。

实例：你在 `D:\proj\src\` 下启动 Claude Code，它会依次加载：
```
C:\Program Files\ClaudeCode\CLAUDE.md   (托管策略，如存在)
~/.claude/CLAUDE.md                      (用户级)
D:\CLAUDE.md                             (如存在)
D:\proj\CLAUDE.md                        (如存在)
D:\proj\CLAUDE.local.md                  (如存在)
D:\proj\src\CLAUDE.md                    (如存在)
D:\proj\src\CLAUDE.local.md              (如存在)
```

#### 写有效指令的准则

**大小控制**：每个 CLAUDE.md 目标 **200 行以内**。超过这个阈值，上下文消耗增加且遵循率下降。

**具体性原则**（最重要）：
```markdown
# 好的写法
- 使用 2 空格缩进（TypeScript/JSON）
- 提交前运行 `pnpm test`
- API 处理器位于 `src/api/handlers/`

# 低效写法
- 正确格式化代码
- 测试你的更改
- 保持文件有组织
```

**一致性检查**：跨多个 CLAUDE.md 文件存在冲突指令时，Claude 会任意选择其一。要定期用 `/memory` 审查所有已加载文件。

**HTML 注释技巧**：块级 HTML 注释在注入上下文前会被剥离，适合留给人类维护者的说明，不消耗 token：

```markdown
<!-- 维护者注意：下方规则 2024-12 更新，因迁移到 pnpm workspace 架构 -->
- 使用 pnpm，禁止使用 npm install
```

> 注意：代码块内的注释会被保留。

---

### 2. `@path` 导入与 `.claude/rules/` 规则组织

#### @path 导入语法

在 CLAUDE.md 任意位置用 `@路径` 引用其他文件，启动时展开加载：

```markdown
# 项目概述请参阅 @README.md
# 可用命令见 @package.json

## 工作流规范
- Git 操作规范: @docs/git-workflow.md
- 发布流程: @docs/release-checklist.md
```

规则：
- 相对路径相对于**包含导入的文件**解析，不是工作目录。
- 支持递归导入，最深 **4 跳**。
- 首次遇到外部导入时会弹出批准对话框，拒绝后该导入永久禁用。
- 导入的文件**同样在启动时全量加载**，不能用来节省上下文——分割为导入仅解决组织问题。

**在 worktree 间共享个人指令**（Windows 用绝对路径）：

```markdown
# CLAUDE.local.md
- @C:\Users\你的用户名\.claude\my-project-prefs.md
```

#### `.claude/rules/` 路径范围规则

适合大型项目——把指令拆分为模块化文件，可按文件路径条件加载：

```
your-project/
├── .claude/
│   ├── CLAUDE.md           # 主项目指令
│   └── rules/
│       ├── code-style.md   # 代码风格（无 frontmatter → 启动时全量加载）
│       ├── testing.md      # 测试约定
│       └── api-design.md   # 只在读取 API 文件时加载（有 paths frontmatter）
```

**带路径条件的规则**（带 `paths` frontmatter 的只在匹配文件时注入）：

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/api/**/*.test.ts"
---

# API 开发规则

- 所有端点必须包含输入验证
- 使用标准错误响应格式 `{ error: string, code: number }`
- 包含 OpenAPI 文档注释
```

常用 glob 模式：

| 模式 | 匹配范围 |
|------|----------|
| `**/*.ts` | 所有目录下的 TypeScript 文件 |
| `src/**/*` | src/ 目录下所有文件 |
| `src/**/*.{ts,tsx}` | src/ 下的 TS/TSX 文件 |
| `*.md` | 项目根目录的 Markdown 文件 |

**用户级全局规则**（适用所有项目）：

```
~/.claude/rules/
├── preferences.md    # 个人编码偏好
└── workflows.md      # 惯用工作流
```

用户级规则在项目规则前加载，因此项目规则优先级更高。

**在 monorepo 中排除无关的 CLAUDE.md**：

```json
// .claude/settings.local.json
{
  "claudeMdExcludes": [
    "**/monorepo/CLAUDE.md",
    "/path/to/other-team/.claude/rules/**"
  ]
}
```

---

### 3. Auto-memory 自动记忆机制

#### 它是什么

Auto-memory 让 Claude 在工作中**为自己做笔记**，跨会话积累知识。你什么都不用写，Claude 自己决定什么值得记住：构建命令、调试经验、架构决策、代码风格偏好、工作流习惯。

> 版本要求：Claude Code v2.1.59+，用 `claude --version` 确认。

#### 存储位置与结构

每个 git 仓库共享一个记忆目录（同一仓库的所有 worktree 和子目录共享）：

```
~/.claude/projects/<project>/memory/
├── MEMORY.md          # 简洁索引，每次会话加载（前 200 行或 25KB）
├── debugging.md       # 调试模式详细笔记（按需读取）
├── api-conventions.md # API 设计决策
└── ...                # Claude 自动创建的主题文件
```

**加载规则**：
- `MEMORY.md` 的前 **200 行或 25KB**（以先到为准）在每个会话开始时注入。
- 主题文件（如 `debugging.md`）**启动时不加载**，Claude 在需要时按需读取。
- 自动记忆是**机器本地的**，不跨机器同步。

#### 启用 / 禁用

默认开启。关闭方式：

```json
// settings.json（项目或用户级）
{
  "autoMemoryEnabled": false
}
```

或临时禁用（环境变量）：
```powershell
$env:CLAUDE_CODE_DISABLE_AUTO_MEMORY = "1"
claude
```

自定义存储目录：
```json
{
  "autoMemoryDirectory": "C:/Users/你的用户名/my-claude-memory"
}
```

#### 查看与编辑记忆

运行 `/memory`，会列出当前会话加载的所有文件：CLAUDE.md、CLAUDE.local.md、规则文件，以及自动记忆文件夹链接。选择任意文件可在编辑器中打开。

**`#` 快捷写入**：在对话中以 `#` 开头的消息，Claude 会直接将其写入记忆，不用解释，不用多余确认：

```
# 这个项目的测试命令是 pnpm test:unit，集成测试是 pnpm test:e2e
# API 调用需要本地运行 Redis（端口 6379）
# 代码审查前必须运行 pnpm lint:fix
```

这是最高效的向记忆写入的方式，适合你想立刻固化下来的事实。

**让 Claude 记住某事**：直接说"记住……"，Claude 写入自动记忆。要写入 CLAUDE.md，明确说"将这条加入 CLAUDE.md"。

---

### 4. 上下文窗口构成与 `/context`

#### 三层结构

每次 API 请求，Claude Code 按如下顺序打包内容：

| 层 | 包含内容 | 变化时机 |
|------|---------|---------|
| **系统提示层** | 核心指令、工具定义、输出样式 | 工具集变更或 Claude Code 升级时 |
| **项目上下文层** | CLAUDE.md、auto-memory、无范围规则 | 会话开始，或 `/clear` / `/compact` 之后 |
| **对话层** | 你的消息、Claude 的响应、工具结果 | 每个回合 |

**查看当前上下文**：

```
/context
```

返回按类别的实时 token 使用量和优化建议。这是最直接的"诊断上下文健康度"工具。

---

### 5. `/compact` 手动压缩、自动压缩与 `/clear`

#### `/compact` 手动压缩

`/compact` 用结构化摘要替换对话历史，释放上下文空间。理解它的关键是知道**哪些内容在压缩后存活**：

| 机制 | 压缩后状态 |
|------|-----------|
| 系统提示和输出样式 | 完整保留（不是消息历史的一部分） |
| 项目根目录 CLAUDE.md 和无范围规则 | 从磁盘**重新注入** |
| Auto-memory | 从磁盘**重新注入** |
| 带 `paths:` frontmatter 的规则 | **丢失**，等下次读取匹配文件时重新加载 |
| 子目录中的嵌套 CLAUDE.md | **丢失**，等下次读取该子目录文件时重新加载 |
| 已调用的 Skill 内容 | 重新注入，每个 skill 上限 5000 token，总计 25000 token |

**压缩本身的成本**：压缩时 Claude Code 先发一个"生成摘要"请求，这个请求**命中现有缓存**（共享同一前缀），成本很低。压缩的耗时主要在生成摘要的推理，不是缓存未命中。随后的回合因历史更短，反而更快更便宜。

**最佳实践**：在**任务之间的自然断点**主动运行 `/compact`，不要等到自动压缩在任务中途触发。自动压缩在上下文窗口快满时触发，时机由系统决定。

#### `/clear` 完全清空

`/clear` 清除整个对话历史，重新开始一个全新会话。适用场景：

- 走上了完全错误的路，想彻底放弃当前路线
- 任务已完成，开始一个完全不相关的新任务
- 上下文被大量无关内容污染

与 `/compact` 的区别：`/compact` 保留摘要，连续性更好；`/clear` 彻底清除，成本最低，但之前的上下文全部丢失。

> `/rewind` 补充：回退到对话中某个更早的回合，截断其后的所有历史。它回退到已缓存的前缀，不像压缩那样构建新前缀，缓存友好。

---

### 6. Prompt Caching 原理与实战

#### 它如何工作

没有缓存时，每个回合 API 都要重新处理完整的对话历史。有了缓存，API 将每个请求的**前缀**与最近处理过的内容精确匹配——匹配到的部分按**标准输入价格约 10%** 计费，只对末尾的新内容按正常价格计费。

**关键约束**：匹配是**精确前缀匹配**，前缀中任何地方的变化都会使其后的所有内容缓存失效。没有按文件或按段的粒度缓存。

#### 缓存 TTL

| 认证方式 | 默认 TTL | 一小时 TTL |
|---------|---------|-----------|
| Claude 订阅 | **自动 1 小时 TTL**（包含在计划内，不额外收费） | 默认即是 |
| API Key / Bedrock / Vertex | 5 分钟 | 设置 `ENABLE_PROMPT_CACHING_1H=1` |

订阅用户如超过用量上限使用额度计费，系统自动降回 5 分钟 TTL。

#### 会破坏缓存的操作（重要！）

这些操作让下一个回合的缓存完全未命中，触发全量重算：

| 操作 | 原因 |
|------|------|
| **切换模型** `/model` | 每个模型有独立的缓存，内容相同也不共享 |
| **切换工作量级别** `/effort` | 工作量级别也是缓存键的一部分 |
| **启用快速模式** | 添加了作为缓存键一部分的请求头 |
| **连接/断开 MCP 服务器**（工具加载到前缀时） | 工具定义在系统提示层，变更使整体失效 |
| **拒绝整个工具**（如禁用 Bash） | 改变了系统提示层中的工具定义集 |
| **`/compact`** | 设计上使对话层失效，但摘要请求本身命中缓存 |
| **升级 Claude Code** | 系统提示或工具定义通常随版本更新 |
| **升级后恢复会话** | 历史记录在新系统提示后面，前缀不匹配 |

**特别注意 `opusplan` 模式**：使用 `opusplan` 设置时，Plan Mode 用 Opus，执行用 Sonnet，每次切换都是模型切换，每次都破坏缓存。

#### 不会破坏缓存的操作

| 操作 | 原因 |
|------|------|
| 编辑仓库中的文件 | 文件内容只在 Claude 读取时进入上下文，附加在对话末尾 |
| 会话中期编辑 CLAUDE.md | 会话中加载的是开始时的版本，中途编辑不触发重算（也不生效，需下次 `/clear`/`/compact` 后才更新） |
| 更改权限模式 | 不改变系统提示或工具定义 |
| 调用 Skill 和命令 | 在调用点附加为用户消息，不改变之前的内容 |
| 运行 `/recap` | 附加摘要为命令输出，不替换历史 |
| `/rewind` | 截断回已缓存前缀，保持缓存 |

#### 验证缓存健康度

用状态行脚本或在每个响应里观察两个字段：

- `cache_creation_input_tokens`：本回合写入缓存的 token（按缓存写入价格计费）
- `cache_read_input_tokens`：本回合命中缓存读取的 token（约标准价格 10%）

**高 read / 低 creation 比率 = 缓存运转正常**。如果 creation 在连续回合间持续偏高，说明前缀在频繁变化，检查上面的"破坏缓存"清单。

---

## 实操示例

### 示例 1：高质量项目 CLAUDE.md 范例结构

以下是一个 TypeScript 全栈项目的 CLAUDE.md 范例，可作为模板直接修改：

```markdown
<!-- 维护者：此文件目标 200 行内，超出请拆到 .claude/rules/ -->

# 项目名称：YourApp

## 快速参考
- 项目概述: @README.md
- 所有可用命令: @package.json

## 技术栈与架构
- 前端: React 18 + TypeScript + Vite
- 后端: Node.js + Express + Prisma
- 数据库: PostgreSQL 15
- 测试: Vitest（单测）+ Playwright（E2E）
- API 层位于 `src/api/`，前端页面位于 `src/pages/`，共享类型位于 `src/types/`

## 开发环境
- 包管理器: pnpm（禁止使用 npm / yarn）
- Node 版本: 20.x（见 .nvmrc）
- 开发服务器: `pnpm dev`（前端 3000，后端 3001）
- 数据库迁移: `pnpm prisma migrate dev`

## 编码规范
- TypeScript strict 模式，禁止 `any`（除非有注释说明原因）
- 使用 2 空格缩进
- 导入顺序: Node 内置 → 第三方 → 内部模块
- 组件文件名: PascalCase；工具函数: camelCase
- 禁止使用 `console.log`（用 `logger` 工具，位于 `src/utils/logger.ts`）

## 测试规范
- 业务逻辑（use case、repository、纯函数）写单测
- 纯 UI 展示层不写单测
- 运行单测: `pnpm test:unit`
- 运行 E2E: `pnpm test:e2e`（需要本地 PostgreSQL 运行）
- 提交前必须通过: `pnpm lint && pnpm test:unit`

## Git 工作流
- 主分支: main（不直接推送，通过 PR 合并）
- 分支命名: `feat/`, `fix/`, `chore/` 前缀
- Commit 信息用英文，格式: `type(scope): description`
- PR 合并前必须有至少一个 reviewer 审批

## 常见问题
- Prisma 客户端类型报错: 先运行 `pnpm prisma generate`
- 端口冲突: 检查 3000/3001 是否被占用
- 环境变量: 复制 `.env.example` 为 `.env.local`，填入真实值
```

### 示例 2：`.claude/rules/` 路径范围规则（PowerShell 操作）

```powershell
# 创建规则目录
New-Item -ItemType Directory -Force .\.claude\rules

# 创建 API 专用规则
@'
---
paths:
  - "src/api/**/*.ts"
---

# API 层开发规则

- 所有路由处理器必须用 `validateInput(schema)` 中间件
- 错误响应统一格式: `{ error: string, code: string, details?: unknown }`
- 使用 `src/api/middleware/auth.ts` 的 `requireAuth` 保护需要认证的路由
- 禁止在路由层直接操作数据库，必须通过 Repository 层
'@ | Set-Content -Encoding utf8 .\.claude\rules\api-design.md
```

### 示例 3：查看记忆状态

```
/memory
```

输出示例（列出所有已加载文件）：
```
加载的 CLAUDE.md 文件:
  C:\Users\you\.claude\CLAUDE.md
  D:\proj\CLAUDE.md
  D:\proj\.claude\rules\code-style.md（无范围规则）

自动记忆: 已启用
  目录: C:\Users\you\.claude\projects\proj\memory\
  MEMORY.md: 已加载（前 200 行）
```

### 示例 4：验证 prompt caching 状态

在 `~/.claude/settings.json` 中配置状态行显示 token 信息：

```json
{
  "statusline": {
    "format": "{model} | in:{input_tokens} cached:{cache_read_input_tokens} | out:{output_tokens}"
  }
}
```

正常会话中，`cache_read_input_tokens` 应该在第二个回合起就显著大于 `cache_creation_input_tokens`。

---

## 动手练习

### 练习 1：审计你的 CLAUDE.md 层级

打开一个有项目的终端，启动 Claude Code 并运行：

```
/memory
```

查看列出的所有已加载文件。然后回答：
- 用户级 `~/.claude/CLAUDE.md` 存在吗？里面是什么？
- 项目级 CLAUDE.md 超过 200 行了吗？
- 有没有跨文件的冲突指令？

动手：把现有 CLAUDE.md 中超过 200 行的部分拆到 `.claude/rules/` 的主题文件里。

### 练习 2：用 `#` 快捷写入建立项目记忆

在一个真实项目的 Claude Code 会话中，连续发送三条 `#` 开头的消息：

```
# 这个项目的测试命令是 pnpm test
# 数据库连接配置在 .env.local 的 DATABASE_URL 字段
# 部署到 staging: 推送到 develop 分支触发 CI
```

然后运行 `/memory` 找到自动记忆目录，打开 `MEMORY.md` 验证这三条已经被写入。

### 练习 3：用路径范围规则减少上下文噪音

在一个前后端混合项目中，创建一个只在读取前端文件时生效的规则：

```markdown
---
paths:
  - "src/components/**/*.tsx"
  - "src/pages/**/*.tsx"
---

# React 组件规范
- 使用函数组件，禁止 class 组件
- Props 类型单独定义为 `interface ComponentNameProps`
- 使用 TailwindCSS，禁止内联 style
```

然后在会话中先读取一个后端文件（规则不触发），再读取一个组件文件，用 `/context` 观察 token 变化。

### 练习 4：定位缓存失效来源

发起一个较长会话（至少 5 个回合），然后：

1. 观察第 2 回合起 `cache_read_input_tokens` 是否稳定增长
2. 中途运行 `/model` 切换到另一个模型再切回来
3. 观察切换后第一个回合的 `cache_creation_input_tokens` 是否出现峰值

记录你观察到的 token 数字变化。

### 练习 5：为一个新项目完整初始化上下文体系

选择你手头的一个真实项目，按以下步骤初始化：

1. 运行 `/init` 自动生成基础 CLAUDE.md（需要 `CLAUDE_CODE_NEW_INIT=1` 启用交互式流程）
2. 审查并精简生成的内容到 200 行内
3. 把重复性的规则提取到 `.claude/rules/` 的主题文件
4. 创建 `CLAUDE.local.md` 写入只有你自己用的信息（沙箱 URL、测试账号等），加入 `.gitignore`
5. 用 `#` 快捷写入三条立刻有用的记忆

---

## 常见坑与注意事项

**坑 1：会话中期编辑 CLAUDE.md 以为立刻生效**
会话中期对 CLAUDE.md 的编辑不会使缓存失效，也不会立刻生效。Claude 继续使用会话开始时加载的版本。必须等下次 `/clear`、`/compact` 或重启后才更新。对于"立刻生效"的需求，用 `#` 快捷写入自动记忆，或直接在对话里告诉 Claude。

**坑 2：用 @path 导入以为可以省 token**
导入的文件在启动时全量展开。`@README.md` 如果是一个 5000 行的文件，这 5000 行全部进入上下文。只导入真正需要每次加载的内容；对于参考性文档，考虑用 `.claude/rules/` 的路径范围规则按需加载。

**坑 3：长会话里切换模型**
会话进行到一半时切换模型，整个对话历史的缓存全部失效，下一回合全量重算。成本与会话长度成正比。在会话开始就确定模型，任务间断点再切换。

**坑 4：子目录 CLAUDE.md 在 `/compact` 后消失**
路径范围规则和子目录 CLAUDE.md 是在对话历史里作为消息存在的，`/compact` 会把它们压缩进摘要。压缩后它们不会自动重新注入，需要等 Claude 下次读取对应目录的文件时重新触发。如果这些规则很重要，把它们移到项目根目录 CLAUDE.md 里。

**坑 5：auto-memory 被误以为是 CLAUDE.md**
MEMORY.md 有 200 行 / 25KB 的加载上限，超出部分启动时不加载。Claude 需要时会按需读取主题文件，但你不能依赖主题文件的内容"一定在上下文里"。对于必须每个会话都遵循的规则，放在 CLAUDE.md，MEMORY.md 用来记录"Claude 发现的模式和偏好"。

**坑 6：Windows 路径中的反斜杠**
`@path` 导入在 Windows 下建议用正斜杠（`@docs/git-workflow.md`），更可靠。创建符号链接需要管理员权限或开发者模式，推荐用 `@` 导入代替 `ln -s`。

---

## 掌握标志（自测清单）

- [ ] 能说出 CLAUDE.md 的五个层级，以及各自的加载时机
- [ ] 知道子目录 CLAUDE.md 何时加载、`/compact` 后是否还在
- [ ] 能用 `@path` 语法导入外部文件，知道其 token 影响
- [ ] 配置过至少一条带 `paths:` frontmatter 的路径范围规则
- [ ] 用过 `#` 快捷写入，验证过内容出现在 MEMORY.md 里
- [ ] 用 `/memory` 审查过自己的记忆文件，并手动清理过无用内容
- [ ] 能解释 prompt caching 的三层结构（系统提示 / 项目上下文 / 对话）
- [ ] 知道至少 3 个会破坏缓存的操作，并能解释原因
- [ ] 知道在 Claude 订阅下 TTL 是多少（1 小时），API Key 下默认是多少（5 分钟）
- [ ] 在真实项目中维护过一份 200 行内、具体有效的 CLAUDE.md

---

## 延伸阅读

**官方文档**
- [存储指令和记忆（记忆系统完整文档）](https://code.claude.com/docs/zh-CN/memory)
- [探索上下文窗口（上下文可视化与压缩细节）](https://code.claude.com/docs/zh-CN/context-window)
- [Claude Code 如何使用 prompt caching（缓存完整文档）](https://code.claude.com/docs/zh-CN/prompt-caching)
- [Prompt caching API 底层机制（定价与断点）](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

**系列其他篇章**
- 上一篇：[00-foundations.md](/books/claude-code-advanced/00-foundations/) — 环境搭建与核心概念
- 下一篇：[02-workflow-and-sessions.md](/books/claude-code-advanced/02-workflow-and-sessions/) — 工作流与会话管理
- 延伸阅读：[03-customization-and-extensions.md](/books/claude-code-advanced/03-customization-and-extensions/) — Skills、Hooks 与深度定制
- 延伸阅读：[04-mcp-and-tools.md](/books/claude-code-advanced/04-mcp-and-tools/) — MCP 服务器与工具扩展
- 延伸阅读：[05-multi-agent-orchestration.md](/books/claude-code-advanced/05-multi-agent-orchestration/) — 多智能体编排

