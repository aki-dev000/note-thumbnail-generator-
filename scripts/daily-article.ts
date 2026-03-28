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

// ─── JSON 文字列修正 ────────────────────────────────────────────────────────
function fixJsonString(str: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) { result += char; escaped = false; continue; }
    if (char === "\\" && inString) { result += char; escaped = true; continue; }
    if (char === '"') { inString = !inString; result += char; continue; }
    if (inString && char === "\n") { result += "\\n"; continue; }
    if (inString && char === "\r") { result += "\\r"; continue; }
    if (inString && char === "\t") { result += "\\t"; continue; }
    result += char;
  }
  return result;
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
  ];

  const systemPrompt = `あなたはnote有料記事作成の専門AIです。
ユーザーのテーマについて以下を実行してください：
1. web_searchを2回使って最新情報を収集する
2. youtube_searchを1回使って関連動画を検索する
3. 収集した情報をもとに、以下のJSON形式のみで回答する（JSON以外のテキスト不可）：

{
  "title": "記事タイトル（30文字以内、有料記事らしい具体的な価値を示すタイトル）",
  "article": "note有料記事本文（3000〜4000文字。## 見出し、### 小見出しを使ったマークダウン形式。リード文→背景→本論3セクション→実践ステップ→まとめ の構成。具体的な数字・事例を含める）",
  "summary": "記事の要約（200文字程度）",
  "sources": [{"title": "タイトル", "url": "https://..."}],
  "videos": [
    {"rank": 1, "title": "動画タイトル", "url": "https://www.youtube.com/watch?v=...", "reason": "推薦理由"},
    {"rank": 2, "title": "...", "url": "...", "reason": "..."},
    {"rank": 3, "title": "...", "url": "...", "reason": "..."}
  ]
}`;

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

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("エージェントからの応答がありません");

      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("レスポンスの形式が不正です");

      const parsed = JSON.parse(fixJsonString(jsonMatch[0])) as ArticleResult;
      console.log(`  → タイトル: 「${parsed.title}」`);
      console.log(`  → 文字数: ${parsed.article.length}文字`);
      return parsed;
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
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

      messages.push({ role: "user", content: toolResults });
    }
  }

  throw new Error("最大試行回数を超えました");
}

// ─── Step 3: ファイルに保存 ──────────────────────────────────────────────────
function saveToFile(topic: string, result: ArticleResult, dateStr: string): string {
  console.log("💾 Step 3: ファイルに保存中...");

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const sourcesText = result.sources.map((s) => `- [${s.title}](${s.url})`).join("\n");
  const videosText = result.videos
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
