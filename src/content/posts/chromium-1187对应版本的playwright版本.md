---
title: 'chromium-1187对应版本的playwright版本'
published: 2025-11-24
description: '```javascript'
image: ''
tags: ["疑难杂症"]
draft: false
lang: ''
category: '技术'
---


```javascript
BrowserType.launch: Executable doesn't exist at C:\Users\Evepupil\AppData\Local\ms-playwright\chromium-1187\chrome-win\chrome.exe
```


家里的电脑跑crawl4ai的时候，发现缺少指定版本的playwright的浏览器，但是这个版本的浏览器直接安装最新的playwright还不行。


经过反复尝试后，发现是


```javascript
npm install @playwright/test@1.55.0
```


这个版本才是刚好这个版本的浏览器


![image.png](../assets/images/chromium-1187对应版本的playwright版本/image-1.png)


安装了playwright之后，直接安装对应的chrome浏览器即可


```javascript
npx playwright install chromium
```

