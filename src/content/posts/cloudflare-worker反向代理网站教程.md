---
title: 'Cloudflare Worker反向代理网站教程'
published: 2025-11-17
description: '```markdown'
image: ''
tags: ["cloud flare", "好玩", "serverless"]
draft: false
lang: ''
category: '技术'
---


```markdown
# Cloudflare Worker 反向代理入门教程

## 什么是反向代理？

反向代理就是**代替你访问目标网站**，然后把结果返回给你。比如你想访问 `example.com`，但你不想直接访问，而是通过 Cloudflare Worker 去访问，然后 Workers 再把内容返回给你。

**使用场景：**
- 绕过地域限制
- 隐藏真实服务器地址
- 访问被墙的网站
- 自定义域名访问目标网站

## 前置准备

1. **Cloudflare 账号** - 免费注册 https://cloudflare.com
2. **wrangler CLI 工具**
   ```bash
   npm install -g wrangler
   ```
3. **登录 wrangler**
   ```bash
   wrangler login
   ```

## 完整代码示例

创建一个文件 `worker.js`：

```javascript
/**
 * Cloudflare Worker 反向代理
 * 功能：代理 anyrouter.top 网站
 */

// 目标网站地址
const TARGET_HOST = 'anyrouter.top';
const TARGET_URL = `https://${TARGET_HOST}`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * 处理请求的核心函数
 */
async function handleRequest(request) {
  try {
    // 1. 解析请求的 URL
    const url = new URL(request.url);

    // 2. 构建目标 URL（保持原始路径和查询参数）
    const targetUrl = `${TARGET_URL}${url.pathname}${url.search}`;

    // 3. 复制并修改请求头
    const headers = new Headers(request.headers);
    headers.set('Host', TARGET_HOST);

    // 4. 构建请求选项
    const requestOptions = {
      method: request.method,
      headers: headers,
      // 重要：不自动跟随重定向，避免重定向循环
      redirect: 'manual',
    };

    // 5. 发起代理请求
    const response = await fetch(targetUrl, requestOptions);

    // 6. 处理重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      if (location && !location.startsWith(TARGET_HOST)) {
        // 转发外部重定向
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      } else {
        // 阻止自我重定向（避免循环）
        return new Response('网站不允许代理访问', {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    }

    // 7. 处理响应
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

    // 8. 删除冲突的安全头
    responseHeaders.delete('Content-Security-Policy');
    responseHeaders.delete('X-Frame-Options');

    // 9. 返回响应
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(`代理失败: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
```

## 部署步骤

### 方法一：使用 CLI（推荐）

**1. 初始化项目**
```bash
wrangler init any-proxy
cd any-proxy
```

**2. 创建配置文件 `wrangler.toml`**
```toml
name = "any-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"
workers_dev = true
```

**3. 部署**
```bash
wrangler deploy
```

**4. 获取访问地址**
部署成功后会有类似输出：
```
Deployed any-proxy triggers (0.66 sec)
  https://any-proxy.your-subdomain.workers.dev
```

这就是你的代理地址！

### 方法二：使用 Dashboard

1. 登录 Cloudflare Dashboard
2. 进入 "Workers & Pages"
3. 点击 "Create application" → "Create Worker"
4. 粘贴代码
5. 点击 "Save and Deploy"

## 绑定自定义域名

**1. 在 Cloudflare 中添加域名**

如果 `your-domain.com` 在 Cloudflare 管理：

```bash
# 添加路由到 wrangler.toml
routes = [
  { pattern = "your-domain.com/*", zone_name = "your-domain.com" }
]
```

**2. 重新部署**
```bash
wrangler deploy
```

**3. DNS 设置**

Cloudflare 会自动处理 DNS 记录，无需手动添加。

## 常见问题

### ❌ 500 错误 - "Too many redirects"

**原因：** 网站检测到代理，返回重定向，导致无限循环。

**解决：** 设置 `redirect: 'manual'`，手动处理重定向（见上方代码第 22 行）。

### ❌ 静态资源 404

**原因：** 网站内部链接使用绝对 URL，直接指向原域名。

**解决：** 添加 URL 重写功能，将响应内容中的原域名替换为代理域名。

### ❌ CORS 错误

**解决：** 在响应头中添加：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

## 进阶功能

### 1. URL 重写（让所有资源都通过代理）

```javascript
// 在响应处理时添加
const contentType = response.headers.get('content-type') || '';

if (contentType.includes('text/html') ||
    contentType.includes('text/javascript') ||
    contentType.includes('text/css')) {

  const text = await response.text();
  // 将 anyrouter.top 替换为当前代理域名
  const rewrittenText = text.replace(/https:\/\/anyrouter\.top/g, proxyUrl);

  return new Response(rewrittenText, {
    status: response.status,
    headers: responseHeaders
  });
}
```

### 2. 添加缓存

```javascript
// 缓存静态资源 1 小时
const cacheKey = new Request(url, request);
const cache = caches.default;

let response = await cache.match(cacheKey);
if (!response) {
  response = await fetch(targetUrl);
  // 缓存响应
  await cache.put(cacheKey, response.clone());
}
```

## 完整项目结构

```
my-proxy/
├── worker.js          # 主程序
├── wrangler.toml      # 配置文件
└── package.json       # 依赖（可选）
```

## 总结

1. **核心原理**：拦截请求 → 转发到目标 → 修改响应 → 返回给用户
2. **关键点**：
   - 修改请求头（Host、Origin）
   - 禁止自动重定向
   - 添加 CORS 支持
   - 处理 URL 重写
3. **部署方式**：CLI 命令或 Dashboard 界面

就这么简单！现在你可以在任何地方通过你的 Cloudflare Worker 访问目标网站了。

## 参考资料

- [Cloudflare Workers 官方文档](https://developers.cloudflare.com/workers/)
- [wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
```

