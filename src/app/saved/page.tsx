"use client";

import { useEffect, useState } from "react";
import { getSavedArticles, deleteArticle, SavedArticle } from "@/lib/savedArticles";
import ArticleBody from "@/components/ArticleBody";

export default function SavedPage() {
  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setArticles(getSavedArticles());
  }, []);

  const handleDelete = (id: string) => {
    deleteArticle(id);
    setArticles((prev) => prev.filter((a) => a.id !== id));
    if (openId === id) setOpenId(null);
  };

  const handleCopy = (article: SavedArticle) => {
    navigator.clipboard.writeText(article.article);
    setCopiedId(article.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">保存済み記事</h1>
          <p className="text-gray-500 text-sm">
            生成した記事を保存して後から確認できます
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-400 text-sm">保存された記事はありません</p>
            <p className="text-gray-400 text-xs mt-1">
              記事ジェネレーターで記事を生成して「保存」ボタンを押してください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 text-right">{articles.length}件保存</p>
            {articles.map((article) => {
              const isOpen = openId === article.id;
              return (
                <div
                  key={article.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Card header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-indigo-500 mb-1">検索クエリ: {article.query}</p>
                        <h3 className="font-bold text-gray-900 leading-tight">{article.title}</h3>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(article.savedAt)}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleCopy(article)}
                          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          {copiedId === article.id ? "✓ コピー済み" : "コピー"}
                        </button>
                        <button
                          onClick={() => handleDelete(article.id)}
                          className="px-3 py-1.5 text-xs border border-red-100 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-indigo-50 rounded-xl p-3 mt-4">
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                        {article.summary}
                      </p>
                    </div>

                    {/* Toggle button */}
                    <button
                      onClick={() => setOpenId(isOpen ? null : article.id)}
                      className="mt-3 w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                    >
                      {isOpen ? "▲ 閉じる" : "▼ 記事全文を表示"}
                    </button>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="border-t border-gray-100 p-5 space-y-5">
                      {/* Article body */}
                      <ArticleBody text={article.article} />

                      {/* YouTube Videos */}
                      {article.videos && article.videos.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-3">関連YouTube動画</h4>
                          <div className="space-y-2">
                            {article.videos.map((video) => (
                              <a
                                key={video.rank}
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
                              >
                                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                                  {video.rank}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                    {video.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{video.reason}</p>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sources */}
                      {article.sources && article.sources.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2">参考ソース</h4>
                          <ul className="space-y-1.5">
                            {article.sources.map((src, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-xs text-gray-300 flex-shrink-0 mt-0.5">{i + 1}.</span>
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-indigo-500 hover:text-indigo-700 underline line-clamp-1"
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
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
