// scripts/merge-articles.js
import fs from 'fs';
import path from 'path';

const inputPath = './public/articles_js.json';
const outputPath = './public/articles.json';

if (fs.existsSync(inputPath)) {
  const data = JSON.parse(fs.readFileSync(inputPath));

  // Crear mapa para eliminar duplicados por título_es normalizado
  const seen = new Map();
  const deduplicated = [];

  data.forEach(article => {
    const normalizedTitle = article.title_es?.toLowerCase().trim();
    if (normalizedTitle && !seen.has(normalizedTitle)) {
      seen.set(normalizedTitle, true);
      deduplicated.push(article);
    }
  });

  fs.writeFileSync(outputPath, JSON.stringify(deduplicated, null, 2));
  console.log("✅ Artículos fusionados y guardados (sin duplicados por título).");
} else {
  console.log("⚠️ No se encontró el archivo de entrada.");
}
