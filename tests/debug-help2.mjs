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

const info = await page.evaluate(() => {
  const navRail = document.querySelector(".nav-rail");
  const ds = document.querySelector(".dashboard-screen");
  return {
    navRailScrollTop: navRail ? navRail.scrollTop : null,
    navRailOffsetTop: navRail ? navRail.getBoundingClientRect().top : null,
    navRailHeight: navRail ? navRail.getBoundingClientRect().height : null,
    navRailScrollHeight: navRail ? navRail.scrollHeight : null,
    docScrollTop: document.documentElement.scrollTop,
    dsHeight: ds ? ds.getBoundingClientRect().height : null,
    viewportHeight: window.innerHeight,
  };
});

console.log(JSON.stringify(info, null, 2));

// Take a full-page screenshot to see the layout
await page.screenshot({ path: "tests/results/screenshots/help_1920x200_full.png", fullPage: true });
console.log("Screenshot saved");

await ctx.close();
await browser.close();
