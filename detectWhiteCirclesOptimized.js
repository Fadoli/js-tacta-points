const sharp = require('sharp');

// Configuration des couleurs des cartes dans l'espace HSL pour plus de robustesse
const CARD_COLORS = [
    { 
        name: 'bleu-marine', 
        hsl: { h: 240, s: 60, l: 30 }, // Teinte bleu foncé
        tolerance: { h: 20, s: 30, l: 20 }
    },
    { 
        name: 'bleu-turquoise', 
        hsl: { h: 195, s: 60, l: 50 }, // Teinte bleu-cyan
        tolerance: { h: 25, s: 30, l: 25 }
    },
    { 
        name: 'vert', 
        hsl: { h: 120, s: 45, l: 40 }, // Teinte verte
        tolerance: { h: 30, s: 30, l: 25 }
    },
    { 
        name: 'orange', 
        hsl: { h: 35, s: 65, l: 55 }, // Teinte orange
        tolerance: { h: 25, s: 30, l: 25 }
    },
    { 
        name: 'rose', 
        hsl: { h: 320, s: 70, l: 50 }, // Teinte rose-magenta
        tolerance: { h: 30, s: 30, l: 25 }
    }
];

class WhiteCircleDetector {
    constructor(imagePath) {
        this.imagePath = imagePath;
        this.imageData = null;
        this.width = 0;
        this.height = 0;
    }

    /**
     * Charge et prépare l'image pour le traitement
     */
    async loadImage() {
        const image = sharp(this.imagePath);
        const metadata = await image.metadata();
        
        this.width = metadata.width;
        this.height = metadata.height;
        
        // Convertir en format RGB pour le traitement
        const { data } = await image
            .raw()
            .ensureAlpha()
            .toBuffer({ resolveWithObject: true });
        
        this.imageData = data;
        console.log(`Image chargée: ${this.width}x${this.height} pixels`);
        
        return this;
    }

    /**
     * Convertit RGB en HSL
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // Gris
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    /**
     * Obtient la couleur RGB d'un pixel
     */
    getPixelColor(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return null;
        }
        
        const idx = (y * this.width + x) * 4;
        return {
            r: this.imageData[idx],
            g: this.imageData[idx + 1],
            b: this.imageData[idx + 2],
            a: this.imageData[idx + 3]
        };
    }

    /**
     * Vérifie si un pixel est blanc selon nos critères spécifiques
     */
    isWhitePixel(x, y) {
        const color = this.getPixelColor(x, y);
        if (!color) return false;

        // Couleurs spécifiques à détecter avec variations :
        // 198,213,234 (bleu très clair) + variations
        // 247,247,255 (blanc cassé) + variations
        
        // Méthode 1: Distance euclidienne avec les couleurs cibles étendues
        const targetColors = [
            { r: 198, g: 213, b: 234 }, // Couleur originale 1
            { r: 247, g: 247, b: 255 }, // Couleur originale 2
            // Variations plus sombres
            { r: 180, g: 195, b: 220 },
            { r: 220, g: 230, b: 245 },
            { r: 230, g: 230, b: 240 },
            // Variations plus claires
            { r: 240, g: 250, b: 255 },
            { r: 255, g: 255, b: 255 }, // Blanc pur
            // Nuances grises claires
            { r: 220, g: 220, b: 220 },
            { r: 240, g: 240, b: 240 }
        ];
        
        for (const target of targetColors) {
            const distance = Math.sqrt(
                Math.pow(color.r - target.r, 2) +
                Math.pow(color.g - target.g, 2) +
                Math.pow(color.b - target.b, 2)
            );
            
            // Si la distance est petite (couleur similaire), c'est un pixel blanc
            if (distance < 50) { // Augmenté de 30 à 50 pour plus de tolérance
                return true;
            }
        }
        
        // Méthode 2: Critères HSL pour les blancs/blancs cassés en général
        const hsl = this.rgbToHsl(color.r, color.g, color.b);
        
        // Accepter les couleurs très claires avec peu de saturation
        const isVeryLight = hsl.l >= 70; // Réduit de 75 à 70 pour accepter plus de nuances
        const isLowSaturation = hsl.s <= 40; // Augmenté de 35 à 40
        const isBlueishTint = (hsl.h >= 180 && hsl.h <= 260) || hsl.s < 15; // Élargi la plage bleue
        
        return isVeryLight && isLowSaturation && isBlueishTint;
    }

    /**
     * Trouve les pixels blancs et les groupe directement par zones connectées (méthode rapide)
     */
    findWhitePixelsAndGroup(minGroupSize = 30) { // Réduit de 50 à 30 pour capturer plus de ronds
        console.log(`Début du scan de l'image ${this.width}x${this.height}...`);
        
        // Première passe : collecter tous les pixels blancs (avec limitation)
        const whitePixels = [];
        const pixelMap = new Map();
        const progressStep = Math.floor(this.height / 10);
        
        for (let y = 0; y < this.height ; y++) {
            if (y % progressStep === 0 && progressStep > 0) {
                console.log(`Scan pixels blancs: ${Math.round(y / this.height * 100)}%`);
            }
            for (let x = 0; x < this.width ; x++) {
                if (this.isWhitePixel(x, y)) {
                    const pixel = { x, y };
                    whitePixels.push(pixel);
                    pixelMap.set(`${x},${y}`, pixel);
                }
            }
        }

        console.log(`Trouvé ${whitePixels.length} pixels blancs. Début du groupement...`);
        
        // Deuxième passe : groupement avec flood fill
        const groups = [];
        const visited = new Set();
        
        for (const pixel of whitePixels) {
            const key = `${pixel.x},${pixel.y}`;
            if (visited.has(key)) continue;
            
            const group = this.floodFillConnected(pixel, pixelMap, visited);
            // Filtrer par taille : ni trop petit, ni trop grand
            if (group.length >= minGroupSize && group.length <= 500) { // Limite max à 500 pixels
                // Filtrer par forme approximativement circulaire
                if (this.isCircularGroup(group)) {
                    groups.push(group);
                }
            }
        }
        
        console.log(`Trouvé ${groups.length} groupes de pixels blancs valides`);
        return groups;
    }

    /**
     * Vérifie si un groupe de pixels a une forme approximativement circulaire
     */
    isCircularGroup(group) {
        if (group.length < 20) return false; // Trop petit pour être un vrai rond
        
        // Calculer les dimensions du rectangle englobant
        const minX = Math.min(...group.map(p => p.x));
        const maxX = Math.max(...group.map(p => p.x));
        const minY = Math.min(...group.map(p => p.y));
        const maxY = Math.max(...group.map(p => p.y));
        
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        
        // Vérifier le ratio largeur/hauteur (doit être proche de 1 pour un cercle)
        const aspectRatio = Math.max(width, height) / Math.min(width, height);
        if (aspectRatio > 1.5) return false; // Trop allongé
        if (aspectRatio < 0.7) return false; // Trop étroit
        
        // Vérifier la densité (% de pixels remplis dans le rectangle)
        const expectedArea = width * height;
        const actualArea = group.length;
        const density = actualArea / expectedArea;
        
        // Un cercle devrait avoir une densité d'environ 0.785 (π/4)
        // Acceptons une plage plus large pour compenser les imperfections
        return density > 0.6 && density < 0.9;
    }

    /**
     * Algorithme de flood fill pour grouper les pixels directement connectés (4-connectivité rapide)
     * Version optimisée pour éviter les débordements de pile
     */
    floodFillConnected(startPixel, pixelMap, visited) {
        const group = [];
        const stack = [startPixel];
        const maxGroupSize = 10000; // Limiter la taille des groupes pour éviter les débordements
        
        // Directions pour la 4-connectivité (plus rapide que 8-connectivité)
        const directions = [
            [0, -1], [-1, 0], [1, 0], [0, 1]
        ];
        
        while (stack.length > 0 && group.length < maxGroupSize) {
            const current = stack.pop();
            const key = `${current.x},${current.y}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            group.push(current);
            
            // Vérifier les 4 voisins directs
            for (const [dx, dy] of directions) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                const neighborKey = `${nx},${ny}`;
                
                if (pixelMap.has(neighborKey) && !visited.has(neighborKey)) {
                    // Limiter la taille de la pile pour éviter les débordements
                    if (stack.length < 1000) {
                        stack.push({ x: nx, y: ny });
                    }
                }
            }
        }
        
        return group;
    }

    /**
     * Calcule le centre d'un groupe de pixels
     */
    getGroupCenter(group) {
        const sumX = group.reduce((sum, p) => sum + p.x, 0);
        const sumY = group.reduce((sum, p) => sum + p.y, 0);
        
        return {
            x: Math.round(sumX / group.length),
            y: Math.round(sumY / group.length),
            size: group.length
        };
    }

    /**
     * Analyse les pixels autour d'un rond blanc pour déterminer la couleur de la carte
     */
    analyzeCardColorAround(center, radius = 15) {
        const sampledColors = [];
        const samplePoints = 12; // Réduit pour plus de vitesse
        
        for (let i = 0; i < samplePoints; i++) {
            const angle = (i / samplePoints) * 2 * Math.PI;
            const x = Math.round(center.x + Math.cos(angle) * radius);
            const y = Math.round(center.y + Math.sin(angle) * radius);
            
            const color = this.getPixelColor(x, y);
            if (color) {
                const hsl = this.rgbToHsl(color.r, color.g, color.b);
                sampledColors.push(hsl);
            }
        }
        
        if (sampledColors.length === 0) return null;
        
        // Trouve la couleur de carte la plus proche
        return this.matchCardColor(sampledColors);
    }

    /**
     * Compare les couleurs échantillonnées avec les couleurs de cartes définies
     */
    matchCardColor(sampledColors) {
        const avgColor = this.averageHslColors(sampledColors);
        let bestMatch = null;
        let bestScore = Infinity;
        
        for (const cardColor of CARD_COLORS) {
            const score = this.calculateColorDistance(avgColor, cardColor.hsl, cardColor.tolerance);
            
            if (score < bestScore) {
                bestScore = score;
                bestMatch = cardColor;
            }
        }
        
        // Retourner seulement si le score est acceptable
        return bestScore < 1.0 ? bestMatch : null;
    }

    /**
     * Calcule la couleur moyenne dans l'espace HSL
     */
    averageHslColors(colors) {
        if (colors.length === 0) return { h: 0, s: 0, l: 0 };
        
        // Gérer la circularité de la teinte
        let x = 0, y = 0, s = 0, l = 0;
        
        for (const color of colors) {
            const radians = color.h * Math.PI / 180;
            x += Math.cos(radians);
            y += Math.sin(radians);
            s += color.s;
            l += color.l;
        }
        
        const avgH = (Math.atan2(y / colors.length, x / colors.length) * 180 / Math.PI + 360) % 360;
        
        return {
            h: Math.round(avgH),
            s: Math.round(s / colors.length),
            l: Math.round(l / colors.length)
        };
    }

    /**
     * Calcule la distance entre deux couleurs HSL avec tolérance
     */
    calculateColorDistance(color1, color2, tolerance) {
        const hDiff = Math.min(
            Math.abs(color1.h - color2.h),
            360 - Math.abs(color1.h - color2.h)
        );
        const sDiff = Math.abs(color1.s - color2.s);
        const lDiff = Math.abs(color1.l - color2.l);
        
        const normalizedH = hDiff / tolerance.h;
        const normalizedS = sDiff / tolerance.s;
        const normalizedL = lDiff / tolerance.l;
        
        return Math.sqrt(normalizedH * normalizedH + normalizedS * normalizedS + normalizedL * normalizedL);
    }

    /**
     * Traite l'image complète et retourne les résultats
     */
    async detectWhiteCirclesAndColors(generateViz = true) {
        console.log('Début de la détection...');
        
        // Trouve et groupe directement les pixels blancs
        const groups = this.findWhitePixelsAndGroup();
        
        // Générer une visualisation si demandé
        if (generateViz) {
            await this.generateVisualization(groups, 'groupes_detectes.jpg');
        }
        
        // Analyse chaque groupe
        const results = [];
        console.log('Analyse des couleurs des cartes...');
        for (const group of groups) {
            const center = this.getGroupCenter(group);
            const cardColor = this.analyzeCardColorAround(center);
            
            results.push({
                center,
                cardColor: cardColor ? cardColor.name : 'inconnue',
                confidence: cardColor ? 'haute' : 'faible'
            });
        }
        
        return results;
    }

    /**
     * Génère une image de visualisation des groupes détectés
     */
    async generateVisualization(groups, outputPath = 'output_visualization.jpg') {
        console.log(`Génération de l'image de visualisation avec ${groups.length} groupes...`);
        
        // Créer une copie de l'image originale
        const image = sharp(this.imagePath);
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        
        // Créer un buffer pour l'image de sortie (RGB sans alpha)
        const outputBuffer = Buffer.alloc(this.width * this.height * 3);
        
        // Copier l'image originale en RGB
        for (let i = 0; i < this.width * this.height; i++) {
            const srcIdx = i * 3; // RGBA
            const dstIdx = i * 3; // RGB
            outputBuffer[dstIdx] = data[srcIdx];     // R
            outputBuffer[dstIdx + 1] = data[srcIdx + 1]; // G
            outputBuffer[dstIdx + 2] = data[srcIdx + 2]; // B
        }
        
        // Générer des couleurs distinctes pour chaque groupe
        const colors = this.generateDistinctColors(Math.min(groups.length, 100)); // Limiter à 100 couleurs
        
        // Dessiner chaque groupe avec une couleur différente
        groups.forEach((group, groupIndex) => {
            const color = colors[groupIndex % colors.length];
            const center = this.getGroupCenter(group);
            
            // Colorier tous les pixels du groupe
            group.forEach(pixel => {
                const idx = (pixel.y * this.width + pixel.x) * 3;
                if (idx >= 0 && idx < outputBuffer.length - 2) {
                    outputBuffer[idx] = color.r;     // R
                    outputBuffer[idx + 1] = color.g; // G
                    outputBuffer[idx + 2] = color.b; // B
                }
            });
            
            // Dessiner une croix au centre du groupe (plus visible)
            this.drawCross(outputBuffer, center.x, center.y, { r: 255, g: 0, b: 0 }, 5);
        });
        
        // Sauvegarder l'image
        await sharp(outputBuffer, {
            raw: {
                width: this.width,
                height: this.height,
                channels: 3
            }
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);
        
        console.log(`Image de visualisation sauvegardée: ${outputPath}`);
        return outputPath;
    }

    /**
     * Génère des couleurs distinctes pour la visualisation
     */
    generateDistinctColors(count) {
        const colors = [];
        const saturation = 255;
        const lightness = 128;
        
        for (let i = 0; i < count; i++) {
            const hue = (i * 360 / count) % 360;
            const rgb = this.hslToRgb(hue, saturation, lightness);
            colors.push(rgb);
        }
        
        return colors;
    }

    /**
     * Convertit HSL en RGB
     */
    hslToRgb(h, s, l) {
        h = h / 360;
        s = s / 255;
        l = l / 255;
        
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;
        
        let r, g, b;
        
        if (h < 1/6) {
            r = c; g = x; b = 0;
        } else if (h < 2/6) {
            r = x; g = c; b = 0;
        } else if (h < 3/6) {
            r = 0; g = c; b = x;
        } else if (h < 4/6) {
            r = 0; g = x; b = c;
        } else if (h < 5/6) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }

    /**
     * Dessine une croix sur l'image
     */
    drawCross(buffer, centerX, centerY, color, size) {
        for (let i = -size; i <= size; i++) {
            // Ligne horizontale
            const hx = centerX + i;
            const hy = centerY;
            if (hx >= 0 && hx < this.width && hy >= 0 && hy < this.height) {
                const idx = (hy * this.width + hx) * 3;
                if (idx >= 0 && idx < buffer.length - 2) {
                    buffer[idx] = color.r;
                    buffer[idx + 1] = color.g;
                    buffer[idx + 2] = color.b;
                }
            }
            
            // Ligne verticale
            const vx = centerX;
            const vy = centerY + i;
            if (vx >= 0 && vx < this.width && vy >= 0 && vy < this.height) {
                const idx = (vy * this.width + vx) * 3;
                if (idx >= 0 && idx < buffer.length - 2) {
                    buffer[idx] = color.r;
                    buffer[idx + 1] = color.g;
                    buffer[idx + 2] = color.b;
                }
            }
        }
    }

    /**
     * Génère un rapport de comptage par couleur
     */
    generateReport(results) {
        const counts = {};
        
        for (const result of results) {
            const color = result.cardColor;
            if (!counts[color]) {
                counts[color] = 0;
            }
            counts[color]++;
        }
        
        console.log('\n=== RAPPORT DE DÉTECTION ===');
        console.log(`Total de ronds blancs détectés: ${results.length}`);
        console.log('\nComptage par couleur de carte:');
        
        for (const [color, count] of Object.entries(counts)) {
            console.log(`  ${color}: ${count} rond(s)`);
        }
        
        return counts;
    }
}

module.exports = WhiteCircleDetector;
