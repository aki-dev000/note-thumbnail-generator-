"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ThumbnailCanvas, { ThumbnailCanvasHandle } from "@/components/ThumbnailCanvas";
import { Template } from "@/lib/templates";

type VideoResult = {
  rank: number;
  title: string;
  url: string;
  reason: string;
};

type ArticleResult = {
  title: string;
  article: string;
  summary: string;
  sources: { title: string; url: string }[];
  videos: VideoResult[];
};

type ThumbnailResult = {
  template: Template;
  photo: { url: string; authorName: string; authorUrl: string };
  tagline: string;
};

export default function ArticlePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArticleResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [thumbResult, setThumbResult] = useState<ThumbnailResult | null>(null);
  const canvasRef = useRef<ThumbnailCanvasHandle>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setThumbResult(null);

    try {
      const res = await fetch("/api/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
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

  const handleGenerateThumbnail = async () => {
    if (!result) return;
    setThumbLoading(true);
    setThumbError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: result.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setThumbResult(data);
    } catch (e) {
      setThumbError(e instanceof Error ? e.message : "画像生成に失敗しました");
    } finally {
      setThumbLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.article);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            note 記事ジェネレーター
          </h1>
          <p className="text-gray-500 text-sm">
            テーマを入力するだけで、AIがWebを調査してnote記事を生成します
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="text-sm text-indigo-500 hover:text-indigo-700 underline"
            >
              見出し画像ジェネレーターへ
            </Link>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            <label className="text-sm font-medium text-gray-700">
              記事のテーマを入力
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例：生成AIが変える教育の未来"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "生成中…" : "生成"}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              AIがWebを調査して2000〜3000字のnote記事を作成します（30〜60秒程度かかります）
            </p>
          </form>
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
            <p className="text-gray-500 text-sm">Webを調査して記事を作成しています…</p>
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          <div className="space-y-6">
            {/* Article */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">{result.title}</h2>
                <button
                  onClick={handleCopy}
                  className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copied ? "コピーしました！" : "記事をコピー"}
                </button>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">
                {result.article}
              </div>
            </div>

            {/* Thumbnail Generation */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">見出し画像を生成する</h3>
              {thumbError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-red-600 text-sm">
                  {thumbError}
                </div>
              )}
              {!thumbResult ? (
                <button
                  onClick={handleGenerateThumbnail}
                  disabled={thumbLoading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {thumbLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      画像を生成しています…
                    </>
                  ) : (
                    "「" + result.title + "」の見出し画像を生成"
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  <ThumbnailCanvas
                    ref={canvasRef}
                    title={result.title}
                    tagline={thumbResult.tagline}
                    photoUrl={thumbResult.photo.url}
                    template={thumbResult.template}
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      テンプレート: {thumbResult.template.name}　|　Photo by{" "}
                      <a
                        href={thumbResult.photo.authorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-gray-600"
                      >
                        {thumbResult.photo.authorName}
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
                    onClick={handleGenerateThumbnail}
                    className="w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    別の写真で再生成
                  </button>
                </div>
              )}
            </div>

            {/* YouTube Videos */}
            {result.videos && result.videos.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">関連YouTube動画</h3>
                <div className="space-y-3">
                  {result.videos.map((video) => (
                    <a
                      key={video.rank}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
                    >
                      <span className="flex-shrink-0 w-7 h-7 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                        {video.rank}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {video.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{video.reason}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {result.sources && result.sources.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">参考ソース</h3>
                <ul className="space-y-2">
                  {result.sources.map((src, i) => (
                    <li key={i}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-500 hover:text-indigo-700 underline line-clamp-1"
                      >
                        {src.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
