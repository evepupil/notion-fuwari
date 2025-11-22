---
title: 'Cloud Flare配置优选节点教程'
published: 2025-11-23
description: 'Cloud Flare优选节点是在你请求CF的时候自动获取最佳节点，相较于未配置的情况（随机分配节点），访问速度明显加快，如图：'
image: ''
tags: ["cloud flare"]
draft: false
lang: ''
category: '技术'
---


## 优选节点是什么？


Cloud Flare优选节点是在你请求CF的时候自动获取最佳节点，相较于未配置的情况（随机分配节点），访问速度明显加快，如图：


![image.png](../assets/images/cloud-flare配置优选节点教程/image-1.png)


## 适用场景


主要适用于业务部署在Cloud Flare上面的情况，包括pages、worker等


## 有哪些优选节点


二叉树树自用： fenliu.072103.xyz


[**CM大佬**](https://blog.cmliussss.com/)： cf.090227.xyz
[**微测网**](https://www.wetest.vip/page/cloudflare/cname.html)：cloudflare.182682.xyz
源博客：[记录 - AcoFork Blog](https://blog.2b2x.cn/posts/record/#cloudflare-%E4%BC%98%E9%80%89%E5%9F%9F%E5%90%8D)


## 如何配置


在CF的DNS解析中添加一条CNAME记录，目标为上述优选节点的域名即可：


![image.png](../assets/images/cloud-flare配置优选节点教程/image-2.png)

