---
title: 'Claude Code 开源平替：手把手搭建OpenCode开发环境实践指南'
published: 2026-02-19T16:51:56.810Z
description: 'OpenCode 是一个完全免费、开源的 Claude Code 替代品。它不仅共享 Claude 的技能生态，更通过解除模型绑定，将AI编程能力从单一平台中解放出来。'
image: ''
tags: []
draft: false
lang: ''
---


![v2-3430f7b8e35cc55fa0acc6b28ce12170_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-1.jpg)


OpenCode 是一个完全免费、开源的 Claude Code 替代品。它不仅共享 Claude 的技能生态，更通过解除模型绑定，将AI编程能力从单一平台中解放出来。


OpenCode兼容ClaudeCode核心工作范式：


#技能兼容：绝大多数为 Claude Code 开发的技能（.skill 包）可直接或稍加修改后运行。


#工作流继承：保留了“用自然语言描述任务 → AI分解执行 → 输出结果”的高效交互模式。


#体验增强：通过安装 Oh My OpenCode (OMO) 等插件，用户能获得比原生 Claude Code 更强大的多智能体协作体验。


一、OpenCode安装部署


1，安装OpenCode：


```shell
curl -fsSL https://opencode.ai/install | bashsource~/.bashrc
# 或 
source ~/.zshrcopencode --version # 验证安装
```


![v2-91f9b2bc3ef87ffeaa33a07741c898da_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-2.jpg)


2，OpenCode桌面安装


`https://opencode.ai/download`


![v2-f56cbc6b46d175c4771e91610a301b78_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-3.jpg)

> 下载后安装启动

![v2-255e19eb38b5162096a60bfce259292a_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-4.jpg)

>  已设置好模型

![v2-14da6bd03ee40695150b675a75aeb560_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-5.jpg)


3，opencode扩展安装


![v2-c9dfb96fbafbac49257c25dee02c13af_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-6.jpg)


# 插件市场搜索 opencode 安装


![v2-3b91780a8192bbde2820eeb0ddd18a93_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-7.jpg)


# vscode中使用


![v2-0bc0f47a247169447d072a90bd2e7555_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-8.jpg)


二、opencode使用指南


1，opencode启动


# 输入 opencode 进入


`opencode`


![v2-efd7c80ef2be4deea6a973769ed5035f_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-9.jpg)


#输入/ 出现命令提示


![v2-cc67c5509e2aa98f19131ec0c394aca7_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-10.jpg)

- `/init create/update AGENTS.md`
- `/review review changes [commit|branch|pr], defaults to uncommitted`
- `/new create a new session`
- `/models list models`
- `/agents list agents`
- `/session list sessions`
- `/status show status`
- `/mcp toggle MCPs`
- `/theme toggle theme`
- `/editor open editor`
- `/connect connect to a provider`
- `/help showhelp`
- `/commands show all commands`
- `/exit exit the app`
> opencode命令说明：
<details>
<summary>`会话与工作流管理`</summary>

`/new 创建全新的会话，开始一个独立的新任务或项目时使用，会话间隔离。`


`/session 列出所有会话，查看历史会话列表，并可以切换回之前的会话。`


`/exit 退出应用 结束当前OpenCode进程。` 


</details>

<details>
<summary>`AI模型与代理管理`</summary>

`/models 列出所有可用模型，查看并切换当前使用的AI模型（如GLM-4.7, [GPT-4](https://zhida.zhihu.com/search?content%5Fid=268969940&content%5Ftype=Article&match%5Forder=1&q=GPT-4&zhida%5Fsource=entity)）。输入后会弹出选择列表。`


`/agents 列出所有可用代理，如果你安装了OMO等框架，此命令展示可用的专业代理角色（如架构师、前端工程师）。`


`/connect 连接外部模型提供商 配置你自己的API密钥（如OpenAI, Anthropic），以使用订阅的模型。`


`/mcp 切换MCP服务器 启用或禁用“模型上下文协议”服务器。MCP是让AI模型能使用外部工具（如搜索、读文件）的桥梁。`


</details>

<details>
<summary>`开发与协作`</summary>

`/init 创建/更新 AGENTS.md 文件，这是多Agent协作的配置文件。首次运行会生成，定义各个AI代理的角色、任务和协作流程。`


`/review 审查代码变更 AI辅助Code Review。可指定审查 未提交的更改、某个提交、分支差异或PR。示例：`


`/review main (对比当前与main分支)。`


`/editor 打开代码编辑器，快速跳转到系统默认编辑器，用于直接修改复杂代码或配置文件。`


</details>

<details>
<summary>`系统与帮助`</summary>

`/status 显示当前状态，查看当前会话的摘要信息：如当前模型、活跃的MCP、项目上下文等。`


`/theme 切换界面主题，在深色/浅色模式之间切换。`


`/help 显示帮助信息，查看基础的帮助文档。`


`/commands 显示所有命令列表，就是你当前看到的这个列表，方便随时查阅。`


</details>


# 环境变量设置：（claude code生态共享）


说明：opencode环境可通过设置环境变量共享或关闭claude code skill


`OPENCODE_DISABLE_CLAUDE_CODE 布尔值，禁用 .claude 的读取（提示词 + 技能）  OPENCODE_DISABLE_CLAUDE_CODE_PROMPT 布尔值，禁用读取 ~/.claude/CLAUDE.md OPENCODE_DISABLE_CLAUDE_CODE_SKILLS 布尔值，禁用加载 .claude/skills`


2，选择模型（交互模式）：


# 选择模型：进入 opencode 交互界面后，通过斜杠命令查看并切换模型


`/models`


系统会列出所有可用模型（如 GLM-4.7、GPT-4o 等），按提示选择


![v2-d661c666cf1b83d826f18acc5a187dc7_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-11.jpg)


![v2-c0bc12217b9d38dcb4876cfaab850081_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-12.jpg)


注意：交互模式仅本次有效，下次重启需要重新选择模型


3，指定模型启动：使用 --model 参数（推荐，最直接）：


`# 指定GLM-4.7启动
opencode --model glm-4.7`


在启动opencode时，直接通过参数指定本次会话使用的模型。


![v2-cfd63dca5bd88fba65fa1cfb64d5bb78_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-13.jpg)


![v2-b9701294554b9d8d57d3acaa611043e0_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-14.jpg)


4，设置全局默认模型


说明：OpenCode没有设置“全局默认模型”命令，OpenCode的设计倾向于为每个项目或任务灵活选择最合适的模型，而非固定一个全局默认值。


解决方法：


方式一：创建启动命名脚本，每次运行此脚本启动


start-opencode.sh


`#!/bin/bash 
opencode --model glm-4.7`


方式二：使用系统别名：


在你的Shell配置文件（如 ）中，创建快捷命令：


# 编辑shell配置文件（~/.zshrc 或 ~/.bashrc）


`vi ~/.zshrc`


#添加一行别名


`alias myopencode='opencode --model glm-4.7'`


保存后执行


`source ~/.zshrc`


之后只需输入 myopencode 就会自动用GLM-4.7模型启动


`myopencode`


三、oh-my-opencode插件安装配置


![v2-7e59c8caa6febfc727c7433ce98a68cd_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-15.jpg)


`https://github.com/code-yeongyu/oh-my-opencode`


1，oh-my-opencode安装


# 安装Bun
`curl -fsSL` [`https://bun.sh/install`](https://bun.sh/install) `| bash`


# 验证Bun安装


bun --version


# 安装Oh My OpenCode (根据你的模型订阅调整参数)`


`npm install oh-my-opencode-linux

bunx oh-my-opencode install --no-tui --claude=no --copilot=no --gemini=no`


# npx安装（备用方案）


npx oh-my-opencode install


# 有订阅的用户安装说明


`#用户拥有所有max20的订阅：
bunx oh-my-opencode install --no-tui --claude=max20 --copilot=yes --gemini=yes
#用户只有Claude（没有max20）：
bunx oh-my-opencode install --no-tui --claude=yes --copilot=no--gemini=n
#用户无需订阅：
bunx oh-my-opencode install --no-tui --claude=no --copilot=no--gemini=no`


![v2-21c98d2bb935064d137033f53edafd92_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-16.jpg)


![v2-ab741be9bb6f32faac4ca74673ade4c8_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-17.jpg)


2，oh-my-opencode插件配置


# opencode配置


`vi ~/.config/opencode/opencode.json`


![v2-7592bfb9988953fb9db278925ed28840_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-18.jpg)


#oh-my-opencode配置


`vi ~/.config/opencode/oh-my-opencode.json`


![v2-84ef88fa6c0af2d417bfd76741b00726_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-19.jpg)


# Oh My OpenCode Agent说明：

- Sisyphus：项目经理 / 主控 、任务总指挥；负责拆解复杂任务、制定计划、并行调度所有子智能体，并整合最终交付物。以“待办清单”驱动整个工作流。
- Oracle：首席架构师、技术决策者；负责系统架构设计、核心代码审查、技术选型和解决最棘手的逻辑与调试问题。
- Librarian：研究专员、知识库与情报员；深入分析代码库、检索文档、在GitHub上寻找实现范例，提供基于证据的解决方案。
- Explore：侦察员、快速侦察兵；擅长快速遍历代码库、匹配模式、理解项目结构和功能分布。
- Frontend Engineer：前端专家、设计师兼开发者；负责创造美观、实用的用户界面，产出高质量的HTML/CSS/JSX代码，用户体验驱动。
- Document Writer：技术作家、文档专家；将复杂的技术概念转化为清晰、流畅的文档、说明和报告。
- Multimodal Looker：视觉分析员、图像与内容分析师；解读PDF、图表、截图等视觉信息，从中提取结构化数据或理解其内容。

3，opencode中查看使用


说明：Oh My OpenCode 核心功能是引入Sisyphus（OpenCode人工智能编排器），通过Sisyphus Agent，将 AI从“一个全能但可能不专精的助手”，变成了一个由顶尖专家组成的、可精确指挥的智能团队。


# 安装前查看 /agents


![v2-a6b21336cc7b0d74661e328607225acb_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-20.jpg)


# 安装oom插件后 /agents 查看


![v2-79c515ade99eb8136dd0e014b9a7b97c_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-21.jpg)


4，Oh My OpenCode使用测试


# 进入vscode的opencode插件，确认插件已安装


![v2-4b80934f186a6910fc9841a3fd90154e_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-22.jpg)


# 输入提示词，按提示确认交互，等待自动完成即可


`提示词：创建Vue项目设计一个用户仪表盘，并撰写技术方案。`


![v2-d50d91a77d141b7407e619542b1a033f_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-23.jpg)


# 生成结果 - 仪表盘、用户管理等


![v2-28c325eda4c24ed736eb496f8a49ba08_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-24.jpg)


![v2-0a910dcd960c25aff91137988472728b_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-25.jpg)


四、SKILL 开发


1，opencode skill开发


OpenCode共享Claude Code生态，OpenCode Skill开发参考Claude Code Skill开发即可


参考Claude Code Skills 国内实践全指南：从安装部署到高阶开发


2，OpenCode Skill本地安装


以my-design-assistant-skill 为例


`my-design-assistant-skill/├──SKILL.md├── ...`


#本地安装


将整个skill文件夹复制到 ~/.config/opencode/skills 目录


`cp -r my-design-assistant-skill ~/.config/opencode/skills`


#重启opencode


![v2-e9f445c57bc7f65ffbd299b1a3c5719d_1440w.jpg](../assets/images/claude-code-开源平替-手把手搭建opencode开发环境实践指南/image-26.jpg)


3，OpenCode Skill 加载顺序


OpenCode共享Claude Code Skill生态，启动后将搜索以下地点：


`项目配置： .opencode/skill//SKILL.md全局配置：~/.config/opencode/skill//SKILL.md项目兼容Claude：.claude/skills//SKILL.md全局兼容Claude：~/.claude/skills//SKILL.md`


#相关资源链接


官方下载：[https://opencode.ai/download](https://link.zhihu.com/?target=https%3A%2F%2Fopencode.ai%2Fdownload)


Github仓库：[https://github.com/anomalyco/opencode](https://link.zhihu.com/?target=https%3A%2F%2Fgithub.com%2Fanomalyco%2Fopencode)


oh-my-opencode仓库：[https://github.com/code-yeongyu/oh-my-opencode](https://link.zhihu.com/?target=https%3A%2F%2Fgithub.com%2Fcode-yeongyu%2Foh-my-opencode)

