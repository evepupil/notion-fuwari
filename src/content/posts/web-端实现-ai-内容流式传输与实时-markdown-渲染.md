---
title: 'Web 端实现 AI 内容流式传输与实时 Markdown 渲染'
published: 2025-11-17
description: '在 AI 时代，用户对响应速度的要求越来越高传统的”等待加载”体验已无法满足需求。刚好做了一个项目踩了不少坑，分享如何实现**AI 内容流式传输**与**实时 Markdown 渲染**。'
image: '../assets/images/web-端实现-ai-内容流式传输与实时-markdown-渲染/cover.jpg'
tags: ["前端"]
draft: false
lang: ''
category: '技术'
---


## Web 端实现 AI 内容流式传输与实时 Markdown 渲染


在 AI 时代，用户对响应速度的要求越来越高传统的”等待加载”体验已无法满足需求。刚好做了一个项目踩了不少坑，分享如何实现**AI 内容流式传输**与**实时 Markdown 渲染**。


## 什么是流式传输？


流式传输（Streaming）是指服务器端持续向客户端发送数据，客户端实时处理并展示，无需等待完整响应。与传统请求-响应模式不同，流式传输能让用户**立即看到内容生成过程**，大幅提升用户体验。


## 核心技术栈


### 1. Server-Sent Events (SSE)


轻量级实时通信协议，实现服务器向客户端的单向推送：


```plain text
const response = await fetch('/api/chat-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: '你好' })
});
```


### 2. ReadableStream API


浏览器原生流式数据处理接口：


```plain text
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  processChunk(chunk);
}
```


## 实现步骤


### 第一步：后端流式 API 设计


后端使用 SSE 格式推送数据（每行以 data: 开头，\n\n 结尾）：


```plain text
// Node.js 后端示例
app.post('/api/generate-content-stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // 模拟流式生成内容
  const content = await generateContent(req.body);

  for (const token of content) {
    const data = JSON.stringify({ content: token });
    res.write(`data: ${data}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});
```


### 第二步：前端流式数据接收


```plain text
async function streamGenerateContent(
  params: GenerateParams,
  onChunk: (content: string) => void
) {
  const response = await fetch('/api/generate-content-stream', {
    method: 'POST',
    body: JSON.stringify(params)
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              // 累积内容（关键点：追加而非替换）
              onChunk(parsed.content);
            }
          } catch (e) {
            console.error('JSON 解析失败:', e);
          }
        }
      }
    }
  }
}
```


### 第三步：实时 Markdown 渲染


使用 **Streamdown** 库实现增量 Markdown 渲染：


```plain text
npm install streamdown
import { Streamdown } from 'streamdown';

function ContentReader({ content, isLoading }) {
  return (
    <div className="markdown-content">
      {isLoading ? (
        <div>正在生成内容...</div>
      ) : (
        <Streamdown>{content}</Streamdown>
      )}
    </div>
  );
}
```


**为什么使用 Streamdown？**

- ✅ 支持不完整的 Markdown 片段
- ✅ 增量渲染，无需等待完整内容
- ✅ 自动处理语法未闭合的情况

### 第四步：状态管理与增量更新


```plain text
function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (question: string) => {
    // 创建用户消息
    const userMsg: Message = { id: Date.now(), type: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);

    // 创建 AI 消息占位符
    const aiMsgId = `ai-${Date.now()}`;
    const aiMsg: Message = { id: aiMsgId, type: 'ai', content: '' };
    setMessages(prev => [...prev, aiMsg]);
    setIsStreaming(true);

    // 流式接收回复
    await streamChat(
      { question, history: messages },
      (chunk: string) => {
        // 增量更新 AI 消息内容（关键！）
        setMessages(prev => prev.map(msg =>
          msg.id === aiMsgId
            ? { ...msg, content: msg.content + chunk }
            : msg
        ));
      },
      () => setIsStreaming(false)
    );
  };

  return (
    <div className="chat-container">
      {messages.map(msg => (
        <div key={msg.id} className={msg.type}>
          <Streamdown>{msg.content}</Streamdown>
        </div>
      ))}
    </div>
  );
}
```


## 关键实现要点


### 1. **数据累积模式**


```plain text
// ❌ 错误：替换内容会导致闪烁
setContent(newContent);

// ✅ 正确：累积内容
setContent(prev => prev + newChunk);
```


### 2. **缓冲区管理**


```plain text
let buffer = '';
buffer += chunk;
const lines = buffer.split('\n');
buffer = lines.pop() || ''; // 保留未完整的一行
```


### 3. **首块优先响应**


```plain text
let isFirstChunk = true;
onChunk((chunk) => {
  if (isFirstChunk) {
    setLoading(false); // 立即关闭加载态
    isFirstChunk = false;
  }
  setContent(prev => prev + chunk);
});
```


## 最佳实践

1. **错误处理**：每个流操作都应有 onError 回调
2. **连接管理**：SSE 自动处理重连，无需手动干预
3. **性能优化**：使用 useCallback 避免不必要的重渲染
4. **用户体验**：
- 显示”正在生成…“提示
- 收到首块数据后立即隐藏加载态
- 提供取消操作选项

## 完整示例


完整代码可参考 LearnOS 项目：

- **流式 API**：src/lib/api/courseService.ts (第 539 行)
- **实时渲染**：src/components/learning/organisms/MainContentReader.tsx (第 111 行)

## 踩坑列表

1. 使用react-markdown组件，无法适配流式渲染，试了很久
2. **后端流式发送消息块的时候一定要进行编码，不然前端收到的可能被转码导致接受内容和发送的不一致**

## 总结


流式传输 + 实时 Markdown 渲染的核心是：

1. 使用 SSE 协议持续推送数据
2. ReadableStream 实时读取流
3. Streamdown 增量渲染 Markdown
4. 累积式状态更新避免闪烁

通过这套方案，就可以实现**即输入即得结果**的流畅体验。


---

