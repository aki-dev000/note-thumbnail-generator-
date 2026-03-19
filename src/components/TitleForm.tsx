"use client";

import { useState } from "react";

type Props = {
  onGenerate: (title: string) => void;
  loading: boolean;
};

export default function TitleForm({ onGenerate, loading }: Props) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) onGenerate(title.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="text-sm font-medium text-gray-700">
        記事タイトルを入力
      </label>
      <div className="flex gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：AIで変わる私たちの働き方"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
          maxLength={60}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "生成中…" : "生成"}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        AIがタイトルを分析して、最適な写真と配色を選びます
      </p>
    </form>
  );
}
