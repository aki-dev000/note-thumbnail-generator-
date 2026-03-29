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
    await page.waitForTimeout(2000);

    await page.locator("input#email").fill(NOTE_EMAIL);
    await page.locator("input#password").fill(NOTE_PASSWORD);
    // ログインボタン（data-type="primary"）が有効になるまで待つ
    await page.locator('button[data-type="primary"]').last().waitFor({ state: "visible" });
    await page.locator('button[data-type="primary"]').last().click();
    await page.waitForURL(/note\.com\/(?!login)/, { timeout: 20000 });
    console.log("  → ログイン成功");

    // ── 新規テキスト記事を作成 ──
    console.log("  📝 新規記事ページへ移動...");
    await page.goto("https://note.com/notes/new?kind=text", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/note-editor.png" });
    console.log("  → スクリーンショット: /tmp/note-editor.png");

    // ── タイトル入力 ──
    console.log("  📝 タイトルを入力中...");
    const titleLocator = page.locator(
      '.o-editable-title, textarea[placeholder*="タイトル"], input[placeholder*="タイトル"], [data-placeholder*="タイトル"]'
    ).first();
    await titleLocator.waitFor({ timeout: 10000 });
    await titleLocator.click();
    await titleLocator.fill(title);
    await page.waitForTimeout(500);

    // ── 本文入力 ──
    console.log("  ✍️  本文を入力中...");
    const editorLocator = page.locator(
      '.ProseMirror, [contenteditable="true"][class*="editor"], [contenteditable="true"][class*="body"]'
    ).first();
    await editorLocator.waitFor({ timeout: 10000 });
    await editorLocator.click();
    // 長文は keyboard.insertText で挿入（clipboard API はヘッドレスで不安定）
    await page.keyboard.insertText(body);
    await page.waitForTimeout(1000);

    // ── 有料設定 ──
    console.log(`  💰 有料設定中（¥${NOTE_PRICE}）...`);
    const paidButton = page.locator('label:has-text("有料"), button:has-text("有料"), [data-label*="有料"]').first();
    if (await paidButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await paidButton.click();
      await page.waitForTimeout(500);
      const priceInput = page.locator(
        'input[placeholder*="価格"], input[placeholder*="円"], input[name*="price"]'
      ).first();
      if (await priceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await priceInput.fill(NOTE_PRICE);
      }
    } else {
      console.log("  ⚠️  有料設定UIが見つかりません（手動で設定してください）");
    }

    // ── 下書き保存 ──
    console.log("  💾 下書き保存中...");
    const saveButton = page.locator(
      'button:has-text("下書き保存"), button:has-text("下書きとして保存"), button:has-text("保存")'
    ).first();
    await saveButton.waitFor({ timeout: 10000 });
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
