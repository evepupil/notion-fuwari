---
title: 'Cloudflare Worker 反代网站为什么有的网站能用，有的网站一上来就是 403？'
published: 2026-04-05
description: '很多人用 Cloudflare Worker 做反向代理时，都会遇到一个很玄学的问题：同样的代码，有的网站能正常代理，有的网站却一上来就是 403。问题往往不在 Worker 本身，而在目标站点的 WAF、Host/SNI、Access、防盗链和源站权限。'
image: ''
tags: ["Cloudflare", "serverless", "疑难杂症"]
draft: false
lang: 'zh-CN'
translationKey: 'cloudflare-worker-反代网站为什么有的网站能用有的网站一上来就是403'
category: '技术'
---


### 前言

之前写了 Cloudflare Worker 反向代理网站的教程，相信不少人都遇到了一个问题：
**为什么同样是 Worker 反代，有的网站能正常打开，有的网站一上来就是 403？**

刚开始看，这事很像玄学。

- 同样一套 Worker 代码
- 同样是 `fetch()` 转发
- 有的网站完全没问题
- 有的网站连首页都过不去

如果你还没配过基础版反代，可以先看我之前这篇：[Cloudflare Worker反向代理网站教程](https://blog.chaosyn.com/posts/cloudflare-worker%E5%8F%8D%E5%90%91%E4%BB%A3%E7%90%86%E7%BD%91%E7%AB%99%E6%95%99%E7%A8%8B/)。


这次我专门翻了下 Cloudflare 官方文档，结论其实挺明确：


> **Cloudflare Worker 不是“万能透明代理”。**
>
> 能不能反代成功，取决于目标站点愿不愿意接受这种请求形态。


很多 403，不是你代码写错了，而是目标站点本身就把这种访问方式拦掉了。


---


### 先说结论


**有些网站能被 Worker 反代，有些一上来就是 403，核心原因通常不是 Worker 能力不够，而是目标站点的安全策略不同。**


最常见的几类原因是：

1. 目标站点开了 WAF、Bot 防护或 Challenge。
2. 目标站点要求严格的 `Host / SNI`，你的请求对不上。
3. 403 其实是源站自己返回的，不是 Cloudflare 拦的。
4. 目标站点在 Cloudflare Access 后面，没有认证就会被拒绝。
5. 你代理的是图片或静态资源，结果撞上了防盗链。


所以这个问题不要理解成“Cloudflare 抽风了”。


更准确的理解应该是：


**Worker 发出去的请求，不一定会被目标站点当成“正常浏览器直连请求”接受。**


---


### 一、先判断这个 403 是谁返回的


这一步最重要，因为很多人一看到 403，就默认是 Worker 有问题。


其实 Cloudflare 官方文档写得很明确：

- 如果是 **没有 Cloudflare 品牌页的普通 403**，通常说明 **403 是源站直接返回的**
- 如果是 **Cloudflare 风格的 403 页面**，通常要优先检查 **WAF、Security Level、Browser Integrity Check、DDoS 防护、1xxx 错误** 等安全功能
- 另外一种比较隐蔽的情况是 **`Host` 和 `SNI` 不匹配**，Cloudflare 也可能直接返回 403


也就是说，第一步不是改代码，而是先搞清楚：


**到底是 Cloudflare 拒绝了你，还是源站拒绝了你。**


如果你代理的是你自己的站，还要额外检查一件事：


**你的源站防火墙有没有把 Cloudflare 的 IP 段一起拦掉。**


这种情况非常常见。源站限制做得太猛，最后把正常回源流量也一起封了，然后表面看起来就像是 Worker 反代失败。


---


### 二、为什么 Worker 请求很容易被目标站识别出来


这也是很多人最容易忽略的一点。


Cloudflare 官方文档提到，Worker 通过 `fetch()` 发出的子请求会自动带上 `CF-Worker` 请求头，用来标识这是由哪个 zone 的 Worker 发起的请求。


这意味着：


**Worker 子请求并不是完全“透明”的。**


目标站点、上游 WAF、另一侧的 Cloudflare 规则、负载均衡器，都有机会识别出这不是一个普通用户浏览器直接打过来的请求。


所以你会遇到下面这种情况：

- 浏览器直接访问目标站，正常
- 通过 Worker 再去访问目标站，403


这不是因为 Worker 坏了，而是因为目标站点的安全策略把这类流量识别出来并拦截了。


如果目标站点本来就开着：

- WAF
- Bot 防护
- Challenge
- Browser Integrity Check
- IP / Header / Referer 校验


那 Worker 子请求天然就更容易触发规则。


---


### 三、最常见的 5 类 403 原因


### 1. 目标站点开了 WAF、Bot 防护或 Challenge


这是最常见的一类。


Cloudflare 官方文档列出的 403 场景里，本身就包括：

- WAF Custom Rules / Managed Rules
- Security Level
- DDoS Protection
- Browser Integrity Check


其中 Browser Integrity Check 的官方说明也很直接：它会根据请求头特征识别异常流量，并对没有 User-Agent 或 User-Agent 非常规的访问进行拦截或挑战。


所以如果目标站点前面本来就有一层比较严格的安全策略，那 Worker 反代过去之后，被识别成机器人流量并不奇怪。


这也是为什么很多网站表现出来是：

- 正常浏览器直接开，没问题
- Worker 一转发，403


浏览器能处理挑战页、带 cookie、跑页面逻辑，但一个普通的 `fetch()` 不会帮你完成这些额外验证流程。


---


### 2. `Host / SNI` 不匹配


这也是非常常见的一类。


很多站点只接受自己的正式域名访问。


比如它只认：

- `Host: api.example.com`
- TLS 里的 SNI 也是 `api.example.com`


如果你现在做的是：

- 用户访问你的域名
- Worker 再把请求转发给别人的站
- 但上游实际收到的 `Host / SNI` 又不符合它自己的预期


那它直接返回 403 很正常。


Cloudflare 官方文档里也明确提到：

- `Host` header override 会影响 SNI
- 很多场景下需要同时处理 `Host` 和 SNI
- `Host` 与 `SNI` 不匹配，本身就是一种可能触发 403 的情况


一句话理解：


**很多站不是“不让代理”，而是“不接受错误主机名的代理请求”。**


---


### 3. 403 其实来自源站，不是 Cloudflare


这一类在实战里也很多。


Cloudflare 官方文档写得很清楚：如果 403 页面 **没有 Cloudflare branding**，通常说明错误是源站自己返回的。


常见原因包括：

- 源站权限规则
- `mod_security`
- IP deny
- 目录或路径访问限制
- 源站自己的 WAF / Anti-bot 策略


这类问题的特点是：

- Worker 日志看起来没什么异常
- 请求确实发到上游了
- 上游就是不让你进


所以一旦你确认不是 Cloudflare 页，就不要一直围着 Worker 代码改，直接去看源站日志更有效。


如果你遇到的是另一种情况：

- 本地直连正常
- Worker 一请求裸 IP 就秒回 403
- 响应时间只有几毫秒


那大概率是另一类问题，可以看我之前写的这篇：[Cloudflare Worker 反代服务器的IP出现403的解决办法](https://blog.chaosyn.com/posts/cloudflare-worker-%E5%8F%8D%E4%BB%A3%E6%9C%8D%E5%8A%A1%E5%99%A8%E7%9A%84ip%E5%87%BA%E7%8E%B0403%E7%9A%84%E8%A7%A3%E5%86%B3%E5%8A%9E%E6%B3%95/)。


---


### 4. 目标站点在 Cloudflare Access 后面


如果你代理的是后台、私有 API、内网服务，这个情况非常常见。


Cloudflare One 官方文档明确写到：


**如果访问的是 Access 保护的域名，跨域预检 `OPTIONS` 请求会直接返回 403。**


原因不是 Bug，而是浏览器设计如此：

- `OPTIONS` 预检请求默认不带 cookie
- Access 看不到认证信息
- Cloudflare 直接把它拦掉


所以你会看到一种很迷惑的现象：

- 主请求逻辑看起来没问题
- 前端一发跨域请求就炸
- Network 面板里第一个报错就是 403


这时候问题不是“Worker 不能反代”，而是：


**你代理的是一个需要认证的目标，但你没有正确处理 Access 和 CORS。**


---


### 5. 代理图片、静态资源时撞上防盗链


这个也很常见，只是很多人没意识到。


Cloudflare Hotlink Protection 的官方文档写得非常直白：


**当请求图片时，如果 `Referer` 不是本站域名，并且也不是空，就可能被拒绝。**


所以你会遇到这种情况：

- 直接打开图片链接，正常
- Worker 去拉这张图片，403
- 浏览器控制台里像是“代理失败”


但本质上不是代理失败，而是对方开了防盗链。


尤其是这几类站点更容易遇到：

- 图床
- 资源站
- CDN 图片域名
- 有外链保护的静态资源服务


---


### 四、一个很实用的排查顺序


以后再遇到 Worker 反代 403，我建议按这个顺序看：


### 第一步：先看 403 页面是谁返回的

- 有 Cloudflare 风格页面，先查 Cloudflare 规则
- 没有 Cloudflare 风格页面，先查源站日志和权限


### 第二步：确认上游是否要求严格域名


重点检查：

- 目标服务是否只接受自己的主域名
- `Host` 是否正确
- TLS 的 SNI 是否匹配


### 第三步：看目标站有没有安全产品在拦你


重点看：

- WAF
- Bot 防护
- Browser Integrity Check
- Rate Limit
- Access
- 防盗链


### 第四步：别只看 Security Analytics


Cloudflare 官方文档提到，**Workers 发出的 subrequest 默认不会显示在 Security Analytics 里。**


所以你只盯着那个面板，很可能会得出一个错误结论：


“奇怪，请求根本没过去。”


实际上，请求可能早就过去了，只是你看的地方不对。


这时候更应该看：

- Worker 自己的日志
- 源站日志
- 目标站的安全事件


---


### 五、一个临时调试用的 Worker 写法


下面这段代码不是最终方案，只是为了排查时更方便确认：

- 403 是不是上游返回的
- 上游到底回了什么状态码
- 是不是存在重定向或头信息异常


```js
export default {
  async fetch(request) {
    const upstreamUrl = new URL(request.url);
    upstreamUrl.hostname = "origin.example.com";
    upstreamUrl.protocol = "https:";

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });

    const upstreamResponse = await fetch(upstreamRequest);

    const headers = new Headers(upstreamResponse.headers);
    headers.set("x-debug-upstream-status", String(upstreamResponse.status));
    headers.set(
      "x-debug-upstream-server",
      upstreamResponse.headers.get("server") ?? "unknown"
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};
```


这段代码的重点不是“绕过限制”，而是帮助你判断：

- 到底是谁回了 403
- 是不是请求到了目标站
- 上游响应头里有没有明显特征


如果你发现：

- 浏览器直连目标站正常
- Worker 转发过去就是 403
- 响应头里还有明显的目标站特征


那基本就可以判断：


**问题不在 Worker，本质上是目标站点不接受这种访问方式。**


---


### 六、什么时候值得继续调，什么时候该放弃


### 值得继续调的情况

- 你代理的是你自己的站
- 你能控制目标站的 WAF / Access / 源站权限
- 你能看源站日志
- 你能修改域名、Host、鉴权、回源策略


这种情况，大部分 403 都能解决，只是配置没对上。


### 不值得硬怼的情况

- 你代理的是第三方站点
- 对方明确开了 Challenge / Bot 防护
- 对方对 `Host / SNI / Referer / Access` 校验很严格
- 你没有任何权限看对方配置和日志


这种情况下，403 往往不是 Bug，而是对方的访问策略。


说白了：


**Cloudflare Worker 是边缘脚本，不是万能通行证。**


---


### 总结


回到最开始的问题：


**为什么有些网站能用 Worker 反代，有些一上来就是 403？**


因为不同网站对“什么请求才算合法访问”的定义根本不一样。


有些站点比较宽松，Worker 反代就能直接过。  
有些站点会严格检查：

- 你是不是正常浏览器流量
- `Host / SNI` 对不对
- 有没有认证
- `Referer` 对不对
- 有没有命中 WAF / Bot / Access 规则


只要其中一项不符合，它就会直接给你 403。


所以以后再碰到这类问题，不要先问：


**“Cloudflare Worker 能不能反代这个站？”**


更应该先问：


**“这个站，愿不愿意接受这种请求方式？”**


---


### 参考资料


- [Cloudflare 官方文档：Error 403](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-403/)
- [Cloudflare 官方文档：Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Cloudflare 官方文档：Browser Integrity Check](https://developers.cloudflare.com/waf/tools/browser-integrity-check/)
- [Cloudflare 官方文档：Security Analytics](https://developers.cloudflare.com/waf/analytics/security-analytics/)
- [Cloudflare 官方文档：Origin Rules settings](https://developers.cloudflare.com/rules/origin-rules/features/)
- [Cloudflare 官方文档：Access CORS](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/)
- [Cloudflare 官方文档：Hotlink Protection](https://developers.cloudflare.com/waf/tools/scrape-shield/hotlink-protection/)
