// Ce script charge une image, détecte les couleurs de cartes et compte les ronds blancs pour chaque couleur.
const {Jimp} = require('jimp');
const { intToRGBA, rgbaToInt } = require("@jimp/utils");

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
  const image = await Jimp.read(imagePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  // Initialisation des compteurs
  const result = {};
  CARD_COLORS.forEach(c => (result[c.name] = 0));

  // Parcours de l'image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { r, g, b } = intToRGBA(image.getPixelColor(x, y));
      // Détection d'un rond blanc
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) {
        // Chercher la couleur de fond autour du pixel blanc
        for (const color of CARD_COLORS) {
          if (isColorNearby(image, x, y, color.rgb, COLOR_TOLERANCE)) {
            result[color.name]++;
            break;
          }
        }
      }
    }
  }
  return result;
}

function isColorNearby(image, x, y, targetRgb, tolerance) {
  // Vérifie dans un petit voisinage autour du pixel (x, y)
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= image.bitmap.width || ny >= image.bitmap.height) continue;
      const { r, g, b } = intToRGBA(image.getPixelColor(nx, ny));
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

// Exemple d'utilisation
if (require.main === module) {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.log('Usage: node countWhiteDots.js <imagePath>');
    process.exit(1);
  }
  countWhiteDots(imagePath).then(result => {
    console.log('Nombre de ronds blancs par couleur de carte :');
    console.log(result);
  });
}
