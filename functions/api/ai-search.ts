interface Env {
  AI: {
    autorag: (name: string) => {
      aiSearch: (options: any) => Promise<Response>;
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
      rewrite_query: true,
      max_num_results: 5,
      ranking_options: {
        score_threshold: 0.3
      },
      reranking: {
        enabled: true,
        model: "@cf/baai/bge-reranker-base"
      },
      stream: true,
    });

    // AutoRAG 返回的是 Response 对象，包含 SSE 流
    // 格式: data: {"response":"累积文本","p":"..."}
    // 需要转换为前端期望的格式: data: {"result":{"response":"...","data":[...]}}

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // 创建转换流
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            const data = JSON.parse(jsonStr);

            // 包装成前端期望的格式
            const wrapped = {
              result: {
                response: data.response || '',
                data: data.data || []
              }
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(wrapped)}\n\n`));
          } catch (e) {
            // 忽略解析错误，继续处理下一行
          }
        }
      }
    });

    // 获取原始流并转换
    const originalBody = result instanceof Response ? result.body : result;

    if (!originalBody) {
      throw new Error('No response body');
    }

    const transformedStream = originalBody.pipeThrough(transformStream);

    return new Response(transformedStream, {
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
