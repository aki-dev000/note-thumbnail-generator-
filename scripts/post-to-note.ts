/**
 * post-to-note.ts
 * 有料Note/配下の最新記事を note.com に下書き投稿する
 */

import { chromium } from "playwright";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const OUTPUT_DIR = resolve(process.env.OUTPUT_DIR ?? "/Users/takagi/ai-management/有料Note");
const NOTE_EMAIL = process.env.NOTE_EMAIL!;
const NOTE_PASSWORD = process.env.NOTE_PASSWORD!;
const NOTE_PRICE = process.env.NOTE_PRICE ?? "300"; // 円

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

  // タイトル（# 行）を抽出
  const titleMatch = content.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "タイトルなし";

  // 本文（--- と --- の間）を抽出
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
  const page = await context.newPage();

  try {
    // ── ログイン ──
    console.log("  🔑 ログイン中...");
    await page.goto("https://note.com/login", { waitUntil: "domcontentloaded" });

    await page.locator('input[name="email"]').fill(NOTE_EMAIL);
    await page.locator('input[name="password"]').fill(NOTE_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/note\.com\/(?!login)/, { timeout: 15000 });
    console.log("  → ログイン成功");

    // ── 新規テキスト記事を作成 ──
    console.log("  📝 新規記事ページへ移動...");
    await page.goto("https://note.com/notes/new?kind=text", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // ── タイトル入力 ──
    const titleSelector = 'textarea[placeholder*="タイトル"], input[placeholder*="タイトル"], .title-input textarea';
    await page.locator(titleSelector).first().fill(title);

    // ── 本文入力 ──
    console.log("  ✍️  本文を入力中...");
    const editorSelector = '.ProseMirror, [contenteditable="true"], .editor-content';
    const editor = page.locator(editorSelector).first();
    await editor.click();
    await page.keyboard.insertText(body);
    await page.waitForTimeout(1000);

    // ── 有料設定 ──
    console.log(`  💰 有料設定中（¥${NOTE_PRICE}）...`);

    // 「公開設定」または「有料」ボタンを探す
    const settingButton = page.locator(
      'button:has-text("公開設定"), button:has-text("設定"), button[aria-label*="設定"]'
    ).first();
    if (await settingButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingButton.click();
      await page.waitForTimeout(1000);
    }

    // 有料ラジオボタン or トグル
    const paidOption = page.locator(
      'label:has-text("有料"), input[value="paid"], button:has-text("有料")'
    ).first();
    if (await paidOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await paidOption.click();
      await page.waitForTimeout(500);

      // 価格入力
      const priceInput = page.locator('input[name*="price"], input[placeholder*="価格"], input[placeholder*="円"]').first();
      if (await priceInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await priceInput.fill(NOTE_PRICE);
      }
    }

    // ── 下書き保存 ──
    console.log("  💾 下書き保存中...");
    const saveButton = page.locator(
      'button:has-text("下書き保存"), button:has-text("下書きとして保存")'
    ).first();
    await saveButton.click();
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log(`  → 保存完了: ${url}`);
    return url;
  } finally {
    await browser.close();
  }
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  if (!NOTE_EMAIL || !NOTE_PASSWORD) {
    throw new Error("NOTE_EMAIL と NOTE_PASSWORD を環境変数に設定してください");
  }

  console.log("\n📮 post-to-note 開始\n");

  try {
    console.log("📂 記事を読み込み中...");
    const { title, body } = loadLatestArticle();

    const url = await postToNote(title, body);

    console.log("\n✅ 完了!");
    console.log(`   タイトル: ${title}`);
    console.log(`   URL     : ${url}`);
    console.log("\n  ※ note.com のダッシュボードで内容を確認・公開してください");
  } catch (e) {
    console.error("\n❌ エラー:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
