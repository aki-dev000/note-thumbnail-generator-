import Anthropic from "@anthropic-ai/sdk";
import { templates, Template } from "./templates";

const client = new Anthropic();

export type DesignSuggestion = {
  templateId: string;
  unsplashKeywords: string[];
  tagline: string;
};

export async function analyzeTitle(title: string): Promise<DesignSuggestion> {
  const templateList = templates
    .map((t) => `- id: "${t.id}", name: "${t.name}", keywords: ${JSON.stringify(t.searchKeywords)}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `noteの記事タイトルを分析して、最適な見出し画像デザインをJSONで返してください。

タイトル: 「${title}」

利用可能なテンプレート:
${templateList}

以下のJSON形式のみで回答してください（説明不要）:
{
  "templateId": "テンプレートのid",
  "unsplashKeywords": ["英語キーワード1", "英語キーワード2", "英語キーワード3"],
  "tagline": "タイトルを補完する短いサブコピー（20文字以内、日本語）"
}

unsplashKeywordsはテンプレートのkeywordsをベースに、タイトルの内容に合わせて調整してください。`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const json = JSON.parse(cleaned);
  return json as DesignSuggestion;
}
