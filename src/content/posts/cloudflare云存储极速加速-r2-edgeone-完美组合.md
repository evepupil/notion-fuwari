---
title: 'cloudflare云存储极速加速，R2 + EdgeOne 完美组合'
published: 2026-01-16
description: '_**经测试对网站的加速使用源站配置 对象存储源站可以加速，其他的不行**_'
image: '../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/cover.webp'
tags: []
draft: false
lang: ''
---


![image1.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-1.webp)


## **Bilibili**


## **1、先开启 cloudflare 的自定义域名**


![image2.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-2.webp)


## **2、EdgeOne 添加 cdn 域名**


![image3.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-3.webp)


![image4.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-4.webp)


## **3、配置域名设置回源站点为 R2 的自定义域名站点**


_**经测试对网站的加速使用源站配置 对象存储源站可以加速，其他的不行**_


![image5.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-5.webp)


## **4、域名服务商配置域名的 cname 指向 EO 的 cname 地址**


![image6.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-6.webp)


## **4、配置 https 证书**


![image7.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-7.webp)


![image8.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-8.webp)


## **5、此时已经完成了 cdn 的操作，接下来我们配置边缘函数来将 png 转换为 webp 图片减小图片体积**


![image9.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-9.webp)


![image10.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-10.webp)


![image11.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-11.webp)


## **6、添加触发规则**


![image12.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-12.webp)


![image13.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-13.webp)


## **7、大功告成！附上前后对比图**


![image14.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-14.webp)


![image15.webp](../assets/images/cloudflare云存储极速加速-r2-edgeone-完美组合/image-15.webp)


**cloudflare云存储极速加速，R2 + EdgeOne 完美组合**


[https://www.zhaoyuqi.top/posts/cloudflare-r2-edgeone/](https://www.zhaoyuqi.top/posts/cloudflare-r2-edgeone/)


作者


爱哭的赵一一


发布于


2025-08-10


许可协议


[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

