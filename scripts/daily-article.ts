/**
 * daily-article.ts
 * 毎日自律実行：Claude がトレンドテーマを決定 → 記事生成 → ローカルに保存
 */

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 保存先: ai-management/有料Note/
const OUTPUT_DIR = resolve(process.env.OUTPUT_DIR ?? "/Users/takagi/ai-management/有料Note");

// ─── Tavily 検索 ────────────────────────────────────────────────────────────
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
  if (youtube)
    results = results.filter((r: { url: string }) => r.url.includes("youtube.com/watch"));
  return results;
}


// ─── Step 1: トレンドテーマを自動決定 ────────────────────────────────────────
async function chooseTopic(): Promise<string> {
  console.log("📌 Step 1: トレンドテーマを選定中...");

  const trends = await tavilySearch("AIエージェント 副業 最新トレンド 2025", false);
  const trendSummary = trends
    .map((t: { title: string; content?: string }) => `- ${t.title}: ${t.content?.slice(0, 100) ?? ""}`)
    .join("\n");

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `以下の最新トレンド情報を参考に、今日のnote有料記事のテーマを1つ決めてください。
テーマはAI・副業・生産性向上・キャリアのいずれかに関連するもので、
noteユーザーが読みたいと思う具体的なテーマにしてください。

トレンド情報:
${trendSummary}

テーマのみを30文字以内で回答してください（説明不要）。`,
      },
    ],
  });

  const topic =
    res.content[0].type === "text" ? res.content[0].text.trim() : "AIエージェントで副業収益化する方法";
  console.log(`  → テーマ: 「${topic}」`);
  return topic;
}

// ─── Step 2: 記事生成 ────────────────────────────────────────────────────────
type ArticleResult = {
  title: string;
  article: string;
  summary: string;
  sources: { title: string; url: string }[];
  videos: { rank: number; title: string; url: string; reason: string }[];
};

async function generateArticle(query: string): Promise<ArticleResult> {
  console.log("✍️  Step 2: 記事生成中...");

  // 検索ツール + 記事保存ツール（構造化出力を強制するために使用）
  const tools: Anthropic.Tool[] = [
    {
      name: "web_search",
      description: "Web上の最新情報・研究事例を検索します。",
      input_schema: {
        type: "object" as const,
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      name: "youtube_search",
      description: "YouTubeから関連動画を検索します。",
      input_schema: {
        type: "object" as const,
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      name: "save_article",
      description: "記事の生成が完了したら、必ずこのツールを呼び出して記事を保存してください。",
      input_schema: {
        type: "object" as const,
        properties: {
          title: {
            type: "string",
            description: "記事タイトル（30文字以内、有料記事らしい具体的な価値を示すタイトル）",
          },
          article: {
            type: "string",
            description: "note有料記事本文（3000〜4000文字。## 見出し、### 小見出しを使ったマークダウン形式。リード文→背景→本論3セクション→実践ステップ→まとめ の構成。具体的な数字・事例を含める）",
          },
          summary: {
            type: "string",
            description: "記事の要約（200文字程度）",
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                url: { type: "string" },
              },
              required: ["title", "url"],
            },
          },
          videos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                rank: { type: "number" },
                title: { type: "string" },
                url: { type: "string" },
                reason: { type: "string" },
              },
              required: ["rank", "title", "url", "reason"],
            },
          },
        },
        required: ["title", "article", "summary", "sources", "videos"],
      },
    },
  ];

  const systemPrompt = `あなたはnote有料記事作成の専門AIです。
以下の手順で記事を作成してください：
1. web_searchを2回使って最新情報を収集する
2. youtube_searchを1回使って関連動画を検索する
3. 収集した情報をもとに記事を執筆し、save_articleツールで保存する`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `「${query}」をテーマにnote有料記事を作成してください。` },
  ];

  let iterations = 0;

  while (iterations < 8) {
    iterations++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      system: systemPrompt,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        // save_article ツールが呼ばれたら記事データを返す
        if (block.name === "save_article") {
          const result = block.input as ArticleResult;
          console.log(`  → タイトル: 「${result.title}」`);
          console.log(`  → 文字数: ${result.article.length}文字`);
          return result;
        }

        const input = block.input as { query: string };
        console.log(`  🔍 ${block.name}: "${input.query}"`);

        try {
          const results =
            block.name === "youtube_search"
              ? await tavilySearch(input.query, true)
              : await tavilySearch(input.query, false);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(results) });
        } catch (e) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${e instanceof Error ? e.message : String(e)}`,
            is_error: true,
          });
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: "user", content: toolResults });
      }
    }

    if (response.stop_reason === "end_turn") {
      throw new Error("save_article ツールが呼ばれませんでした");
    }
  }

  throw new Error("最大試行回数を超えました");
}

// ─── Step 3: ファイルに保存 ──────────────────────────────────────────────────
function saveToFile(topic: string, result: ArticleResult, dateStr: string): string {
  console.log("💾 Step 3: ファイルに保存中...");

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const sources = Array.isArray(result.sources) ? result.sources : [];
  const videos = Array.isArray(result.videos) ? result.videos : [];
  const sourcesText = sources.map((s) => `- [${s.title}](${s.url})`).join("\n");
  const videosText = videos
    .map((v) => `${v.rank}. [${v.title}](${v.url}) - ${v.reason}`)
    .join("\n");

  const fileContent = `# ${result.title}

> **生成日**: ${dateStr}
> **テーマ**: ${topic}
> **要約**: ${result.summary}

---

${result.article}

---

## 参考資料

${sourcesText}

## 関連動画

${videosText}
`;

  const safeName = result.title.replace(/[/\\?%*:|"<>]/g, "_");
  const fileName = `${dateStr}_${safeName}.md`;
  const filePath = `${OUTPUT_DIR}/${fileName}`;

  writeFileSync(filePath, fileContent, "utf-8");
  console.log(`  → 保存完了: ${filePath}`);
  return filePath;
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

  console.log(`\n🚀 daily-article 開始 (${dateStr})\n`);

  try {
    const topic = await chooseTopic();
    const result = await generateArticle(topic);
    const filePath = saveToFile(topic, result, dateStr);

    console.log("\n✅ 完了!");
    console.log(`   タイトル  : ${result.title}`);
    console.log(`   保存先    : ${filePath}`);
  } catch (e) {
    console.error("\n❌ エラー:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
