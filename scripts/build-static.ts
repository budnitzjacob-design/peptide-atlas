import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { peptideRecords, sourceRegistry } from "../src/data/peptide-records";
import { evidenceLegend, evidenceTierLabel } from "../src/lib/evidence";

const staticDir = "static";

mkdirSync(`${staticDir}/fonts`, { recursive: true });
copyFileSync(
  "public/fonts/PixelSpaceFreePersonalUseR-zrppw.ttf",
  `${staticDir}/fonts/PixelSpaceFreePersonalUseR-zrppw.ttf`
);
copyFileSync("public/fonts/audio-nugget.ttf", `${staticDir}/fonts/audio-nugget.ttf`);
copyFileSync("public/fonts/toxigenesis.rg-bold.otf", `${staticDir}/fonts/toxigenesis.rg-bold.otf`);
copyFileSync("public/fonts/golden-girdle.otf", `${staticDir}/fonts/golden-girdle.otf`);
copyFileSync("public/favicon.png", `${staticDir}/favicon.png`);
if (existsSync("public/structures")) {
  cpSync("public/structures", `${staticDir}/structures`, { recursive: true });
}
copyFileSync("static-src/styles.css", `${staticDir}/styles.css`);
copyFileSync("static-src/app.js", `${staticDir}/app.js`);

const data = {
  peptides: peptideRecords,
  sourceRegistry,
  evidenceLegend,
  evidenceTierLabel,
  generatedAt: new Date().toISOString()
};

writeFileSync(`${staticDir}/data.js`, `window.PEPTIDE_ATLAS_DATA = ${JSON.stringify(data)};\n`);

const appScript = readFileSync("static-src/app.js", "utf8");
const appVersion = Buffer.from(appScript).byteLength;

writeFileSync(
  `${staticDir}/index.html`,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>peptocopeia</title>
  <meta name="description" content="peptocopeia is a source-backed peptide reference with citation review, vendor metadata, and moderator verification workflows.">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="stylesheet" href="/styles.css?v=${appVersion}">
</head>
<body>
  <main id="app"></main>
  <script src="/data.js?v=${appVersion}"></script>
  <script src="/app.js?v=${appVersion}"></script>
</body>
</html>
`
);

console.log(`Built Peptocopeia static review build with ${peptideRecords.length} records.`);
