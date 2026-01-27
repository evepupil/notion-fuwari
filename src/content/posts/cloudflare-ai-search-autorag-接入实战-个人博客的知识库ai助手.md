---
title: 'Cloudflare AI Search（AutoRAG）接入实战，个人博客的知识库AI助手'
published: 2026-01-13
description: '最近给博客加了个 AI 助手功能，可以智能检索博客内容并回答问题。用的是 Cloudflare 的 AI Search（也叫 AutoRAG），踩了不少坑，这篇文章把接入流程和关键坑点整理一下。'
image: ''
tags: ["serverless", "Cloudflare", "RAG", "AI"]
draft: false
lang: ''
category: '技术'
---


## 前言


最近给博客加了个 AI 助手功能，可以智能检索博客内容并回答问题。用的是 Cloudflare 的 AI Search（也叫 AutoRAG），踩了不少坑，这篇文章把接入流程和关键坑点整理一下。


**效果预览**：点击右下角的聊天按钮，问它“博客里有哪些关于 Serverless 的文章？”，它会检索相关文章并给出回答，还会显示引用来源。


## 什么是 Cloudflare AI Search？


AI Search 是 Cloudflare 推出的 **RAG（检索增强生成）** 服务，简单说就是：

1. 你上传文档（网页、PDF、Markdown 等）
2. Cloudflare 自动建立向量索引
3. 用户提问时先检索相关文档，再让 AI 基于文档内容回答

相比自己搭 RAG，好处是：

- **免费额度**：每天 10万神经元AI免费调用
- **零运维**：不用管向量数据库、Embedding 模型
- **一站式**：检索 + 生成一个 API 搞定

## 一、创建 AI Search


### 1.1 进入控制台


登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，左侧菜单找到 **AI** → **AI Search**。


![image.png](../assets/images/cloudflare-ai-search-autorag-接入实战-个人博客的知识库ai助手/image-1.png)


### 1.2 创建实例


点击 **Create AI Search**，填写：

- **Name**：给个名字，比如 `my-blog-search`（后面代码要用）
- **Model**：选择生成模型，推荐 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`（速度快）

创建成功后会看到实例详情页。


## 二、添加数据源


AI Search 支持两种方式添加数据：


![image.png](../assets/images/cloudflare-ai-search-autorag-接入实战-个人博客的知识库ai助手/image-2.png)


### 2.1 方式一：网页 URL（推荐）


适合有线上网站的场景，Cloudflare 会自动爬取页面内容。

1. 在 AI Search创建详情页，点击 **use template**
2. 输入网站 URL，比如 [`https://blog.example.com`](https://blog.example.com/)
3. 点击 **Start Indexing**

爬取完成后，可以在 概述 标签看到所有索引的页面。

> **优点**：自动更新，网站内容变了会重新爬取  
> **缺点**：需要网站公开可访问

### 2.2 方式二：上传文件


适合本地文档、私有内容。

1. 在 AI Search 详情页创建，支持多种数据源，配取即可

![image.png](../assets/images/cloudflare-ai-search-autorag-接入实战-个人博客的知识库ai助手/image-3.png)


## 三、页面上测试


数据添加完成后，可以直接在 Dashboard 测试效果：

1. 进入 AI Search 详情页
2. 点击 **Playground** 标签
3. 输入问题，比如“有哪些关于部署的文章？”
4. 查看 AI 回答和引用的来源文档

## 四、代码集成实战


接下来是重点：如何在代码中调用 AI Search。以 Astro 博客项目为例。


### 4.1 配置 AI Binding


首先需要在 `wrangler.jsonc`（或 `wrangler.toml`）中配置 AI 绑定：


```json
{
  "name": "my-blog",
  "compatibility_date": "2025-08-11",
  "pages_build_output_dir": "./dist",
  "ai": {
    "binding": "AI"
  }
}
```


这样在 Cloudflare Pages Functions 中就能通过 [`env.AI`](http://env.ai/) 访问 AI 服务。


### 4.2 调用 AI Search（关键片段）


```typescript
const result = await 
env.AI
.autorag('my-blog-search').aiSearch({
  query: query.trim(),
  model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  rewrite_query: true,
  max_num_results: 5,
  ranking_options: { score_threshold: 0.3 },
  reranking: { enabled: true, model: '@cf/baai/bge-reranker-base' },
  stream: true,
});
```


### 4.3 参数说明


| 参数                  | 说明         | 建议值                                  |
| ------------------- | ---------- | ------------------------------------ |
| `model`             | 生成模型       | `llama-3.3-70b-instruct-fp8-fast`（快） |
| `rewrite_query`     | 自动优化用户查询   | `true`                               |
| `max_num_results`   | 检索文档数量     | `3-10`                               |
| `score_threshold`   | 相关性阈值（0-1） | `0.3`（太高可能无结果）                       |
| `reranking.enabled` | 启用重排序      | `true`（提升质量）                         |
| `stream`            | 流式响应       | `true`（体验更好）                         |


## 五、流式响应处理（重点）


AI Search 开启 `stream: true` 后返回 SSE 格式，需要正确处理。


### 


## 六、部署配置


### 6.1 配置 Pages Binding


和**4.1 配置 AI Binding** 二选一配置即可，推荐采用 **4.1 配置 AI Binding**的方式。


在 Cloudflare Dashboard：

1. 进入 Pages 项目 →设置 → 绑定
2. 找到 **AI Bindings**
3. 点击 **Add binding**：
    - Variable name: `AI`
    - AI Search: 选择你创建的实例
4. 点击 **Save**

### 6.2 部署


```bash
pnpm build
npx wrangler pages deploy dist
```


## 总结


Cloudflare AI Search 确实降低了 RAG 的接入门槛，不用自己搞向量数据库和 Embedding，并且每天提供慷慨的免费额度，且不用担心过度使用的账单，能够满足轻量化的RAG知识索引的需求。

