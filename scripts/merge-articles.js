// scripts/merge-articles.js
import fs from 'fs';
import path from 'path';

const inputPath = './public/articles.json'; // Nombre actualizado
const outputDir = './workspace/articles';
const outputPath = path.join(outputDir, 'articles.json');

try {
  const articles = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const uniqueArticles = [];
  const seenTitles = new Set();

  for (const article of articles) {
    const title = article.title_es?.trim();
    if (title && !seenTitles.has(title)) {
      seenTitles.add(title);
      uniqueArticles.push(article);
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(uniqueArticles, null, 2));

  console.log('✅ Artículos fusionados y guardados (sin duplicados por título).');
  console.log('✅ Número de artículos combinados:', uniqueArticles.length);
} catch (err) {
  console.error('❌ Error procesando artículos:', err.message);
  process.exit(1);
}
