import { NextRequest, NextResponse } from "next/server";
import { analyzeTitle } from "@/lib/claude";
import { fetchPhoto } from "@/lib/unsplash";
import { templates } from "@/lib/templates";

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
    }

    const suggestion = await analyzeTitle(title.trim());
    const template = templates.find((t) => t.id === suggestion.templateId) ?? templates[0];
    const photo = await fetchPhoto(suggestion.unsplashKeywords);

    return NextResponse.json({
      template,
      photo,
      tagline: suggestion.tagline,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "生成に失敗しました。もう一度お試しください。" }, { status: 500 });
  }
}
