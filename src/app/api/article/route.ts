import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Web上の最新情報・研究事例を検索します。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "検索クエリ（日本語または英語）" },
      },
      required: ["query"],
    },
  },
  {
    name: "youtube_search",
    description: "YouTubeから関連動画を検索します。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "YouTube検索クエリ" },
      },
      required: ["query"],
    },
  },
];

async function tavilySearch(query: string, youtube = false) {
  const body: Record<string, unknown> = {
    api_key: process.env.TAVILY_API_KEY,
    query,
    search_depth: "basic",
    max_results: 5,
    include_raw_content: false,
  };
  if (youtube) body.include_domains = ["youtube.com"];

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tavily error: ${await res.text()}`);
  const data = await res.json();
  let results = data.results || [];
  if (youtube) results = results.filter((r: { url: string }) => r.url.includes("youtube.com/watch"));
  return results;
}

export async function POST(req: NextRequest) {
  let query: string;
  try {
    const body = await req.json();
    query = body.query;
  } catch {
    return new Response(JSON.stringify({ error: "リクエストの形式が不正です" }), { status: 400 });
  }

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return new Response(JSON.stringify({ error: "クエリを入力してください" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const systemPrompt = `あなたはnote記事作成の専門AIです。
ユーザーのテーマについて以下を実行してください：
1. web_searchを2回使って最新情報を収集する
2. youtube_searchを1回使って関連動画を検索する
3. 収集した情報をもとに、以下のJSON形式のみで回答する（JSON以外のテキスト不可）：

{
  "title": "記事タイトル（30文字以内）",
  "article": "note記事本文（2000〜2500文字。## 見出し、### 小見出しを使ったマークダウン形式。リード文→背景→本論2セクション→まとめ の構成）",
  "summary": "記事の要約（150文字程度）",
  "sources": [{"title": "タイトル", "url": "https://..."}],
  "videos": [
    {"rank": 1, "title": "動画タイトル", "url": "https://www.youtube.com/watch?v=...", "reason": "推薦理由"},
    {"rank": 2, "title": "...", "url": "...", "reason": "..."},
    {"rank": 3, "title": "...", "url": "...", "reason": "..."}
  ]
}`;

        const messages: Anthropic.MessageParam[] = [
          { role: "user", content: `「${query.trim()}」をテーマにnote記事を作成してください。` },
        ];

        let iterations = 0;
        let searchCount = 0;

        while (iterations < 8) {
          iterations++;

          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: systemPrompt,
            tools,
            messages,
          });

          messages.push({ role: "assistant", content: response.content });

          if (response.stop_reason === "end_turn") {
            send({ type: "step", step: 2 });
            const textBlock = response.content.find((b) => b.type === "text");
            if (!textBlock || textBlock.type !== "text") {
              send({ type: "error", message: "エージェントからの応答がありません" });
              return;
            }
            const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              send({ type: "error", message: "レスポンスの形式が不正です" });
              return;
            }
            const parsed = JSON.parse(jsonMatch[0]);
            send({ type: "result", data: parsed });
            return;
          }

          if (response.stop_reason === "tool_use") {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of response.content) {
              if (block.type !== "tool_use") continue;

              if (block.name === "web_search") {
                send({ type: "step", step: searchCount === 0 ? 0 : 1 });
                searchCount++;
              } else if (block.name === "youtube_search") {
                send({ type: "step", step: 1 });
              }

              try {
                const input = block.input as { query: string };
                const results =
                  block.name === "youtube_search"
                    ? await tavilySearch(input.query, true)
                    : await tavilySearch(input.query, false);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify(results),
                });
              } catch (e) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: `Error: ${e instanceof Error ? e.message : String(e)}`,
                  is_error: true,
                });
              }
            }

            messages.push({ role: "user", content: toolResults });
          }
        }

        send({ type: "error", message: "エージェントの最大試行回数を超えました" });
      } catch (e) {
        console.error("[article] error:", e);
        send({ type: "error", message: e instanceof Error ? e.message : "予期せぬエラーが発生しました" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
