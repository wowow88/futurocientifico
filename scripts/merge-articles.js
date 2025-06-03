import fs from 'fs';

const revistasPath = './public/articles.json';
const noticiasPath = './public/temp-articles.json';
const salidaPath = './public/articles.json';

function leerArchivo(path) {
  try {
    const data = fs.readFileSync(path, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function quitarDuplicados(articulos) {
  const titulos = new Set();
  return articulos.filter((art) => {
    const clave = art.titulo_en?.toLowerCase().trim();
    if (titulos.has(clave)) return false;
    titulos.add(clave);
    return true;
  });
}

function mergeArticulos() {
  const revistas = leerArchivo(revistasPath);
  const noticias = leerArchivo(noticiasPath);
  const combinados = quitarDuplicados([...revistas, ...noticias]);
  fs.writeFileSync(salidaPath, JSON.stringify(combinados, null, 2));
  console.log(`✅ Artículos combinados: ${combinados.length}`);
}

mergeArticulos();
