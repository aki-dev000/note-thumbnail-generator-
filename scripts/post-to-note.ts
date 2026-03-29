/**
 * post-to-note.ts
 * 有料Note/配下の最新記事を note.com に下書き投稿する（クッキー認証）
 */

import { chromium } from "playwright";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const OUTPUT_DIR = resolve(process.env.OUTPUT_DIR ?? "/Users/takagi/ai-management/有料Note");
const NOTE_COOKIES = process.env.NOTE_COOKIES!;
const NOTE_PRICE = process.env.NOTE_PRICE ?? "300";

// ─── 最新の記事ファイルを読み込む ────────────────────────────────────────────
function loadLatestArticle(): { title: string; body: string } {
  const files = readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  if (files.length === 0) throw new Error(`記事ファイルが見つかりません: ${OUTPUT_DIR}`);

  const today = new Date().toISOString().slice(0, 10);
  const todayFile = files.find((f) => f.startsWith(today)) ?? files[0];
  const content = readFileSync(resolve(OUTPUT_DIR, todayFile), "utf-8");

  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "タイトルなし";

  const bodyMatch = content.match(/^---\s*\n([\s\S]+?)\n---/m);
  const body = bodyMatch ? bodyMatch[1].trim() : content;

  console.log(`  → ファイル: ${todayFile}`);
  console.log(`  → タイトル: ${title}`);
  return { title, body };
}

// ─── note.com に投稿 ─────────────────────────────────────────────────────────
async function postToNote(title: string, body: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "ja-JP" });

  // クッキーを注入してログインをスキップ
  console.log("  🍪 クッキーでセッションを復元中...");
  const cookies = JSON.parse(NOTE_COOKIES);
  await context.addCookies(cookies);

  const page = await context.newPage();

  try {
    // ログイン確認（ログインページにリダイレクトされなければOK）
    await page.goto("https://note.com", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      throw new Error("クッキーが無効です。get-note-cookies.ts を再実行してください");
    }
    console.log("  → セッション復元成功");

    // 新規テキスト記事ページへ
    console.log("  📝 新規記事ページへ移動...");
    await page.goto("https://note.com/notes/new?kind=text", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/note-editor.png" });

    // タイトル入力
    console.log("  📝 タイトルを入力中...");
    const titleLocator = page.locator(
      '.o-editable-title, textarea[placeholder*="タイトル"], input[placeholder*="タイトル"], [data-placeholder*="タイトル"]'
    ).first();
    await titleLocator.waitFor({ timeout: 15000 });
    await titleLocator.click();
    await titleLocator.fill(title);
    await page.waitForTimeout(500);

    // 本文入力
    console.log("  ✍️  本文を入力中...");
    const editorLocator = page.locator('.ProseMirror').first();
    await editorLocator.waitFor({ timeout: 10000 });
    await editorLocator.click();
    await page.keyboard.insertText(body);
    await page.waitForTimeout(1000);

    // 有料設定
    console.log(`  💰 有料設定中（¥${NOTE_PRICE}）...`);
    const paidButton = page.locator('label:has-text("有料"), button:has-text("有料")').first();
    if (await paidButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await paidButton.click();
      await page.waitForTimeout(500);
      const priceInput = page.locator('input[placeholder*="価格"], input[placeholder*="円"]').first();
      if (await priceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await priceInput.fill(NOTE_PRICE);
      }
    } else {
      console.log("  ⚠️  有料設定UIが見つかりません（手動で設定してください）");
    }

    // 下書き保存
    console.log("  💾 下書き保存中...");
    const saveButton = page.locator(
      'button:has-text("下書き保存"), button:has-text("下書きとして保存")'
    ).first();
    await saveButton.waitFor({ timeout: 10000 });
    await saveButton.click();
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log(`  → 投稿完了: ${url}`);
    return url;
  } finally {
    await browser.close();
  }
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  if (!NOTE_COOKIES) {
    throw new Error("NOTE_COOKIES が設定されていません。scripts/get-note-cookies.ts を実行してください");
  }

  console.log("\n📮 post-to-note 開始\n");

  try {
    console.log("📂 記事を読み込み中...");
    const { title, body } = loadLatestArticle();
    const url = await postToNote(title, body);

    console.log("\n✅ 完了!");
    console.log(`   タイトル: ${title}`);
    console.log(`   URL     : ${url}`);
    console.log("   ※ note.com のダッシュボードで確認・公開してください");
  } catch (e) {
    console.error("\n❌ エラー:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
