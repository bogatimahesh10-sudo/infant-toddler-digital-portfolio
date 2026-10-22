// Builds mobile/www from the web prototype in ../pace so the app works offline:
// adds a full document head, bundles the Inter font locally and starts at first-time setup.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pace = join(root, "..", "pace");
const www = join(root, "www");

rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, "fonts"), { recursive: true });

let page = readFileSync(join(pace, "index.html"), "utf8");
// The prototype loads Inter from Google Fonts; the app ships its own copy instead.
page = page.replace(/<link rel="preconnect"[^>]*>\s*/g, "").replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, "");
page = page.replace('<script src="core.js"></script>', '<script>window.PACE_START = "onboarding";</script>\n<script src="core.js"></script>');
page = page.replace('<script src="app.js"></script>', '<script src="app.js"></script>\n<script src="native.js"></script>');

const head = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#174d3a">
<link rel="stylesheet" href="fonts/inter.css">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font-size: 14px; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
`;
writeFileSync(join(www, "index.html"), head + page.replace(/^<title>/, "<title>") + "\n</html>\n");
// Everything before the first <div> in the prototype (title, meta, style) stays in <head>.
const html = readFileSync(join(www, "index.html"), "utf8");
const cut = html.indexOf('<div class="shell">');
writeFileSync(join(www, "index.html"), html.slice(0, cut) + "</head>\n<body>\n" + html.slice(cut).replace("\n</html>\n", "\n</body>\n</html>\n"));

for (const f of ["core.js", "seed.js", "provider.js", "app.js"]) copyFileSync(join(pace, f), join(www, f));
copyFileSync(join(root, "src", "native.js"), join(www, "native.js"));

const fontDir = join(root, "node_modules", "@fontsource", "inter", "files");
let css = "";
for (const w of [400, 500, 600, 700]) {
  const file = `inter-latin-${w}-normal.woff2`;
  copyFileSync(join(fontDir, file), join(www, "fonts", file));
  css += `@font-face { font-family: "Inter"; font-style: normal; font-weight: ${w}; font-display: swap; src: url("${file}") format("woff2"); }\n`;
}
writeFileSync(join(www, "fonts", "inter.css"), css);
console.log("Built", www);
