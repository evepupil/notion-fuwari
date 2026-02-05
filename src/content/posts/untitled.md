---
title: 'Untitled'
published: 2026-02-05T16:46:51.635Z
description: '试试Cloudflare IP优选！让Cloudflare在国内再也不是减速器！'
image: ''
tags: []
draft: false
lang: ''
category: 'Tutorial'
---


试试Cloudflare IP优选！让Cloudflare在国内再也不是减速器！


使用SaaS、Worker以及各种奇技淫巧来让你的网站解析的IP进行分流优选，提高网站可用性和速度


![cf-fastip-11.Bnc0DTIE.png](https://blog.acofork.com/_astro/cf-fastip-11.Bnc0DTIE.png)

> 本教程初始发布时间为 25年6月

### 未优选[#](https://blog.acofork.com/posts/cf-fastip/#%E6%9C%AA%E4%BC%98%E9%80%89)


![098f9ee71ae62603022e542878673e19bdcaf196.BYd5ucrt.webp](https://blog.acofork.com/_astro/098f9ee71ae62603022e542878673e19bdcaf196.BYd5ucrt.webp)


### 已优选[#](https://blog.acofork.com/posts/cf-fastip/#%E5%B7%B2%E4%BC%98%E9%80%89)


![cf-fastip-11.Bnc0DTIE.png](https://blog.acofork.com/_astro/cf-fastip-11.Bnc0DTIE.png)


---


结论：可见，优选过的网站响应速度有很大提升，并且出口IP也变多了。这能让你的网站可用性大大提高，并且加载速度显著变快。


### Cloudflare优选域名： [https://cf.090227.xyz](https://cf.090227.xyz/)[#](https://blog.acofork.com/posts/cf-fastip/#cloudflare%E4%BC%98%E9%80%89%E5%9F%9F%E5%90%8D-httpscf090227xyz)


---


# Worker路由反代全球并优选（新）[#](https://blog.acofork.com/posts/cf-fastip/#worker%E8%B7%AF%E7%94%B1%E5%8F%8D%E4%BB%A3%E5%85%A8%E7%90%83%E5%B9%B6%E4%BC%98%E9%80%89%E6%96%B0)

> 本方法的原理为通过Worker反代你的源站，然后将Worker的入口节点进行优选。此方法不是传统的优选，源站接收到的Hosts头仍然是直接指向源站的解析

创建一个Cloudflare Worker，写入代码


`` 1


// 域名前缀映射配置


2


const domain_mappings = {


3


'源站.com': '最终访问头.',


4


//例如：


5


//'gitea.072103.xyz': 'gitea.',


6


//则你设置Worker路由为gitea.*都将会反代到gitea.072103.xyz


7


};


8


9


addEventListener('fetch', event => {


10


event.respondWith(handleRequest(event.request));


11


});


12


13


async function handleRequest(request) {


14


const url = new URL(request.url);


15


const current_host = url.host;


16


17


// 强制使用 HTTPS


18


if (url.protocol === 'http:') {


19


```javascript
url.protocol = 'https:';
```


20


```javascript
return Response.redirect(url.href, 301);
```


21


}


22


23


const host_prefix = getProxyPrefix(current_host);


24


if (!host_prefix) {


25


```javascript
return new Response('Proxy prefix not matched', { status: 404 });
```


26


}


27


28


// 查找对应目标域名


29


let target_host = null;


30


for (const [origin_domain, prefix] of Object.entries(domain_mappings)) {


31


```javascript
if (host_prefix === prefix) {
```


32


```javascript
target_host = origin_domain;
```


33


```javascript
break;
```


34


```javascript
}
```


35


}


36


37


if (!target_host) {


38


```javascript
return new Response('No matching target host for prefix', { status: 404 });
```


39


}


40


41


// 构造目标 URL


42


const new_url = new URL(request.url);


43


new_url.protocol = 'https:';


44


new_url.host = target_host;


45


46


// 创建新请求


47


const new_headers = new Headers(request.headers);


48


new_headers.set('Host', target_host);


49


new_headers.set('Referer', new_url.href);


50


51


try {


52


```javascript
const response = await fetch(new_url.href, {
```


53


```javascript
method: request.method,
```


54


```javascript
headers: new_headers,
```


55


```javascript
body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
```


56


```javascript
redirect: 'manual'
```


57


```javascript
});
```


58


59


```javascript
// 复制响应头并添加CORS
```


60


```javascript
const response_headers = new Headers(response.headers);
```


61


```javascript
response_headers.set('access-control-allow-origin', '*');
```


62


```javascript
response_headers.set('access-control-allow-credentials', 'true');
```


63


```javascript
response_headers.set('cache-control', 'public, max-age=600');
```


64


```javascript
response_headers.delete('content-security-policy');
```


65


```javascript
response_headers.delete('content-security-policy-report-only');
```


66


67


```javascript
return new Response(response.body, {
```


68


```javascript
status: response.status,
```


69


```javascript
statusText: response.statusText,
```


70


```javascript
headers: response_headers
```


71


```javascript
});
```


72


} catch (err) {


73


```javascript
return new Response(`Proxy Error: ${err.message}`, { status: 502 });
```


74


}


75


}


76


77


function getProxyPrefix(hostname) {


78


for (const prefix of Object.values(domain_mappings)) {


79


```javascript
if (hostname.startsWith(prefix)) {
```


80


```javascript
return prefix;
```


81


```javascript
}
```


82


}


83


return null;


84


}


``


创建路由


![56752d54-26a5-46f1-a7d9-a782ad9874cb.CzkuRTP6.webp](https://blog.acofork.com/_astro/56752d54-26a5-46f1-a7d9-a782ad9874cb.CzkuRTP6.webp)


类似这样填写


![d025398c-39e3-4bd7-8d8f-2ce06a45007d.BZfb0DXO.webp](https://blog.acofork.com/_astro/d025398c-39e3-4bd7-8d8f-2ce06a45007d.BZfb0DXO.webp)


最后写一条DNS解析 `CNAME gitea.afo.im --> 社区优选域名，如 cf.090227.xyz` 即可


# 传统优选[#](https://blog.acofork.com/posts/cf-fastip/#%E4%BC%A0%E7%BB%9F%E4%BC%98%E9%80%89)

> WARNING
> 我们需要一个域名或两个域名（单域名直接用子域名即可。双域名比如：onani.cn和acofork.cn）。

这里我们让onani.cn成为主力域名，让acofork.cn成为辅助域名


单域名效果


![cf-fastip.CCFyge3n.png](https://blog.acofork.com/_astro/cf-fastip.CCFyge3n.png)


---

1. 首先新建一个DNS解析，指向你的源站，开启cf代理

![c94c34ee262fb51fb5697226ae0df2d804bf76fe.DQJBWagu.webp](https://blog.acofork.com/_astro/c94c34ee262fb51fb5697226ae0df2d804bf76fe.DQJBWagu.webp)

1. 前往辅助域名的 SSL/TLS -> 自定义主机名。设置回退源为你刚才的DNS解析的域名：xlog.acofork.cn（推荐 HTTP 验证 ）
2. 点击添加自定义主机名。设置一个自定义主机名，比如 `onani.cn` ，然后选择自定义源服务器，填写第一步的域名，即 `xlog.acofork.cn` 。如果你想要创建多个优选也就这样添加，一个自定义主机名对应一个自定义源服务器。如果你将源服务器设为默认，则源服务器是回退源指定的服务器，即 `xlog.acofork.cn`

![f6170f009c43f7c6bee4c2d29e2db7498fa1d0dc.Bev-ciX-.webp](https://blog.acofork.com/_astro/f6170f009c43f7c6bee4c2d29e2db7498fa1d0dc.Bev-ciX-.webp)

1. 继续在你的辅助域名添加一条解析。CNAME到优选节点：如cloudflare.182682.xyz，不开启cf代理

![4f9f727b0490e0b33d360a2363c1026003060b29.Dk0vVwZD.webp](https://blog.acofork.com/_astro/4f9f727b0490e0b33d360a2363c1026003060b29.Dk0vVwZD.webp)

1. 最后在你的主力域名添加解析。域名为之前在辅助域名的自定义主机名（onani.cn），目标为刚才的cdn.acofork.cn，不开启cf代理

![6f51cb2a42140a9bf364f88a5715291be616a254.BlVW1RqY.webp](https://blog.acofork.com/_astro/6f51cb2a42140a9bf364f88a5715291be616a254.BlVW1RqY.webp)

1. 优选完毕，确保优选有效后尝试访问

![cf-fastip-10.BYCdqQDH.png](https://blog.acofork.com/_astro/cf-fastip-10.BYCdqQDH.png)

1. （可选）你也可以将cdn子域的NS服务器更改为阿里云\华为云\腾讯云云解析做线路分流解析
> 优选工作流：用户访问 -> 由于最终访问的域名设置了CNAME解析，所以实际上访问了cdn.acofork.cn，并且携带 源主机名：onani.cn -> 到达cloudflare.182682.xyz进行优选 -> 优选结束，cf边缘节点识别到了携带的 源主机名：onani.cn 查询发现了回退源 -> 回退到回退源内容（xlog.acofork.cn） -> 访问成功

# 针对于Cloudflare Page[#](https://blog.acofork.com/posts/cf-fastip/#%E9%92%88%E5%AF%B9%E4%BA%8Ecloudflare-page)

1. 你可以直接将你绑定到Page的子域名直接更改NS服务器到阿里云\华为云\腾讯云云解析做线路分流解析
2. 将您的Page项目升级为Worker项目，使用下面的Worker优选方案（更简单）。详细方法见： 【CF Page一键迁移到Worker？好处都有啥？-哔哩哔哩】 [https://b23.tv/t5Bfaq1](https://b23.tv/t5Bfaq1)

# 针对于Cloudflare Workers[#](https://blog.acofork.com/posts/cf-fastip/#%E9%92%88%E5%AF%B9%E4%BA%8Ecloudflare-workers)

1. 在Workers中添加路由，然后直接将你的路由域名从指向`xxx.worker.dev`改为`cloudflare.182682.xyz`等优选域名即可
2. 如果是外域，SaaS后再添加路由即可，就像

![cf-fastip-12.cj8MBK0W.png](https://blog.acofork.com/_astro/cf-fastip-12.cj8MBK0W.png)


![cf-fastip-13.CebJYUyj.png](https://blog.acofork.com/_astro/cf-fastip-13.CebJYUyj.png)


# 针对于Cloudflare Tunnel（ZeroTrust）[#](https://blog.acofork.com/posts/cf-fastip/#%E9%92%88%E5%AF%B9%E4%BA%8Ecloudflare-tunnelzerotrust)


请先参照 [常规SaaS优选](https://blog.acofork.com/posts/cf-fastip/#%E4%BC%A0%E7%BB%9F%E4%BC%98%E9%80%89) 设置完毕，源站即为 Cloudflare Tunnel。正常做完SaaS接入即可 


![cf-fastip-2.BMNXaq4L.png](https://blog.acofork.com/_astro/cf-fastip-2.BMNXaq4L.png)


![cf-fastip-3.BnSFOiaj.png](https://blog.acofork.com/_astro/cf-fastip-3.BnSFOiaj.png)


接下来我们需要让打到 Cloudflare Tunnel 的流量正确路由，否则访问时主机名不在Tunnel中，会触发 catch: all 规则，总之就是没法访问。首先随便点开一个隧道编辑


![cf-fastip-4.CYqXR03x.png](https://blog.acofork.com/_astro/cf-fastip-4.CYqXR03x.png)


打开浏览器F12，直接保存，抓包请求


![cf-fastip-5.645fyi53.png](https://blog.acofork.com/_astro/cf-fastip-5.645fyi53.png)


抓包 PUT 请求，右键复制为 cURL 


![cf-fastip-6.CwIQ75tF.png](https://blog.acofork.com/_astro/cf-fastip-6.CwIQ75tF.png)


![cf-fastip-7.Bise5Hci.png](https://blog.acofork.com/_astro/cf-fastip-7.Bise5Hci.png)


打开 Postman 粘贴整个请求，导航到 Body 页，添加一个新项目， hostname 为你优选后（最终访问）的域名， service 为一个正确的源。然后 Send ！


![cf-fastip-8.CCTVQVyI.png](https://blog.acofork.com/_astro/cf-fastip-8.CCTVQVyI.png)


接下来，控制台会自动多出来一个新的域名，再次访问就正常了


至于为什么要这么做，因为你要添加的域名可能并不在你的 Cloudflare 账户中，而控制台的添加仅能添加CF账户内的域名，所以需要抓包曲线救国


![cf-fastip-9.ZAu8td6L.png](https://blog.acofork.com/_astro/cf-fastip-9.ZAu8td6L.png)


---


# 针对于使用了各种CF规则的网站[#](https://blog.acofork.com/posts/cf-fastip/#%E9%92%88%E5%AF%B9%E4%BA%8E%E4%BD%BF%E7%94%A8%E4%BA%86%E5%90%84%E7%A7%8Dcf%E8%A7%84%E5%88%99%E7%9A%84%E7%BD%91%E7%AB%99)


你只需要让规则针对于你的最终访问域名，因为CF的规则是看主机名的，而不是看是由谁提供的


# 针对于虚拟主机[#](https://blog.acofork.com/posts/cf-fastip/#%E9%92%88%E5%AF%B9%E4%BA%8E%E8%99%9A%E6%8B%9F%E4%B8%BB%E6%9C%BA)


保险起见，建议将源站和优选域名同时绑定到你的虚拟主机，保证能通再一个个删


试试Cloudflare IP优选！让Cloudflare在国内再也不是减速器！


[https://blog.acofork.com/posts/cf-fastip/](https://blog.acofork.com/posts/cf-fastip/)


作者


二叉树树


发布于


2026-01-11


许可协议


[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

