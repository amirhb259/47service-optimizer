import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 200 } });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:1420", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".lite-action", { timeout: 5000 });
await page.click(".lite-action");
await page.waitForSelector(".dashboard-screen");
await page.waitForTimeout(300);
await page.click(".nav-button:nth-child(5)");
await page.waitForTimeout(300);

const topClip = await page.evaluate(() => {
  const els = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -5 && r.width >= 1 && r.height >= 1) {
      const tag = el.tagName;
      const cls = String(el.className || "").slice(0, 100);
      const text = (el.textContent || "").trim().slice(0, 80);
      els.push({ tag, cls, text, top: r.top.toFixed(1), bottom: r.bottom.toFixed(1) });
      if (els.length >= 20) break;
    }
  }
  return els;
});

console.log("Top-clipped elements at help 1920x200:");
console.log(JSON.stringify(topClip, null, 2));

await ctx.close();
await browser.close();
