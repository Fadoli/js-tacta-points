const sharp = require('sharp');

// Configuration des couleurs des cartes dans l'espace HSL pour plus de robustesse
const CARD_COLORS = [
    {
        name: 'rouge', 
        hsl: { h: 7, s: 69, l: 51 }, // Teinte rouge
        tolerance: {  h: 50, s: 70, l: 70 }
    },
    { 
        name: 'bleu-marine', 
        hsl: { h: 240, s: 60, l: 30 }, // Teinte bleu foncé
        tolerance: {  h: 50, s: 70, l: 70 }
    },
    { 
        name: 'bleu-turquoise', 
        hsl: { h: 195, s: 60, l: 50 }, // Teinte bleu-cyan
        tolerance: {  h: 50, s: 70, l: 70 }
    },
    { 
        name: 'vert', 
        hsl: { h: 95, s: 50, l: 40 }, // Teinte verte correspondant à RGB(80, 122, 46)
        tolerance: {  h: 50, s: 70, l: 70 }
    },
    { 
        name: 'orange', 
        hsl: { h: 35, s: 65, l: 55 }, // Teinte orange
        tolerance: {  h: 50, s: 70, l: 70 }
    },
    { 
        name: 'rose', 
        hsl: { h: 320, s: 70, l: 50 }, // Teinte rose-magenta
        tolerance: {  h: 50, s: 70, l: 70 }
    },
    {
        name: 'noir',
        hsl: { h: 0, s: 0, l: 15 }, // Teinte noire
        tolerance: { h: 9999, s: 40, l: 40 }
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

        /*
        const hsl = this.rgbToHsl(color.r, color.g, color.b);
        if (hsl.l > 60) return true; // Critère de luminosité simple
        return false;
        if (hsl.s < 10) return false; // Critère de saturation
        */

        const luminance = (color.r + color.g + color.b) / 3;
        if (luminance > 190) return true; // Critère de luminosité simple
        const rOver = color.r / luminance;
        const gOver = color.g / luminance;
        const bOver = color.b / luminance;
        if (luminance > 170 && rOver > 0.8 && gOver > 0.8 && bOver > 0.8) return true; // Critère de dominance des canaux

        return false;
    }

    /**
     * Vérifie si un pixel est noir/sombre selon nos critères spécifiques
     * Utilisé pour valider la proximité des ronds blancs avec des zones sombres (symboles de cartes)
     */
    isDarkPixel(x, y) {
        const color = this.getPixelColor(x, y);
        if (!color) return false;

        const luminance = (color.r + color.g + color.b) / 3;

        const maxLuminance = Math.max(color.r, color.g, color.b);
        
        // Critère principal : luminance faible
        if (maxLuminance < 80) return true;
        
        return false;
    }

    /**
     * Trouve les pixels sombres et les groupe directement par zones connectées
     * Utilisé pour détecter les symboles de cartes (plus grands que les ronds blancs)
     */
    findDarkPixelsAndGroup(minGroupSize = 50) { // Plus grand que les ronds blancs
        console.log(`Début du scan des pixels sombres...`);
        
        // Première passe : collecter tous les pixels sombres
        const darkPixels = [];
        const pixelGrid = {}; // Structure y -> x -> pixel pour accès cache-friendly
        const visited = {}; // Structure y -> x -> boolean pour accès cache-friendly
        const progressStep = Math.floor(this.height / 20); // Moins de logging pour les zones sombres
        
        for (let y = 0; y < this.height ; y++) {
            if (y % progressStep === 0 && progressStep > 0) {
                console.log(`Scan pixels sombres: ${Math.round(y / this.height * 100)}%`);
            }
            const local = {}
            for (let x = 0; x < this.width ; x++) {
                if (this.isDarkPixel(x, y)) {
                    darkPixels.push({ x, y });
                    local[x] = true;
                }
            }
            pixelGrid[y] = local;
            visited[y] = {};
        }

        console.log(`Trouvé ${darkPixels.length} pixels sombres. Début du groupement...`);
        
        // Deuxième passe : groupement avec flood fill
        const allGroups = [];

        visited[-1] = {}; // Pour éviter les erreurs d'accès
        visited[this.height] = {}; // Pour éviter les erreurs d'accès
        pixelGrid[-1] = {}; // Pour éviter les erreurs d'accès
        pixelGrid[this.height] = {}; // Pour éviter les erreurs d'accès
        
        for (const pixel of darkPixels) {
            // Vérifier si déjà visité avec la structure d'objet
            if (visited[pixel.y][pixel.x]) continue;
            
            const group = this.floodFillConnected(pixel, pixelGrid, visited);
            // Filtrer par taille minimale - les symboles sont plus grands que les ronds
            if (group.length >= 10 * minGroupSize) { 
                allGroups.push(group);
            }
        }
        
        console.log(`Trouvé ${allGroups.length} groupes de pixels sombres candidats`);
        
        // Filtrage par taille médiane pour les groupes sombres
        const filteredGroups = this.filterDarkGroupsByMedianSize(allGroups);
        
        console.log(`Trouvé ${filteredGroups.length} groupes de pixels sombres valides après filtrage`);
        return filteredGroups;
    }

    /**
     * Filtre les groupes sombres en utilisant la taille médiane comme référence
     * Similaire à filterGroupsByMedianSize mais adapté aux zones sombres plus grandes
     */
    filterDarkGroupsByMedianSize(groups) {
        if (groups.length === 0) return groups;
        
        // Calculer les tailles de tous les groupes (racine carrée pour obtenir une mesure linéaire)
        const sizes = groups.map(group => group.length);
        sizes.sort((a, b) => a - b);
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
        
        console.log(`Taille médiane des groupes sombres: ${Math.round(medianSqrtSize * medianSqrtSize)} pixels (√=${Math.round(medianSqrtSize)})`);
        console.log(`Écart-type (linéaire) sombres: ${Math.round(stdDev)}`);
        console.log(`Plage de tailles sombres: ${sizes[0]} - ${sizes[sizes.length - 1]} pixels`);
        
        // Utiliser une tolérance plus large pour les groupes sombres (symboles variables)
        const toleranceMultiplier = 1.5; // Plus permissif que pour les ronds blancs
        const minAcceptableSqrtSize = Math.max(1, medianSqrtSize - (toleranceMultiplier * stdDev));
        const maxAcceptableSqrtSize = medianSqrtSize + (toleranceMultiplier * stdDev);
        
        // Convertir back en pixels (aire)
        const minAcceptableSize = minAcceptableSqrtSize * minAcceptableSqrtSize;
        const maxAcceptableSize = maxAcceptableSqrtSize * maxAcceptableSqrtSize * 1.5; // Plus permissif
        
        console.log(`Plage acceptable sombres (±${toleranceMultiplier}σ): ${Math.round(minAcceptableSize)} - ${Math.round(maxAcceptableSize)} pixels`);
        
        // Filtrer les groupes dans la plage acceptable
        const filteredGroups = groups.filter(group => {
            const size = group.length;  
            return size >= minAcceptableSize && size <= maxAcceptableSize;
        });
        
        console.log(`Groupes sombres filtrés: ${filteredGroups.length}/${groups.length}`);
        
        return groups;
    }

    /**
     * Trouve les pixels blancs et les groupe directement par zones connectées (méthode rapide)
     */
    findWhitePixelsAndGroup(minGroupSize = 30) { // Réduit de 50 à 30 pour capturer plus de ronds
        console.log(`Début du scan de l'image ${this.width}x${this.height}...`);
        
        // Première passe : collecter tous les pixels blancs (avec limitation)
        const whitePixels = [];
        const pixelGrid = {}; // Structure y -> x -> pixel pour accès cache-friendly
        const visited = {}; // Structure y -> x -> boolean pour accès cache-friendly
        const progressStep = Math.floor(this.height / 10);
        
        for (let y = 0; y < this.height ; y++) {
            if (y % progressStep === 0 && progressStep > 0) {
                console.log(`Scan pixels blancs: ${Math.round(y / this.height * 100)}%`);
            }
            const local = {}
            for (let x = 0; x < this.width ; x++) {
                if (this.isWhitePixel(x, y)) {
                    whitePixels.push({ x, y }); // Réutiliser la même structure
                    local[x] = true; // Stocker juste un boolean au lieu d'un objet
                }
            }
            pixelGrid[y] = local;
            visited[y] = {};
        }

        console.log(`Trouvé ${whitePixels.length} pixels blancs. Début du groupement...`);
        
        // Deuxième passe : groupement avec flood fill
        const allGroups = [];

        visited[-1] = {}; // Pour éviter les erreurs d'accès
        visited[this.height] = {}; // Pour éviter les erreurs d'accès
        pixelGrid[-1] = {}; // Pour éviter les erreurs d'accès
        pixelGrid[this.height] = {}; // Pour éviter les erreurs d'accès
        
        for (const pixel of whitePixels) {
            // Vérifier si déjà visité avec la structure d'objet
            if (visited[pixel.y][pixel.x]) continue;
            
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
        const maxAcceptableSize = maxAcceptableSqrtSize * maxAcceptableSqrtSize * 1.3; // Ajustement pour éviter les petits groupes trop nombreux
        
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
        return density > 0.63 && density < 0.87;
    }

    /**
     * Algorithme de flood fill pour grouper les pixels directement connectés (4-connectivité rapide)
     * Version optimisée pour éviter les débordements de pile et réduire les allocations
     */
    floodFillConnected(startPixel, pixelGrid, visited) {
        if (visited[startPixel.y][startPixel.x]) return [];
        const stack = [startPixel];
        const group = [];
        const maxGroupSize = 10000; // Limiter la taille des groupes pour éviter les débordements
        
        // Pré-allouer un objet réutilisable pour éviter les allocations
        const reusablePixel = { x: 0, y: 0 };
        
        while (stack.length > 0 && group.length < maxGroupSize) {
            const current = stack.pop();
            
            // Vérifier si déjà visité avec la structure d'objet
            if (visited[current.y][current.x]) continue;
            
            visited[current.y][current.x] = true;
            group.push({ x: current.x, y: current.y }); // Créer une copie pour le groupe
            
            // Vérifier les 4 voisins directs (optimisé sans array d'arrays)
            const directions = [[0, -1], [-1, 0], [1, 0], [0, 1]];
            for (let i = 0; i < 4; i++) {
                const nx = current.x + directions[i][0];
                const ny = current.y + directions[i][1];
                
                // Vérifier si le pixel existe dans la grille et n'est pas déjà visité
                if (pixelGrid[ny][nx] && !visited[ny][nx]) {
                    // Limiter la taille de la pile pour éviter les débordements
                    if (stack.length < maxGroupSize) { // Réduire la limite pour moins de mémoire
                        reusablePixel.x = nx;
                        reusablePixel.y = ny;
                        stack.push({ x: nx, y: ny }); // Toujours allouer pour la pile
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
        
        // Réutiliser un objet pour les couleurs pour éviter les allocations
        const reusableHsl = { h: 0, s: 0, l: 0 };
        
        // Échantillonnage circulaire autour du centre
        for (let i = 0; i < samplePoints; i++) {
            const angle = (i / samplePoints) * 2 * Math.PI;
            const x = Math.round(center.x + Math.cos(angle) * samplingRadius);
            const y = Math.round(center.y + Math.sin(angle) * samplingRadius);
            
            const color = this.getPixelColor(x, y);
            if (color) {
                const hsl = this.rgbToHsl(color.r, color.g, color.b);
                sampledColors.push({ h: hsl.h, s: hsl.s, l: hsl.l }); // Copie explicite
            }
        }
        
        // Réduire les points d'échantillonnage pour moins d'allocations
        const cornerOffset = Math.round(samplingRadius * 0.7);
        const cornerPoints = [
            [center.minX - cornerOffset, center.minY - cornerOffset],
            [center.maxX + cornerOffset, center.minY - cornerOffset],
            [center.minX - cornerOffset, center.maxY + cornerOffset],
            [center.maxX + cornerOffset, center.maxY + cornerOffset]
        ];
        
        for (let i = 0; i < 4; i++) {
            const color = this.getPixelColor(cornerPoints[i][0], cornerPoints[i][1]);
            if (color) {
                const hsl = this.rgbToHsl(color.r, color.g, color.b);
                sampledColors.push({ h: hsl.h, s: hsl.s, l: hsl.l });
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
     * Filtre les groupes isolés en analysant la densité spatiale
     * Seule la distance au voisin le plus proche compte
     */
    filterIsolatedGroups(groups) {
        if (groups.length <= 2) return groups; // Pas assez de groupes pour analyser
        
        // Calculer les centres de tous les groupes
        const centers = groups.map(group => this.getGroupCenter(group));
        
        // Calculer la matrice des distances entre tous les centres
        const distances = this.calculateDistanceMatrix(centers);
        
        // Calculer pour chaque groupe sa distance minimale vers les autres
        const minDistances = centers.map((center, i) => {
            let minDist = Infinity;
            for (let j = 0; j < centers.length; j++) {
                if (i !== j && distances[i][j] < minDist) {
                    minDist = distances[i][j];
                }
            }
            return minDist;
        });
        
        // Analyser la distribution des distances minimales
        const sortedDistances = [...minDistances].sort((a, b) => a - b);
        
        // Calculer les statistiques
        const meanDistance = minDistances.reduce((sum, d) => sum + d, 0) / minDistances.length;
        const percentile75 = sortedDistances[Math.floor(sortedDistances.length * 0.75)];
        const percentile90 = sortedDistances[Math.floor(sortedDistances.length * 0.90)];
        
        console.log(`Distribution des distances au plus proche voisin:`);
        console.log(`  Moyenne: ${Math.round(meanDistance)} pixels`);
        console.log(`  P75: ${Math.round(percentile75)} pixels`);
        console.log(`  P90: ${Math.round(percentile90)} pixels`);
        
        // Définir le seuil d'isolation
        const threshold = percentile90 * 1.3;
        console.log(`Seuil d'isolation: ${Math.round(threshold)} pixels`);
        
        // Filtrer les groupes non isolés
        const filteredGroups = [];
        
        for (let i = 0; i < groups.length; i++) {
            if (minDistances[i] <= threshold) {
                filteredGroups.push(groups[i]);
            } else {
                console.log(`Groupe isolé exclu - centre: (${centers[i].x}, ${centers[i].y}), distance: ${Math.round(minDistances[i])}`);
            }
        }
        
        // Si on a exclu trop de groupes, appliquer un seuil plus permissif
        if (filteredGroups.length < groups.length * 0.4 && groups.length > 4) {
            console.log('Filtrage trop agressif, application d\'un seuil plus permissif...');
            const permissiveThreshold = sortedDistances[Math.floor(sortedDistances.length * 0.95)] * 1.2;
            console.log(`Seuil permissif: ${Math.round(permissiveThreshold)} pixels`);
            
            filteredGroups.length = 0;
            for (let i = 0; i < groups.length; i++) {
                if (minDistances[i] <= permissiveThreshold) {
                    filteredGroups.push(groups[i]);
                }
            }
        }
        
        return filteredGroups;
    }

    /**
     * Calcule la matrice des distances euclidiennes entre les centres
     */
    calculateDistanceMatrix(centers) {
        const matrix = [];
        
        for (let i = 0; i < centers.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < centers.length; j++) {
                if (i === j) {
                    matrix[i][j] = 0;
                } else {
                    const dx = centers[i].x - centers[j].x;
                    const dy = centers[i].y - centers[j].y;
                    matrix[i][j] = Math.sqrt(dx * dx + dy * dy);
                }
            }
        }
        
        return matrix;
    }

    /**
     * Valide la proximité des groupes blancs avec les groupes sombres détectés
     * Une vraie carte doit avoir des ronds blancs proches de symboles sombres
     */
    validateWhiteGroupsWithDarkGroups(whiteGroups, darkGroups, maxDistance = 100) {
        console.log('Validation des groupes blancs avec les groupes sombres...');
        
        if (darkGroups.length === 0) {
            console.log('Aucun groupe sombre détecté, validation ignorée');
            return whiteGroups;
        }
        
        // Calculer les centres des groupes sombres
        const darkCenters = darkGroups.map(group => this.getGroupCenter(group));
        
        const validatedGroups = [];
        
        for (const whiteGroup of whiteGroups) {
            const whiteCenter = this.getGroupCenter(whiteGroup);
            
            // Trouver la distance minimale vers un groupe sombre
            let minDistanceToDark = Infinity;
            let closestDarkGroup = null;
            
            for (let i = 0; i < darkCenters.length; i++) {
                const darkCenter = darkCenters[i];
                const dx = whiteCenter.x - darkCenter.x;
                const dy = whiteCenter.y - darkCenter.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < minDistanceToDark) {
                    minDistanceToDark = distance;
                    closestDarkGroup = i;
                }
            }
            
            // Valider si le groupe blanc est suffisamment proche d'un groupe sombre
            if (minDistanceToDark <= maxDistance) {
                validatedGroups.push(whiteGroup);
            } else {
                console.log(`Groupe blanc exclu (pas de symbole sombre proche) - centre: (${whiteCenter.x}, ${whiteCenter.y}), distance min: ${Math.round(minDistanceToDark)}`);
            }
        }
        
        console.log(`Groupes blancs validés par proximité sombre: ${validatedGroups.length}/${whiteGroups.length} (seuil: ${maxDistance}px)`);
        return validatedGroups;
    }

    /**
     * Traite l'image complète et retourne les résultats
     */
    async detectWhiteCirclesAndColors(generateViz = true) {
        console.log('Début de la détection...');
        
        // Trouve et groupe directement les pixels blancs
        const whiteGroups = this.findWhitePixelsAndGroup();
        
        // Trouve et groupe les pixels sombres (symboles de cartes)
        const darkGroups = this.findDarkPixelsAndGroup();
        
        // Filtrer les groupes blancs isolés (faux positifs probables)
        const spatiallyFilteredGroups = this.filterIsolatedGroups(whiteGroups);
        console.log(`Groupes blancs après filtrage spatial: ${spatiallyFilteredGroups.length}/${whiteGroups.length}`);
        
        // Valider la proximité avec les groupes sombres détectés
        const darkValidatedGroups = this.validateWhiteGroupsWithDarkGroups(spatiallyFilteredGroups, darkGroups);
        console.log(`Groupes blancs après validation par groupes sombres: ${darkValidatedGroups.length}/${spatiallyFilteredGroups.length}`);
        
        // Générer une visualisation si demandé
        if (generateViz) {
            await this.generateVisualization(darkValidatedGroups, darkGroups, 'groupes_detectes.jpg');
        }
        
        // Analyse chaque groupe
        const results = [];
        console.log('Analyse des couleurs des cartes...');
        for (const group of darkValidatedGroups) {
            const center = this.getGroupCenter(group);
            const cardColor = this.analyzeCardColorAround(center);
            
            results.push({
                center,
                cardColor: cardColor ? cardColor.name : 'inconnue',
                confidence: cardColor ? 'haute' : 'faible',
            });
        }
        
        return results;
    }

    /**
     * Génère une image de visualisation des groupes détectés
     */
    async generateVisualization(whiteGroups, darkGroups = [], outputPath = 'output_visualization.jpg') {
        console.log(`Génération de l'image de visualisation avec ${whiteGroups.length} groupes blancs et ${darkGroups.length} groupes sombres...`);
        
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
        
        // Dessiner les groupes sombres détectés en premier (arrière-plan)
        darkGroups.forEach((group, groupIndex) => {
            // Colorier les pixels des groupes sombres en rouge foncé pour les distinguer
            group.forEach(pixel => {
                const idx = (pixel.y * this.width + pixel.x) * 3;
                if (idx >= 0 && idx < outputBuffer.length - 2) {
                    outputBuffer[idx] = 255;     // R - rouge foncé
                    outputBuffer[idx + 1] = 255; // G
                    outputBuffer[idx + 2] = 255; // B
                }
            });
        });
        
        // Dessiner chaque groupe blanc avec sa couleur détectée (premier plan)
        whiteGroups.forEach((group, groupIndex) => {
            const center = this.getGroupCenter(group);
            const cardColor = this.analyzeCardColorAround(center);
            const colorName = cardColor ? cardColor.name : 'inconnue';
            const color = cardColorMapping[colorName] || cardColorMapping['inconnue'];
            
            // Colorier tous les pixels du groupe blanc
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
     * Génère un rapport de comptage par couleur avec informations de proximité sombre
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
