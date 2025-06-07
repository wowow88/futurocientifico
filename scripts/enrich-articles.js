import fs from 'fs';

const filePath = './public/articles.json';
const outputPath = './public/articles_enriched.json';

const raw = fs.readFileSync(filePath, 'utf-8');
const articles = JSON.parse(raw);

// Heurística básica para detección
const detectCategory = (title) => {
  if (/journal|revista/i.test(title)) return 'revista';
  if (/study|discovery|research|noticia/i.test(title)) return 'noticia';
  return 'noticia'; // por defecto
};

// Generador simulado de descripción y etiquetas
const generateDescription = (title) =>
  `Este artículo trata sobre "${title}". Se exploran los aspectos clave relacionados con la ciencia actual.`;
const generateTags = (title) =>
  title
    .split(' ')
    .slice(0, 3)
    .map(t => t.toLowerCase().replace(/[^a-záéíóúüñ]/gi, ''));

const enriched = articles.map(article => ({
  ...article,
  description: article.description || generateDescription(article.title_es || article.title),
  tags: article.tags || generateTags(article.title),
  category: article.category || detectCategory(article.title),
}));

fs.writeFileSync('./public/articles.json', JSON.stringify(enrichedArticles, null, 2));
console.log(`✅ Archivo enriquecido guardado en ${outputPath}`);
