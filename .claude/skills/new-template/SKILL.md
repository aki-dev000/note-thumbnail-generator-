---
name: new-template
description: note見出し画像の新しい写真背景テンプレートを追加する
---

新しいテンプレートを `src/lib/templates.ts` に追加してください。

テンプレートの構造：
```typescript
{
  id: string,           // 一意のID（例: "nature-calm"）
  name: string,         // 表示名（日本語OK）
  searchKeywords: string[], // Unsplashで使う検索キーワード（英語）
  overlayColor: string,    // 半透明オーバーレイの色（rgba形式）
  textColor: string,       // タイトルテキストの色
  textShadow: boolean,     // テキストシャドウの有無
  fontWeight: string,      // "bold" | "normal"
}
```

追加後、`src/components/TemplateSelector.tsx` のテンプレート一覧にも反映されることを確認してください。
$ARGUMENTS が指定されている場合はそのテーマで追加する。
