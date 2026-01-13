interface Env {
  AI: {
    autorag: (name: string) => {
      aiSearch: (options: any) => Promise<ReadableStream>;
    };
  };
}

interface AISearchRequest {
  query: string;
}

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}) => {
  const { request, env } = context;

  try {
    const { query } = await request.json() as AISearchRequest;

    if (!query || !query.trim()) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 本地开发 Mock 数据（当 env.AI 不可用时）
    if (!env.AI) {
      console.log('⚠️ 本地开发模式：使用 Mock 数据');
      const encoder = new TextEncoder();
      const mockResponse = {
        result: {
          response: `这是本地开发的模拟回答。你的问题是：「${query}」\n\n在生产环境中，这里会显示 AI 根据博客内容生成的实际回答。`,
          data: [
            {
              filename: 'example-post.md',
              score: 0.85,
              content: [{ type: 'text', text: '示例文章内容' }]
            }
          ]
        }
      };

      const readable = new ReadableStream({
        start(controller) {
          const wrapped = `data: ${JSON.stringify(mockResponse)}\n\n`;
          controller.enqueue(encoder.encode(wrapped));
          controller.close();
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 调用 Cloudflare AI Search (AutoRAG) - 使用官方 API
    const result = await env.AI.autorag("purple-rain-8860").aiSearch({
      query: query.trim(),
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      rewrite_query: true,        // 优化查询
      max_num_results: 5,         // 最多返回5个相关结果
      ranking_options: {
        score_threshold: 0.3      // 相关性阈值
      },
      reranking: {
        enabled: true,            // 启用重排序
        model: "@cf/baai/bge-reranker-base"
      },
      stream: true,               // 启用流式响应
    });

    // 转换为 SSE 格式流式传输
    const encoder = new TextEncoder();

    // 如果 result 是 Response 对象，直接返回其 body
    if (result instanceof Response) {
      return new Response(result.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 否则处理为流式数据
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 尝试不同的流式处理方式
          if (typeof result[Symbol.asyncIterator] === 'function') {
            // 处理异步迭代器
            for await (const chunk of result) {
              const wrapped = `data: ${JSON.stringify({ result: chunk })}\n\n`;
              controller.enqueue(encoder.encode(wrapped));
            }
          } else if (result && typeof result.getReader === 'function') {
            // 处理 ReadableStream
            const reader = result.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const wrapped = `data: ${JSON.stringify({ result: value })}\n\n`;
              controller.enqueue(encoder.encode(wrapped));
            }
          } else {
            // 非流式响应，直接返回
            const wrapped = `data: ${JSON.stringify({ result })}\n\n`;
            controller.enqueue(encoder.encode(wrapped));
          }
        } catch (error) {
          console.error('Stream error:', error);
          const errorMsg = `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : 'Stream error'
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('AI Search error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to process AI search request'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};

// 处理 CORS 预检请求
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
};
