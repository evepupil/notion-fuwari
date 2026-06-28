---
title: 'Cloudflare Workers AI 免费额度值多少钱？'
published: 2026-05-07
description: '我第一次看 Cloudflare Workers AI 的计费时，就有一个疑问：'
image: ''
tags: ["Cloudflare"]
draft: false
lang: 'zh-CN'
translationKey: 'cloudflare-workers-ai-免费额度值多少钱'
notionSync: true
notionPageId: '3594342e-b403-80fc-af22-e37665ed81d0'
category: '技术'
---


# 


我第一次看 Cloudflare Workers AI 的计费时，就有一个疑问：


**每天送的** **`10,000 neurons`** **到底值多少钱？**


根据 Cloudflare 官方定价页，`Workers AI` 的价格是 **`$0.011 / 1,000 neurons`**，并且免费额度是 **每天** **`10,000 neurons`**，每天 **`00:00 UTC`** 重置。


所以换算下来就是：


`10,000 / 1,000 × $0.011 = $0.11`


也就是说，**Workers AI 每天的免费额度大约值** **`0.11 美元`**。


如果按 30 天粗算，一个月大约就是 **`$3.30`** 的 AI 调用额度。


官方定价页：


[Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)


## Workers AI 适合拿来干什么？


`Workers AI` 的好处很简单：**不用自己管 GPU，不用自己部署模型，直接在 Cloudflare 的 Worker 里调用 AI。**


对个人开发者来说，它特别适合：

- 给网站或小工具接一个聊天/总结/翻译能力
- 做一些轻量的 AI 自动化
- 低成本试不同模型，而不是先折腾推理环境

官方总览页：


[Workers AI Overview](https://developers.cloudflare.com/workers-ai/)


## 现在值得关注的几个模型


截至 **2026-05-07**，Cloudflare 官方文档里比较值得顺手关注的几个模型，我会先看这几个：


### 1. Kimi K2.6


这是我目前最先会看的一个。官方文档里它有 **262,144 tokens 上下文**，支持 **reasoning、vision、function calling**，定位上已经很像“更强的通用主力模型”。


如果你想在 Workers AI 上直接试比较新的强模型，`Kimi K2.6` 基本是很自然的选择。


官方页面：


[Kimi K2.6 on Workers AI](https://developers.cloudflare.com/workers-ai/models/kimi-k2.6/)


### 2. Kimi K2.5


如果你想要的还是 Kimi 路线，但希望价格比 `K2.6` 更低一点，那 `Kimi K2.5` 也很值得看。


它同样支持 **256k context、reasoning、vision、tool calling**，适合做长上下文和复杂任务。


官方页面：


[Kimi K2.5 on Workers AI](https://developers.cloudflare.com/workers-ai/models/kimi-k2.5/)


### 3. Gemma 4 26B A4B


如果你更看重**价格和能力的平衡**，那我反而觉得 `Gemma 4 26B A4B` 很有吸引力。


Cloudflare 官方写得很明确，它支持 **256k context、reasoning、vision、function calling**，而且输入价格明显更低，比较适合日常挂在 Worker 上跑。


官方页面：


[Gemma 4 26B A4B on Workers AI](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)


### 4. Gemma 3 12B


如果你只是想找一个更轻、更容易拿来试验的模型，`Gemma 3 12B` 也不错。


它支持多语言和图像输入理解，适合做问答、总结、轻量推理这类事情。


官方页面：


[Gemma 3 12B on Workers AI](https://developers.cloudflare.com/workers-ai/models/gemma-3-12b-it/)


## 最后补一句：`10,000 neurons` 不等于固定多少 token


这里有个很容易踩的坑：


**神经元和 token 不是固定换算关系。**


因为不同模型、不同输入输出类型，消耗的 neurons 不一样。


Cloudflare 官方定价页也是按模型分别列的。


比如官方当前列出的输入侧价格里：

- `Kimi K2.5`：`1M input tokens = 54,545 neurons`
- `Kimi K2.6`：`1M input tokens = 86,364 neurons`
- `Gemma 4 26B A4B`：`1M input tokens = 9,091 neurons`

所以，**`10,000 neurons`** **能换多少 token，要看你具体用的是哪一个模型**。


但如果你只是想知道“这每天的免费额度值多少钱”，那答案就很清楚了：


**大约** **`0.11 美元/天`****。**


## 参考链接

- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Workers AI Overview](https://developers.cloudflare.com/workers-ai/)
- [Kimi K2.6](https://developers.cloudflare.com/workers-ai/models/kimi-k2.6/)
- [Kimi K2.5](https://developers.cloudflare.com/workers-ai/models/kimi-k2.5/)
- [Gemma 4 26B A4B](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)
- [Gemma 3 12B](https://developers.cloudflare.com/workers-ai/models/gemma-3-12b-it/)
