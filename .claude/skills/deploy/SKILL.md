---
name: deploy
description: Vercelへのデプロイ手順を実行する
disable-model-invocation: true
---

以下の手順でVercelにデプロイしてください：

1. `git status` で未コミットの変更を確認
2. 変更があれば `git add .` → `git commit -m "..."` でコミット
3. `git push origin main` でプッシュ
4. `vercel --prod` でデプロイ（vercel CLIが未インストールの場合は先にインストール）
5. デプロイ完了後、本番URLを表示する

環境変数（ANTHROPIC_API_KEY, UNSPLASH_ACCESS_KEY）がVercelに設定されているか確認すること。
