---
title: '利用Cloudflare去掉域名后面的端口号_域名怎么去掉端口号-CSDN博客'
published: 2026-02-10T17:02:26.451Z
description: '两个域名，一个是想让别人访问的公共域名，另一个设置好DDNS，可以用域名+端口号正常访问，我们姑且叫它私有域名。'
image: ''
tags: []
draft: false
lang: ''
---


# 利用Cloudflare去掉域名后面的端口号


## 准备工作


两个域名，一个是想让别人访问的公共域名，另一个设置好DDNS，可以用域名+端口号正常访问，我们姑且叫它私有域名。


## 1. 把DNS记录添加到Cloudflare


把公共域名添加到Cloudflare，设置子域名的dns记录cname指向私有域名，不带端口号，代理别忘了打开，如下图：


![image](../assets/images/利用cloudflare去掉域名后面的端口号-域名怎么去掉端口号-csdn博客/image-1.jpg)


## 2. 设置转发规则


在Cloudflare左侧的功能区找到规则→Orgin Rules，添加一条规则，当匹配到公共域名的时候重写到私有域名的某个端口，如下图：设置完成以后等一段时间，可能几分钟也可能几小时，转发就生效了。


![image](../assets/images/利用cloudflare去掉域名后面的端口号-域名怎么去掉端口号-csdn博客/image-2.jpg)

