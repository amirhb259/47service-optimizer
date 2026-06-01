import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(__dirname, "results");
const SCREENSHOTS = join(__dirname, "results", "screenshots");

if (!existsSync(RESULTS)) mkdirSync(RESULTS, { recursive: true });
if (!existsSync(SCREENSHOTS)) mkdirSync(SCREENSHOTS, { recursive: true });

const APP_URL = "http://127.0.0.1:1420";

const WIDTHS = [1, 2, 3, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 960, 1000, 1100, 1200, 1366, 1440, 1600, 1920, 2560, 3200, 3840];
const HEIGHTS = [1, 10, 50, 100, 200, 300, 400, 500, 600, 700, 768, 800, 900, 1000, 1080, 1200, 1440, 1600, 1800, 2160];
const EDGE_CASES = [[1, 1], [1, 1920], [2, 1], [3, 1920], [900, 600], [3840, 2160]];

const DASHBOARD_SECTIONS = ["overview", "modules", "settings", "help"];
const NAV_SELECTORS = {
  overview: ".nav-button:nth-child(1)",
  modules: ".nav-button:nth-child(2)",
  settings:".nav-button:nth-child(3)",
  help:    ".nav-button:nth-child(4)",
};

const allFailures = [];
let totalChecks = 0;
let passedChecks = 0;

function expectsOverflow(w, h) {
  return w < 200 || h < 200;
}

function isClickable(w, h) {
  return w >= 50 && h >= 50;
}

function* genViewports() {
  const seen = new Set();
  const add = (w, h, label) => {
    const key = `${w}x${h}`;
    if (seen.has(key)) return;
    seen.add(key);
    return { w, h, label };
  };
  for (const [w, h] of EDGE_CASES) {
    const r = add(w, h, `edge ${w}x${h}`);
    if (r) yield r;
  }
  for (const w of WIDTHS) {
    const r = add(w, 1080, `w${w}`);
    if (r) yield r;
  }
  for (const h of HEIGHTS) {
    const r = add(1920, h, `h${h}`);
    if (r) yield r;
  }
}

function hasFailures(checks, w, h) {
  if (checks.fatal) return true;
  if (checks.consoleErrors && checks.consoleErrors.length > 0) return true;
  if (checks.nanText || checks.undefinedText) return true;
  if (checks.navHeightVariance) return true;
  if (!expectsOverflow(w, h)) {
    if (checks.horizontalOverflow) return true;
    if ((checks.zeroDimButtons || 0) > 0) return true;
    if ((checks.leftClip || 0) > 0) return true;
    if ((checks.topClip || 0) > 0) return true;
  }
  return false;
}

function formatChecks(checks) {
  const parts = [];
  if (checks.fatal) parts.push("FATAL");
  if (checks.consoleErrors && checks.consoleErrors.length) parts.push(`console(${checks.consoleErrors.length})`);
  if (checks.nanText) parts.push("NaN");
  if (checks.undefinedText) parts.push("undefined");
  if (checks.horizontalOverflow) parts.push("H-overflow");
  if ((checks.leftClip || 0) > 0) parts.push(`leftClip(${checks.leftClip})`);
  if ((checks.topClip || 0) > 0) parts.push(`topClip(${checks.topClip})`);
  if (checks.navHeightVariance) parts.push("navHt");
  if ((checks.zeroDimButtons || 0) > 0) parts.push(`zeroBtn(${checks.zeroDimButtons})`);
  return parts.join(" ") || "OK";
}

async function createCollector(page) {
  const errors = [];
  const handler = (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  };
  page.on("console", handler);
  return {
    errors,
    detach() { page.removeListener("console", handler); },
  };
}

async function evaluateChecks(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const w = window;
    const hOverflow = d.scrollWidth > w.innerWidth + 2;
    const allEls = [...document.querySelectorAll("*")];
    let leftClipEls = 0;
    let topClipEls = 0;
    let zeroDimButtons = 0;

    for (const el of allEls) {
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;
      if (r.width < 1) continue; // zero-width elements are invisible/artifacts
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      // Element is off the LEFT side — real layout bug
      if (r.right < -5) leftClipEls++;
      // Element is off the TOP (fully above viewport) — suggests broken positioning
      if (r.bottom < -5) topClipEls++;
    }

    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) zeroDimButtons++;
    }

    const bodyText = document.body?.innerText || "";
    const hasNan = /\bNaN\b/.test(bodyText);
    const hasUndefined = /\bundefined\b/.test(bodyText);

    const navButtons = document.querySelectorAll(".nav-button");
    let navHeightVariance = false;
    if (navButtons.length > 1) {
      const heights = [];
      for (const nb of navButtons) heights.push(nb.getBoundingClientRect().height);
      if (Math.max(...heights) - Math.min(...heights) > 1.5) navHeightVariance = true;
    }

    return { horizontalOverflow: hOverflow, leftClip: leftClipEls, topClip: topClipEls, zeroDimButtons, nanText: hasNan, undefinedText: hasUndefined, navHeightVariance };
  });
}

async function run() {
  console.log("=== 47Service UI Stress Test ===\n");

  const browser = await chromium.launch({ headless: true });

  // Phase 1: License screen
  console.log("--- License screen sweep ---");
  for (const vp of genViewports()) {
    const { w, h, label } = vp;
    let ctx, page, collector;
    try {
      ctx = await browser.newContext({ viewport: { width: w, height: h } });
      page = await ctx.newPage();
      collector = await createCollector(page);

      await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForSelector(".license-screen", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);

      const layout = await evaluateChecks(page);
      collector.detach();
      const checks = { ...layout, consoleErrors: collector.errors };

      totalChecks++;
      const failed = hasFailures(checks, w, h);
      const status = failed ? "FAIL" : "PASS";
      const expected = expectsOverflow(w, h) ? " (overflow expected)" : "";
      console.log(`  [${status}] license @ ${label}${expected} — ${formatChecks(checks)}`);

      if (failed) {
        allFailures.push({ section: "license", width: w, height: h, checks, screenshot: `license_${w}x${h}.png` });
        try { await page.screenshot({ path: join(SCREENSHOTS, `license_${w}x${h}.png`), fullPage: false }); } catch {}
      } else {
        passedChecks++;
      }

      await ctx.close();
    } catch (err) {
      if (collector) collector.detach();
      console.log(`  [ERROR] license @ ${label} — ${err.message}`);
      allFailures.push({ section: "license", width: w, height: h, checks: { consoleErrors: [err.message], fatal: true }, screenshot: `license_${w}x${h}.png` });
      if (page) try { await page.screenshot({ path: join(SCREENSHOTS, `license_${w}x${h}.png`), fullPage: false }); } catch {}
      if (ctx) await ctx.close().catch(() => {});
    }
  }

  // Phase 2: Dashboard sections
  console.log("\n--- Dashboard section sweep ---");
  for (const vp of genViewports()) {
    const { w, h, label } = vp;

    if (!isClickable(w, h)) {
      console.log(`  [SKIP] dashboard @ ${label} — too small for interaction`);
      continue;
    }

    let ctx, page, collector;
    try {
      ctx = await browser.newContext({ viewport: { width: w, height: h } });
      page = await ctx.newPage();
      collector = await createCollector(page);

      await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForSelector(".lite-action", { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);

      await page.click(".lite-action", { timeout: 2000 });
      await page.waitForSelector(".dashboard-screen", { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);

      for (const section of DASHBOARD_SECTIONS) {
        const sel = NAV_SELECTORS[section];
        try {
          // dispatchEvent avoids Playwright auto-scroll inside nav-rail
          await page.evaluate((s) => {
            const btn = document.querySelector(s);
            if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          }, sel);
          await page.waitForTimeout(250);
        } catch {
          // If we can't click nav at this size, skip remaining sections
          continue;
        }

        collector.detach();
        collector = await createCollector(page);
        await page.waitForTimeout(100);

        const layout = await evaluateChecks(page);
        collector.detach();
        const checks = { ...layout, consoleErrors: collector.errors };

        totalChecks++;
        const failed = hasFailures(checks, w, h);
        const status = failed ? "FAIL" : "PASS";
        const expected = expectsOverflow(w, h) ? " (overflow expected)" : "";
        console.log(`  [${status}] ${section} @ ${label}${expected} — ${formatChecks(checks)}`);

        if (failed) {
          allFailures.push({ section, width: w, height: h, checks, screenshot: `${section}_${w}x${h}.png` });
          try { await page.screenshot({ path: join(SCREENSHOTS, `${section}_${w}x${h}.png`), fullPage: false }); } catch {}
        } else {
          passedChecks++;
        }

        collector = await createCollector(page);
      }

      await ctx.close();
    } catch (err) {
      if (collector) collector.detach();
      console.log(`  [ERROR] dashboard @ ${label} — ${err.message}`);
      allFailures.push({ section: "dashboard", width: w, height: h, checks: { consoleErrors: [err.message], fatal: true }, screenshot: `dashboard_${w}x${h}.png` });
      if (page) try { await page.screenshot({ path: join(SCREENSHOTS, `dashboard_${w}x${h}.png`), fullPage: false }); } catch {}
      if (ctx) await ctx.close().catch(() => {});
    }
  }

  await browser.close();

  // Report
  const report = { total: totalChecks, passed: passedChecks, failed: allFailures.length, failures: allFailures };
  writeFileSync(join(RESULTS, "report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== Results ===");
  console.log(`  Total checks: ${report.total}`);
  console.log(`  Passed:       ${report.passed}`);
  console.log(`  Failed:       ${report.failed}`);
  if (report.failed > 0) {
    console.log("\nFailures:");
    for (const f of report.failures) {
      console.log(`  ${f.section} @ ${f.width}x${f.height}: ${JSON.stringify(f.checks)}`);
    }
  }
  console.log(`\nFull report: ${join(RESULTS, "report.json")}`);
  process.exit(report.failed > 0 ? 1 : 0);
}

run().catch((err) => { console.error("Fatal:", err); process.exit(1); });
