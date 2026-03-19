import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Web上の最新情報・論文・研究事例を検索します。複数回呼び出して幅広く情報収集してください。",
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
    description: "YouTubeから関連する動画を検索します。記事の内容に関連する有益な動画を見つけてください。",
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
  const apiKey = process.env.TAVILY_API_KEY;
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    search_depth: "advanced",
    max_results: 8,
    include_raw_content: false,
  };
  if (youtube) {
    body.include_domains = ["youtube.com"];
  }
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tavily error: ${await res.text()}`);
  const data = await res.json();
  let results = data.results || [];
  if (youtube) {
    results = results.filter((r: { url: string }) => r.url.includes("youtube.com/watch"));
  }
  return results;
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ error: "クエリを入力してください" }, { status: 400 });
  }

  const systemPrompt = `あなたはnoteクリエイター向けの記事作成AIエージェントです。
ユーザーのテーマについて以下を実行してください：
1. web_searchツールを2〜3回使って、最新の情報・研究・事例を収集する（異なる角度から検索すること）
2. youtube_searchツールを1回使って、関連YouTube動画を検索する
3. 収集した情報をもとに、以下のJSON形式のみで最終回答を出力する（JSON以外のテキスト不可）：

{
  "title": "記事タイトル（読者の興味を引く魅力的なタイトル、30文字以内）",
  "article": "note記事本文（2000〜3000文字。マークダウン形式で、## 見出し、### 小見出しを使って構成すること。リード文→背景→本論（2〜3セクション）→まとめ の構成。調査した情報を具体的に盛り込み、読者に価値のある内容にする）",
  "summary": "記事の要約（200文字程度）",
  "sources": [
    {"title": "参考記事タイトル", "url": "https://..."}
  ],
  "videos": [
    {
      "rank": 1,
      "title": "動画タイトル",
      "url": "https://www.youtube.com/watch?v=...",
      "reason": "この動画を推薦する理由（内容・学べること）"
    },
    {"rank": 2, "title": "...", "url": "...", "reason": "..."},
    {"rank": 3, "title": "...", "url": "...", "reason": "..."}
  ]
}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `「${query.trim()}」をテーマにnote記事を作成してください。` },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json({ error: "エージェントからの応答がありません" }, { status: 500 });
      }
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json({ error: "レスポンスの形式が不正です" }, { status: 500 });
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json(parsed);
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        try {
          const input = block.input as { query: string };
          let results;
          if (block.name === "web_search") {
            results = await tavilySearch(input.query, false);
          } else if (block.name === "youtube_search") {
            results = await tavilySearch(input.query, true);
          } else {
            results = [];
          }
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

  return NextResponse.json({ error: "エージェントの最大試行回数を超えました" }, { status: 500 });
}
