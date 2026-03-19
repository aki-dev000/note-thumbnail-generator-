export type SavedArticle = {
  id: string;
  query: string;
  title: string;
  article: string;
  summary: string;
  sources: { title: string; url: string }[];
  videos: { rank: number; title: string; url: string; reason: string }[];
  savedAt: string;
};

const KEY = "note_saved_articles";

export function getSavedArticles(): SavedArticle[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveArticle(article: Omit<SavedArticle, "id" | "savedAt">): SavedArticle {
  const saved = getSavedArticles();
  const entry: SavedArticle = {
    ...article,
    id: Date.now().toString(),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([entry, ...saved]));
  return entry;
}

export function deleteArticle(id: string): void {
  const saved = getSavedArticles().filter((a) => a.id !== id);
  localStorage.setItem(KEY, JSON.stringify(saved));
}
