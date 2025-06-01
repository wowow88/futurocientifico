// scripts/merge-articles.js
import fs from 'fs';
const inputPath = './workspace/astro/public/articles_js.json';
const outputPath = './workspace/astro/public/articles.json';

if (fs.existsSync(inputPath)) {
  const data = JSON.parse(fs.readFileSync(inputPath));
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log("✅ Artículos fusionados y guardados.");
} else {
  console.log("⚠️ No se encontró el archivo de entrada.");
}
