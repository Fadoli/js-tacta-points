const sharp = require('sharp');

// Configuration des couleurs des cartes dans l'espace HSL pour plus de robustesse
const CARD_COLORS = [
    {
        name: 'rouge', 
        hsl: { h: 7, s: 69, l: 51 }, // Teinte rouge
        tolerance: { h: 45, s: 45, l: 45 }
    },
    { 
        name: 'bleu-marine', 
        hsl: { h: 240, s: 60, l: 30 }, // Teinte bleu foncé
        tolerance: { h: 45, s: 45, l: 45 }
    },
    { 
        name: 'bleu-turquoise', 
        hsl: { h: 195, s: 60, l: 50 }, // Teinte bleu-cyan
        tolerance: { h: 45, s: 45, l: 45 }
    },
    { 
        name: 'vert', 
        hsl: { h: 95, s: 45, l: 33 }, // Teinte verte correspondant à RGB(80, 122, 46)
        tolerance: { h: 45, s: 45, l: 45 }
    },
    { 
        name: 'orange', 
        hsl: { h: 35, s: 65, l: 55 }, // Teinte orange
        tolerance: { h: 45, s: 45, l: 45 }
    },
    { 
        name: 'rose', 
        hsl: { h: 320, s: 70, l: 50 }, // Teinte rose-magenta
        tolerance: { h: 45, s: 45, l: 45 }
    },
    {
        name: 'noir',
        hsl: { h: 0, s: 0, l: 15 }, // Teinte noire
        tolerance: { h: 360, s: 30, l: 25 }
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

        const luminance = (color.r + color.g + color.b) / 3;
        if (luminance > 190) return true; // Critère de luminosité simple
        const rOver = color.r / luminance;
        const gOver = color.g / luminance;
        const bOver = color.b / luminance;
        if (luminance > 160 && rOver > 0.8 && gOver > 0.8 && bOver > 0.8) return true; // Critère de dominance des canaux

        return false;
    }

    /**
     * Trouve les pixels blancs et les groupe directement par zones connectées (méthode rapide)
     */
    findWhitePixelsAndGroup(minGroupSize = 30) { // Réduit de 50 à 30 pour capturer plus de ronds
        console.log(`Début du scan de l'image ${this.width}x${this.height}...`);
        
        // Première passe : collecter tous les pixels blancs (avec limitation)
        const whitePixels = [];
        const pixelGrid = {}; // Structure x -> y -> pixel pour accès rapide
        const progressStep = Math.floor(this.height / 10);
        
        for (let y = 0; y < this.height ; y++) {
            if (y % progressStep === 0 && progressStep > 0) {
                console.log(`Scan pixels blancs: ${Math.round(y / this.height * 100)}%`);
            }
            for (let x = 0; x < this.width ; x++) {
                if (this.isWhitePixel(x, y)) {
                    const pixel = { x, y };
                    whitePixels.push(pixel);
                    
                    // Créer la structure à double couche si nécessaire
                    if (!pixelGrid[x]) {
                        pixelGrid[x] = {};
                    }
                    pixelGrid[x][y] = pixel;
                }
            }
        }

        console.log(`Trouvé ${whitePixels.length} pixels blancs. Début du groupement...`);
        
        // Deuxième passe : groupement avec flood fill
        const allGroups = [];
        const visited = new Set();
        
        for (const pixel of whitePixels) {
            const key = `${pixel.x},${pixel.y}`;
            if (visited.has(key)) continue;
            
            const group = this.floodFillConnected(pixel, pixelGrid, visited);
            // Filtrer par taille minimale et forme approximativement circulaire
            if (group.length >= minGroupSize && group.length <= 2000) { // Augmenté la limite max
                if (this.isCircularGroup(group)) {
                    allGroups.push(group);
                }
            }
        }
        
        console.log(`Trouvé ${allGroups.length} groupes candidats`);
        
        // Filtrage par taille médiane
        const filteredGroups = this.filterGroupsByMedianSize(allGroups);
        
        console.log(`Trouvé ${filteredGroups.length} groupes de pixels blancs valides après filtrage par taille`);
        return filteredGroups;
    }

    /**
     * Filtre les groupes en utilisant la taille médiane comme référence
     */
    filterGroupsByMedianSize(groups) {
        if (groups.length === 0) return groups;
        
        // Calculer les tailles de tous les groupes (racine carrée pour obtenir une mesure linéaire)
        const sizes = groups.map(group => group.length);
        const sqrtSizes = sizes.map(size => Math.sqrt(size)).sort((a, b) => a - b);
        
        // Calculer la taille médiane (en mesure linéaire)
        const medianIndex = Math.floor(sqrtSizes.length / 2);
        const medianSqrtSize = sqrtSizes.length % 2 === 0 
            ? (sqrtSizes[medianIndex - 1] + sqrtSizes[medianIndex]) / 2 
            : sqrtSizes[medianIndex];
        
        // Calculer l'écart-type des tailles linéaires
        const mean = sqrtSizes.reduce((sum, size) => sum + size, 0) / sqrtSizes.length;
        const variance = sqrtSizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sqrtSizes.length;
        const stdDev = Math.sqrt(variance);
        
        console.log(`Taille médiane des groupes: ${Math.round(medianSqrtSize * medianSqrtSize)} pixels (√=${Math.round(medianSqrtSize)})`);
        console.log(`Taille moyenne: ${Math.round(mean * mean)} pixels (√=${Math.round(mean)})`);
        console.log(`Écart-type (linéaire): ${Math.round(stdDev)}`);
        console.log(`Plage de tailles: ${sizes[0]} - ${sizes[sizes.length - 1]} pixels`);
        
        // Utiliser l'écart-type pour définir la plage acceptable (±1 écart-type autour de la médiane)
        const toleranceMultiplier = 1; // Nombre d'écarts-types à accepter
        const minAcceptableSqrtSize = Math.max(1, medianSqrtSize - (toleranceMultiplier * stdDev));
        const maxAcceptableSqrtSize = medianSqrtSize + (toleranceMultiplier * stdDev);
        
        // Convertir back en pixels (aire)
        const minAcceptableSize = minAcceptableSqrtSize * minAcceptableSqrtSize;
        const maxAcceptableSize = maxAcceptableSqrtSize * maxAcceptableSqrtSize; // Ajustement pour éviter les petits groupes trop nombreux
        
        console.log(`Plage acceptable (±${toleranceMultiplier}σ): ${Math.round(minAcceptableSize)} - ${Math.round(maxAcceptableSize)} pixels`);
        
        // Filtrer les groupes dans la plage acceptable
        const filteredGroups = groups.filter(group => {
            const size = group.length;  
            return size >= minAcceptableSize && size <= maxAcceptableSize;
        });
        
        console.log(`Groupes filtrés: ${filteredGroups.length}/${groups.length}`);
        
        return filteredGroups;
    }

    /**
     * Vérifie si un groupe de pixels a une forme approximativement circulaire
     */
    isCircularGroup(group) {
        if (group.length < 20) return false; // Trop petit pour être un vrai rond
        
        // Calculer les dimensions du rectangle englobant
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < group.length; i++) {
            const p = group[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        
        // Vérifier le ratio largeur/hauteur (doit être proche de 1 pour un cercle)
        const aspectRatio = Math.max(width, height) / Math.min(width, height);
        if (aspectRatio > 1.4) return false; // Trop allongé
        if (aspectRatio < 0.7) return false; // Trop étroit
        
        // Vérifier la densité (% de pixels remplis dans le rectangle)
        const expectedArea = width * height;
        const actualArea = group.length;
        const density = actualArea / expectedArea;
        
        // Un cercle devrait avoir une densité d'environ 0.785 (π/4)
        // Acceptons une plage plus large pour compenser les imperfections
        return density > 0.675 && density < 0.835;
    }

    /**
     * Algorithme de flood fill pour grouper les pixels directement connectés (4-connectivité rapide)
     * Version optimisée pour éviter les débordements de pile
     */
    floodFillConnected(startPixel, pixelGrid, visited) {
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
                
                // Vérifier si le pixel existe dans la grille (accès O(1))
                if (pixelGrid[nx] && pixelGrid[nx][ny] && !visited.has(`${nx},${ny}`)) {
                    // Limiter la taille de la pile pour éviter les débordements
                    if (stack.length < 10 * maxGroupSize) {
                        stack.push({ x: nx, y: ny });
                    }
                }
            }
        }
        
        return group;
    }

    /**
     * Calcule le centre d'un groupe de pixels avec les dimensions
     */
    getGroupCenter(group) {
        let sumX = 0, sumY = 0;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < group.length; i++) {
            const p = group[i];
            sumX += p.x;
            sumY += p.y;
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const radius = Math.max(width, height) / 2;
        
        return {
            x: Math.round(sumX / group.length),
            y: Math.round(sumY / group.length),
            size: group.length,
            minX,
            maxX,
            minY,
            maxY,
            width,
            height,
            radius
        };
    }

    /**
     * Analyse les pixels autour d'un rond blanc pour déterminer la couleur de la carte
     * Prend en compte les dimensions du groupe pour adapter l'échantillonnage
     */
    analyzeCardColorAround(center, radiusMultiplier = 1.5) {
        const sampledColors = [];
        
        // Utiliser le rayon calculé du groupe avec un multiplicateur pour sortir du blanc
        const samplingRadius = Math.max(center.radius * radiusMultiplier, 15);
        const samplePoints = Math.max(12, Math.round(center.radius / 3)); // Plus de points pour les gros groupes
        
        // Échantillonnage circulaire autour du centre
        for (let i = 0; i < samplePoints; i++) {
            const angle = (i / samplePoints) * 2 * Math.PI;
            const x = Math.round(center.x + Math.cos(angle) * samplingRadius);
            const y = Math.round(center.y + Math.sin(angle) * samplingRadius);
            
            const color = this.getPixelColor(x, y);
            if (color) {
                const hsl = this.rgbToHsl(color.r, color.g, color.b);
                sampledColors.push(hsl);
            }
        }
        
        // Échantillonnage aux coins du rectangle englobant (étendu)
        const cornerOffset = Math.round(samplingRadius * 0.7); // Distance des coins
        const cornerPoints = [
            { x: center.minX - cornerOffset, y: center.minY - cornerOffset }, // Coin haut-gauche
            { x: center.maxX + cornerOffset, y: center.minY - cornerOffset }, // Coin haut-droite
            { x: center.minX - cornerOffset, y: center.maxY + cornerOffset }, // Coin bas-gauche
            { x: center.maxX + cornerOffset, y: center.maxY + cornerOffset }  // Coin bas-droite
        ];
        
        for (const point of cornerPoints) {
            const color = this.getPixelColor(point.x, point.y);
            if (color) {
                const hsl = this.rgbToHsl(color.r, color.g, color.b);
                sampledColors.push(hsl);
            }
        }
        
        // Échantillonnage sur les côtés du rectangle (milieux des côtés)
        const sideOffset = samplingRadius;
        const sidePoints = [
            { x: center.x, y: center.minY - sideOffset }, // Haut
            { x: center.x, y: center.maxY + sideOffset }, // Bas
            { x: center.minX - sideOffset, y: center.y }, // Gauche
            { x: center.maxX + sideOffset, y: center.y }  // Droite
        ];
        
        for (const point of sidePoints) {
            const color = this.getPixelColor(point.x, point.y);
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
        
        // Mapping des couleurs de cartes vers des couleurs RGB pour la visualisation
        const cardColorMapping = {
            'rouge': { r: 220, g: 60, b: 40 },
            'bleu-marine': { r: 0, g: 0, b: 139 },
            'bleu-turquoise': { r: 64, g: 224, b: 208 },
            'vert': { r: 80, g: 122, b: 46 },
            'orange': { r: 255, g: 140, b: 0 },
            'rose': { r: 255, g: 20, b: 147 },
            'noir': { r: 30, g: 30, b: 30 },
            'inconnue': { r: 128, g: 128, b: 128 }
        };
        
        // Dessiner chaque groupe avec sa couleur détectée
        groups.forEach((group, groupIndex) => {
            const center = this.getGroupCenter(group);
            const cardColor = this.analyzeCardColorAround(center);
            const colorName = cardColor ? cardColor.name : 'inconnue';
            const color = cardColorMapping[colorName] || cardColorMapping['inconnue'];
            
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
            this.drawCross(outputBuffer, center.x-1, center.y-1, { r: 0, g: 0, b: 0 }, 10);
            this.drawCross(outputBuffer, center.x+1, center.y+1, { r: 0, g: 0, b: 0 }, 10);
            // Dessiner une croix au centre du groupe (plus visible)
            this.drawCross(outputBuffer, center.x, center.y, { r: 255, g: 0, b: 0 }, 10);
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
