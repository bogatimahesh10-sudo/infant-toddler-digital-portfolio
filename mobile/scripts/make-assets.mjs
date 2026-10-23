// Renders the launcher icons, splash screens and Play Store graphics from one SVG design,
// and takes store screenshots from the real app. Needs Playwright with Chromium:
//   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/make-assets.mjs
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync, mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = join(root, "android", "app", "src", "main", "res");
const FOREST = "#174d3a", WARM = "#faf8f2", MINT = "#eaf3ed";
const font = (w) => `url(data:font/woff2;base64,${readFileSync(join(root, "node_modules/@fontsource/inter/files", `inter-latin-${w}-normal.woff2`)).toString("base64")})`;
const fontCss = `@font-face{font-family:Inter;font-weight:700;src:${font(700)}}@font-face{font-family:Inter;font-weight:500;src:${font(500)}}`;

// The Pace mark: a ring with its first quarter drawn in, around a dot. Drawn in a 100-unit box.
const mark = (x, y, size) => {
  const s = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="50" cy="50" r="38" fill="none" stroke="${WARM}" stroke-opacity=".28" stroke-width="11"/>
    <path d="M50 12 A38 38 0 0 1 88 50" fill="none" stroke="${WARM}" stroke-width="11" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="12" fill="${MINT}"/></g>`;
};
const svgDoc = (w, h, body) => `<html><head><style>${fontCss}html,body{margin:0;background:transparent}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg></body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
async function render(file, w, h, body, transparent) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(svgDoc(w, h, body));
  await page.screenshot({ path: file, omitBackground: !!transparent, clip: { x: 0, y: 0, width: w, height: h } });
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  const L = Math.round(48 * k), F = Math.round(108 * k);
  await render(join(res, `mipmap-${d}`, "ic_launcher.png"), L, L, `<rect width="${L}" height="${L}" rx="${L * 0.22}" fill="${FOREST}"/>${mark(L * 0.18, L * 0.18, L * 0.64)}`, true);
  await render(join(res, `mipmap-${d}`, "ic_launcher_round.png"), L, L, `<circle cx="${L / 2}" cy="${L / 2}" r="${L / 2}" fill="${FOREST}"/>${mark(L * 0.2, L * 0.2, L * 0.6)}`, true);
  // Adaptive foreground: keep the mark inside the 66dp safe zone of the 108dp canvas.
  await render(join(res, `mipmap-${d}`, "ic_launcher_foreground.png"), F, F, mark(F * 0.3, F * 0.3, F * 0.4), true);
}
const splash = (w, h) => `<rect width="${w}" height="${h}" fill="${FOREST}"/>${mark(w / 2 - Math.min(w, h) * 0.11, h / 2 - Math.min(w, h) * 0.11, Math.min(w, h) * 0.22)}`;
for (const [dir, w, h] of [["drawable", 480, 320], ["drawable-land-mdpi", 480, 320], ["drawable-land-hdpi", 800, 480], ["drawable-land-xhdpi", 1280, 720], ["drawable-land-xxhdpi", 1600, 960], ["drawable-land-xxxhdpi", 1920, 1280], ["drawable-port-mdpi", 320, 480], ["drawable-port-hdpi", 480, 800], ["drawable-port-xhdpi", 720, 1280], ["drawable-port-xxhdpi", 960, 1600], ["drawable-port-xxxhdpi", 1280, 1920]]) {
  await render(join(res, dir, "splash.png"), w, h, splash(w, h));
}
// iOS: one 1024×1024 opaque icon (iOS rounds the corners itself) and a 2732×2732 splash.
const ios = join(root, "ios", "App", "App", "Assets.xcassets");
await render(join(ios, "AppIcon.appiconset", "AppIcon-512@2x.png"), 1024, 1024, `<rect width="1024" height="1024" fill="${FOREST}"/>${mark(232, 232, 560)}`);
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) await render(join(ios, "Splash.imageset", f), 2732, 2732, splash(2732, 2732));
// Play Store: 512×512 icon and 1024×500 feature graphic.
await render(join(root, "store", "icon-512.png"), 512, 512, `<rect width="512" height="512" fill="${FOREST}"/>${mark(116, 116, 280)}`);
await render(join(root, "store", "feature-graphic-1024x500.png"), 1024, 500, `<rect width="1024" height="500" fill="${FOREST}"/>${mark(96, 150, 200)}
  <text x="340" y="232" font-family="Inter" font-weight="700" font-size="96" fill="${WARM}" letter-spacing="-3">Pace</text>
  <text x="344" y="300" font-family="Inter" font-weight="500" font-size="34" fill="${MINT}">Know what you can safely spend</text>
  <text x="344" y="344" font-family="Inter" font-weight="500" font-size="34" fill="${MINT}">before your next payday.</text>`);

// Phone screenshots, 1080×1920, from the web prototype with its sample data (labelled in the app).
const shots = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
await shots.goto(process.env.PACE_PAGE_URL || pathToFileURL(join(root, "..", "pace", "index.html")).href);
await shots.waitForTimeout(400);
// Collapse the sample-data notice; the header keeps its "Sample data" label.
if (await shots.locator("[data-act=dismiss]").count()) await shots.click("[data-act=dismiss]");
for (const [name, tab] of [["1-home", "home"], ["2-budget", "budget"], ["3-goals", "goals"], ["4-insights", "insights"]]) {
  await shots.click(`[data-tab=${tab}]`);
  await shots.evaluate(() => window.scrollTo(0, 0));
  await shots.waitForTimeout(200);
  await shots.screenshot({ path: join(root, "store", `screenshot-${name}.png`) });
}
// App Store: 1290×2796 iPhone screenshots (accepted for the 6.9-inch display slot).
const iphone = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
await iphone.goto(process.env.PACE_PAGE_URL || pathToFileURL(join(root, "..", "pace", "index.html")).href);
await iphone.waitForTimeout(400);
if (await iphone.locator("[data-act=dismiss]").count()) await iphone.click("[data-act=dismiss]");
mkdirSync(join(root, "store", "ios"), { recursive: true });
for (const [name, tab] of [["1-home", "home"], ["2-budget", "budget"], ["3-goals", "goals"], ["4-insights", "insights"]]) {
  await iphone.click(`[data-tab=${tab}]`);
  await iphone.evaluate(() => window.scrollTo(0, 0));
  await iphone.waitForTimeout(200);
  await iphone.screenshot({ path: join(root, "store", "ios", `iphone-${name}.png`) });
}
await browser.close();
console.log("Assets written");
