// Ce script utilise Sharp pour un traitement d'images ultra-rapide
// Sharp est beaucoup plus performant que Jimp pour les opérations sur les pixels
const sharp = require('sharp');

// Paramètres à ajuster selon vos images
const CARD_COLORS = [
    { name: 'bleu-marine', rgb: [50, 50, 130] },
    { name: 'bleu-turquoise', rgb: [60, 130, 190] },
    { name: 'vert', rgb: [70, 130, 60] },
    { name: 'orange', rgb: [200, 150, 70] },
    { name: 'rose', rgb: [200, 50, 150] },
  // Ajoutez d'autres couleurs si besoin
];
const WHITE_THRESHOLD = 220; // Seuil pour considérer un pixel comme blanc
const COLOR_TOLERANCE = 25; // Tolérance pour la détection de couleur de carte

async function countWhiteDots(imagePath) {
  // Chargement de l'image avec Sharp et extraction des données brutes
  const { data, info } = await sharp(imagePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const { width, height, channels } = info;
  console.log(`Image: ${width}x${height}, channels: ${channels}`);

  // Initialisation des compteurs
  const result = {};
  CARD_COLORS.forEach(c => (result[c.name] = 0));

  // Parcours de l'image - accès direct au buffer pour performance maximale
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * channels;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      // Détection d'un pixel blanc
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        // Chercher la couleur de fond autour du pixel blanc
        for (const color of CARD_COLORS) {
          if (isColorNearby(data, x, y, width, height, channels, color.rgb, COLOR_TOLERANCE)) {
            result[color.name]++;
            break;
          }
        }
      }
    }
  }
  return result;
}

function isColorNearby(data, x, y, width, height, channels, targetRgb, tolerance) {
  // Vérifie dans un petit voisinage autour du pixel (x, y)
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      
      const pixelIndex = (ny * width + nx) * channels;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      if (
        Math.abs(r - targetRgb[0]) < tolerance &&
        Math.abs(g - targetRgb[1]) < tolerance &&
        Math.abs(b - targetRgb[2]) < tolerance
      ) {
        return true;
      }
    }
  }
  return false;
}

// Version encore plus optimisée avec regroupement des pixels blancs
async function countWhiteDotsOptimized(imagePath) {
  const startTime = performance.now();
  
  // Chargement de l'image avec Sharp
  const { data, info } = await sharp(imagePath)
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const { width, height, channels } = info;
  console.log(`Image: ${width}x${height}, channels: ${channels}`);

  // Initialisation des compteurs
  const result = {};
  CARD_COLORS.forEach(c => (result[c.name] = 0));
  
  // Masque pour éviter de compter plusieurs fois le même point blanc
  const processed = new Set();

  // Parcours de l'image avec regroupement de pixels blancs adjacents
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      if (processed.has(key)) continue;
      
      const pixelIndex = (y * width + x) * channels;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      // Détection d'un pixel blanc
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        // Marquer les pixels blancs adjacents pour éviter les doublons
        const whiteCluster = getWhiteCluster(data, x, y, width, height, channels, WHITE_THRESHOLD);
        whiteCluster.forEach(pos => processed.add(`${pos.x},${pos.y}`));
        
        // Chercher la couleur de fond autour du cluster
        const centerX = Math.round(whiteCluster.reduce((sum, pos) => sum + pos.x, 0) / whiteCluster.length);
        const centerY = Math.round(whiteCluster.reduce((sum, pos) => sum + pos.y, 0) / whiteCluster.length);
        
        for (const color of CARD_COLORS) {
          if (isColorNearby(data, centerX, centerY, width, height, channels, color.rgb, COLOR_TOLERANCE)) {
            result[color.name]++;
            break;
          }
        }
      }
    }
  }
  
  const endTime = performance.now();
  console.log(`Traitement terminé en ${(endTime - startTime).toFixed(2)} ms`);
  
  return result;
}

function getWhiteCluster(data, startX, startY, width, height, channels, threshold) {
  const cluster = [];
  const toVisit = [{ x: startX, y: startY }];
  const visited = new Set();
  
  while (toVisit.length > 0) {
    const { x, y } = toVisit.pop();
    const key = `${x},${y}`;
    
    if (visited.has(key) || x < 0 || y < 0 || x >= width || y >= height) continue;
    visited.add(key);
    
    const pixelIndex = (y * width + x) * channels;
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    
    if (r > threshold && g > threshold && b > threshold) {
      cluster.push({ x, y });
      
      // Ajouter les voisins (4-connectivité)
      toVisit.push({ x: x + 1, y });
      toVisit.push({ x: x - 1, y });
      toVisit.push({ x, y: y + 1 });
      toVisit.push({ x, y: y - 1 });
    }
  }
  
  return cluster;
}

// Exemple d'utilisation
if (require.main === module) {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.log('Usage: node countWhiteDotsSharp.js <imagePath>');
    process.exit(1);
  }
  
  console.log('Utilisation de Sharp pour un traitement ultra-rapide...');
  
  // Version optimisée avec regroupement des pixels blancs
  countWhiteDotsOptimized(imagePath).then(result => {
    console.log('\nNombre de ronds blancs par couleur de carte (optimisé):');
    console.log(result);
  }).catch(error => {
    console.error('Erreur:', error.message);
  });
}

module.exports = { countWhiteDots, countWhiteDotsOptimized };
