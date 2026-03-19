"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import TitleForm from "@/components/TitleForm";
import ThumbnailCanvas, { ThumbnailCanvasHandle } from "@/components/ThumbnailCanvas";
import { Template } from "@/lib/templates";

type GenerateResult = {
  template: Template;
  photo: { url: string; authorName: string; authorUrl: string };
  tagline: string;
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const canvasRef = useRef<ThumbnailCanvasHandle>(null);

  const handleGenerate = async (title: string) => {
    setLoading(true);
    setError(null);
    setCurrentTitle(title);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            note 見出し画像ジェネレーター
          </h1>
          <p className="text-gray-500 text-sm">
            記事タイトルを入力するだけで、AIが最適な見出し画像を生成します
          </p>
          <div className="mt-4">
            <Link
              href="/article"
              className="text-sm text-indigo-500 hover:text-indigo-700 underline"
            >
              記事ジェネレーターへ（テーマから記事＋画像を作成）
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <TitleForm onGenerate={handleGenerate} loading={loading} />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <div className="inline-block w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-500 text-sm">AIが最適な画像を選んでいます…</p>
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <ThumbnailCanvas
              ref={canvasRef}
              title={currentTitle}
              tagline={result.tagline}
              photoUrl={result.photo.url}
              template={result.template}
            />

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                テンプレート: {result.template.name}　|
                Photo by{" "}
                <a
                  href={result.photo.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                >
                  {result.photo.authorName}
                </a>{" "}
                on Unsplash
              </div>
              <button
                onClick={() => canvasRef.current?.download()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                PNG でダウンロード
              </button>
            </div>

            <button
              onClick={() => handleGenerate(currentTitle)}
              className="w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              別の写真で再生成
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
