/**
 * get-note-cookies.ts
 * ローカルで一度だけ実行: note.com にブラウザでログインしてクッキーを保存する
 * 使い方: npx tsx scripts/get-note-cookies.ts
 */

import { chromium } from "playwright";
import { writeFileSync } from "fs";

async function main() {
  console.log("ブラウザを起動します。note.com にログインしてください...");

  const browser = await chromium.launch({ headless: false }); // 実ブラウザで表示
  const context = await browser.newContext({ locale: "ja-JP" });
  const page = await context.newPage();

  await page.goto("https://note.com/login");

  console.log("✅ ブラウザでログインが完了したら Enter を押してください...");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const cookies = await context.cookies();
  const cookieJson = JSON.stringify(cookies, null, 2);

  writeFileSync("/tmp/note-cookies.json", cookieJson);
  console.log("\nクッキーを保存しました: /tmp/note-cookies.json");
  console.log("\n以下を GitHub Secret「NOTE_COOKIES」に登録してください:\n");
  console.log(cookieJson);

  await browser.close();
}

main();
