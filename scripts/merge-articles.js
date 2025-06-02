// scripts/merge-articles.js
import fs from 'fs';
import path from 'path';

const inputPath = './public/articles_js.json';
const outputDir = './workspace/articles';
const outputPath = path.join(outputDir, 'articles.json');

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

  // Asegurar que el directorio de salida existe
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(outputPath, JSON.stringify(deduplicated, null, 2));
  console.log("✅ Artículos fusionados y guardados en './workspace/articles/articles.json'.");
} else {
  console.log("⚠️ No se encontró el archivo de entrada en './public/articles_js.json'.");
}
