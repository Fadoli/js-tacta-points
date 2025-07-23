const WhiteCircleDetector = require('./detectWhiteCircles');

/**
 * Configuration avancée pour le réglage fin des paramètres
 */
const CONFIG = {
    // Paramètres de détection des pixels blancs
    whiteDetection: {
        minBrightness: 180,    // Luminosité minimale (0-255)
        maxSaturation: 40,     // Saturation maximale pour considérer comme blanc
        minSize: 8            // Taille minimale d'un groupe de pixels blancs
    },
    
    // Paramètres de groupement des pixels
    grouping: {
        maxDistance: 4,        // Distance maximale pour considérer des pixels comme connectés
        minGroupSize: 10       // Taille minimale d'un groupe pour être considéré comme un rond
    },
    
    // Paramètres d'analyse des couleurs environnantes
    colorAnalysis: {
        sampleRadius: 20,      // Rayon autour du rond pour échantillonner la couleur
        samplePoints: 24,      // Nombre de points d'échantillonnage
        confidenceThreshold: 0.8 // Seuil de confiance pour accepter une couleur
    }
};

/**
 * Couleurs de cartes avec des paramètres HSL plus fins
 * Utilise l'espace HSL pour une meilleure robustesse aux variations d'éclairage
 */
const ADVANCED_CARD_COLORS = [
    {
        name: 'bleu-marine',
        hsl: { h: 240, s: 65, l: 25 },
        tolerance: { h: 25, s: 35, l: 20 },
        description: 'Bleu marine foncé'
    },
    {
        name: 'bleu-turquoise',
        hsl: { h: 190, s: 70, l: 45 },
        tolerance: { h: 30, s: 35, l: 25 },
        description: 'Bleu turquoise clair'
    },
    {
        name: 'vert',
        hsl: { h: 120, s: 50, l: 35 },
        tolerance: { h: 35, s: 40, l: 25 },
        description: 'Vert standard'
    },
    {
        name: 'vert-clair',
        hsl: { h: 100, s: 60, l: 55 },
        tolerance: { h: 25, s: 35, l: 30 },
        description: 'Vert plus clair'
    },
    {
        name: 'orange',
        hsl: { h: 30, s: 75, l: 55 },
        tolerance: { h: 20, s: 30, l: 25 },
        description: 'Orange standard'
    },
    {
        name: 'orange-rouge',
        hsl: { h: 15, s: 80, l: 50 },
        tolerance: { h: 15, s: 25, l: 20 },
        description: 'Orange tirant vers le rouge'
    },
    {
        name: 'rose',
        hsl: { h: 320, s: 75, l: 50 },
        tolerance: { h: 30, s: 30, l: 25 },
        description: 'Rose/magenta'
    },
    {
        name: 'violet',
        hsl: { h: 280, s: 60, l: 45 },
        tolerance: { h: 25, s: 35, l: 25 },
        description: 'Violet/pourpre'
    }
];

/**
 * Classe avancée pour la détection avec paramètres configurables
 */
class AdvancedWhiteCircleDetector extends WhiteCircleDetector {
    constructor(imagePath, config = CONFIG, colors = ADVANCED_CARD_COLORS) {
        super(imagePath);
        this.config = config;
        this.cardColors = colors;
    }

    /**
     * Détection améliorée des pixels blancs avec paramètres configurables
     */
    isWhitePixel(x, y) {
        const color = this.getPixelColor(x, y);
        if (!color) return false;

        const hsl = this.rgbToHsl(color.r, color.g, color.b);
        
        return hsl.l >= (this.config.whiteDetection.minBrightness / 255) * 100 &&
               hsl.s <= this.config.whiteDetection.maxSaturation;
    }

    /**
     * Groupement amélioré avec paramètres configurables
     */
    groupWhitePixels(whitePixels) {
        const groups = [];
        const visited = new Set();
        
        for (const pixel of whitePixels) {
            const key = `${pixel.x},${pixel.y}`;
            if (visited.has(key)) continue;
            
            const group = this.floodFill(
                pixel, 
                whitePixels, 
                visited, 
                this.config.grouping.maxDistance
            );
            
            if (group.length >= this.config.grouping.minGroupSize) {
                groups.push(group);
            }
        }
        
        console.log(`Trouvé ${groups.length} groupes valides de pixels blancs`);
        return groups;
    }

    /**
     * Analyse améliorée des couleurs avec plus de points d'échantillonnage
     */
    analyzeCardColorAround(center) {
        const { sampleRadius, samplePoints } = this.config.colorAnalysis;
        const sampledColors = [];
        
        // Échantillonner en cercle autour du rond blanc
        for (let i = 0; i < samplePoints; i++) {
            const angle = (i / samplePoints) * 2 * Math.PI;
            const x = Math.round(center.x + Math.cos(angle) * sampleRadius);
            const y = Math.round(center.y + Math.sin(angle) * sampleRadius);
            
            const color = this.getPixelColor(x, y);
            if (color) {
                const hsl = this.rgbToHsl(color.r, color.g, color.b);
                // Filtrer les couleurs trop proches du blanc ou du noir
                if (hsl.l > 15 && hsl.l < 85 && hsl.s > 10) {
                    sampledColors.push(hsl);
                }
            }
        }
        
        if (sampledColors.length < samplePoints / 3) {
            console.log(`Pas assez de couleurs échantillonnées pour le rond en (${center.x}, ${center.y})`);
            return null;
        }
        
        return this.matchCardColor(sampledColors);
    }

    /**
     * Correspondance améliorée des couleurs avec les cartes définies
     */
    matchCardColor(sampledColors) {
        const avgColor = this.averageHslColors(sampledColors);
        let bestMatch = null;
        let bestScore = Infinity;
        
        for (const cardColor of this.cardColors) {
            const score = this.calculateColorDistance(
                avgColor, 
                cardColor.hsl, 
                cardColor.tolerance
            );
            
            if (score < bestScore) {
                bestScore = score;
                bestMatch = { ...cardColor, score };
            }
        }
        
        // Retourner seulement si le score est acceptable
        const threshold = this.config.colorAnalysis.confidenceThreshold;
        return bestScore < threshold ? bestMatch : null;
    }

    /**
     * Diagnostic détaillé pour le débogage
     */
    async diagnose() {
        console.log('\n=== DIAGNOSTIC AVANCÉ ===');
        console.log('Configuration actuelle:');
        console.log(JSON.stringify(this.config, null, 2));
        
        console.log('\nCouleurs de cartes définies:');
        this.cardColors.forEach(color => {
            console.log(`  ${color.name}: HSL(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`);
        });
        
        // Statistiques sur l'image
        const groups = this.findWhitePixelsAndGroup();
        
        console.log(`\nStatistiques de l'image:`);
        console.log(`  Dimensions: ${this.width}x${this.height}`);
        console.log(`  Pixels blancs trouvés: ${groups.reduce((acc, g) => acc + g.length, 0)}`);
        console.log(`  Groupes formés: ${groups.length}`);
        
        if (groups.length > 0) {
            const sizes = groups.map(g => g.length);
            console.log(`  Taille moyenne des groupes: ${Math.round(sizes.reduce((a, b) => a + b) / sizes.length)}`);
            console.log(`  Taille min/max: ${Math.min(...sizes)}/${Math.max(...sizes)}`);
        }
    }

    /**
     * Sauvegarde une image de débogage avec les détections marquées
     */
    async saveDebugImage(results, outputPath) {
        const sharp = require('sharp');
        
        // Créer une copie de l'image originale
        const debugImage = sharp(this.imagePath);
        
        // Marquer les centres des ronds détectés
        const overlays = results.map((result, index) => {
            const color = result.cardColor === 'inconnue' ? 'red' : 'lime';
            return {
                input: Buffer.from(`<svg><circle cx="10" cy="10" r="8" fill="none" stroke="${color}" stroke-width="2"/></svg>`),
                top: result.center.y - 10,
                left: result.center.x - 10
            };
        });
        
        if (overlays.length > 0) {
            await debugImage
                .composite(overlays)
                .jpeg()
                .toFile(outputPath);
            
            console.log(`Image de débogage sauvée: ${outputPath}`);
        }
    }
}

module.exports = { AdvancedWhiteCircleDetector, CONFIG, ADVANCED_CARD_COLORS };
