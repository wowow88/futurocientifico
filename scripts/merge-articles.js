// scripts/merge-articles.js
import fs from 'fs';

const filePath = './public/articles.json';

try {
  const articles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const uniqueArticles = [];
  const seenTitles = new Set();

  for (const article of articles) {
    const title = article.title_es?.trim();
    if (title && !seenTitles.has(title)) {
      seenTitles.add(title);
      uniqueArticles.push(article);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(uniqueArticles, null, 2));

  console.log('✅ Artículos fusionados y guardados sin duplicados.');
  console.log('✅ Total:', uniqueArticles.length);
} catch (err) {
  console.error('❌ Error procesando artículos:', err.message);
  process.exit(1);
}
