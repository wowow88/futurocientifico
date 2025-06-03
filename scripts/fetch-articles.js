import fs from 'fs';

const noticias = [
  {
    tipo: "noticia",
    titulo_es: "La NASA descubre indicios de agua en una luna de Júpiter",
    titulo_en: "NASA finds hints of water on a moon of Jupiter",
    url: "https://example.com/nasa-water-jupiter",
    imagen: "https://source.unsplash.com/featured/?space",
    tema: "astronomía",
    fuente: "NASA",
    fecha: new Date().toISOString().split('T')[0]
  },
  {
    tipo: "noticia",
    titulo_es: "Nuevo avance en edición genética CRISPR",
    titulo_en: "New breakthrough in CRISPR gene editing",
    url: "https://example.com/crispr-breakthrough",
    imagen: "https://source.unsplash.com/featured/?genetics",
    tema: "biotecnología",
    fuente: "Nature",
    fecha: new Date().toISOString().split('T')[0]
  }
];

fs.writeFileSync('./public/temp-articles.json', JSON.stringify(noticias, null, 2));
console.log('✅ Noticias de ejemplo guardadas correctamente.');
