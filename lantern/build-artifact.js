// Builds a single-file version of Lantern for publishing as a claude.ai Artifact:
// the same page, styles, core and UI, with the Artifact backend in place of the server one.
//
//   node build-artifact.js   ->   artifact/lantern.html
"use strict";

const fs = require("fs");
const path = require("path");

const pub = (f) => fs.readFileSync(path.join(__dirname, "public", f), "utf8");
const html = pub("index.html");
const body = html.slice(html.indexOf("<body>") + "<body>".length, html.indexOf("<script")).trim();
// Inline scripts can't contain a literal closing script tag.
const inline = (js) => js.replace(/<\/script/gi, "<\\/script");

const out = `<title>Lantern</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Discover who you are with simple questions, share your thoughts, and feel a little less alone.">
<style>
${pub("styles.css")}
</style>
${body}
<script>
${inline(pub("core.js"))}
</script>
<script>
${inline(fs.readFileSync(path.join(__dirname, "artifact", "backend-artifact.js"), "utf8"))}
</script>
<script>
${inline(pub("app.js"))}
</script>
`;

fs.writeFileSync(path.join(__dirname, "artifact", "lantern.html"), out);
console.log(`Wrote artifact/lantern.html (${Math.round(out.length / 1024)} KB)`);
