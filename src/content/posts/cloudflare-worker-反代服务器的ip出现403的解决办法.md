---
title: 'Cloudflare Worker 反代服务器的IP出现403的解决办法'
published: 2026-01-15
description: '在搭建 Pixiv 爬虫镜像站或其他代理服务时，我们常利用 Cloudflare Worker 作为边缘网关。然而，当你尝试在 Worker 中直接 `fetch(''http://你的服务器IP'')` 时，经常会遇到一个诡异的 **403 Forbidden** 报错。'
image: ''
tags: ["Cloudflare"]
draft: false
lang: ''
category: '技术'
---


### 前言


在搭建 Pixiv 爬虫镜像站或其他代理服务时，我们常利用 Cloudflare Worker 作为边缘网关。然而，当你尝试在 Worker 中直接 `fetch('http://你的服务器IP')` 时，经常会遇到一个诡异的 **403 Forbidden** 报错。


最让人困惑的是：

1. **本地测试全通**：用浏览器或 Postman 直连服务器 IP，一切正常。
2. **服务器防火墙全开**：甚至设置了 `Allow All` 依然被拒。
3. **响应极快**：Worker 日志显示响应时间仅为 **4ms-10ms**。

### 核心原因：Cloudflare 的 SSRF 安全沙箱机制


通过 4ms 的响应时间可以断定：**请求根本没有离开 Cloudflare 数据中心。**


Cloudflare 为了防止恶意用户利用其庞大的 Worker 网络对外部基础设施进行扫描或攻击（SSRF），默认对 **“Worker 直接请求裸 IP”** 做了极严苛的限制。即使你没有主动开启 WAF，其底层的安全规则也会直接在边缘节点拦截这种“不寻常”的出站请求。


---


### 解决办法：给服务器 IP 套上“马甲”


解决这个问题的关键在于**不要让 Worker 识别出你在请求裸 IP**。


### 1. DNS 欺骗（Gray Cloud 模式）


这是最优雅且成本最低的方案。

- **步骤**：
    1. 在 Cloudflare 的 DNS 设置中，添加一条 **A 记录**（例如 `tunnel.yourdomain.com`）。
    2. 指向你的服务器 IP。
    3. **关键点**：将云朵图标点灰（设置为 **DNS Only**）。
- **原理**：这样 Worker 看到的请求目标是一个域名，会触发标准的域名解析逻辑，从而绕过针对 IP 的 SSRF 拦截规则。

### 2. Worker 代码适配


在 Worker 中，使用这个新域名代替 IP 访问，并注意清理 Header：


---


### 总结与复盘


当你发现反代请求在几毫秒内就返回 403 时，不要去检查服务器防火墙，先看 Cloudflare Worker 的**出站策略**。

- **裸 IP** = 疑似攻击 = 拦截。
- **域名（Gray Cloud）** = 正常访问 = 放行。

这种“潜规则”在 Cloudflare 的文档中并没有大篇幅标注，但却是每一位全栈开发者利用边缘计算时的必经之路。

