# Détection de Ronds Blancs sur Cartes Colorées

Ce projet utilise Sharp pour détecter automatiquement les positions des ronds blancs sur des cartes colorées et déterminer la couleur de chaque carte en analysant les pixels environnants.

## Approche Technique

### 1. Espace Colorimétrique HSL
Au lieu d'utiliser des valeurs RGB fixes, le système utilise l'espace colorimétrique **HSL (Hue, Saturation, Lightness)** qui offre plusieurs avantages :

- **Robustesse à l'éclairage** : Les variations de luminosité n'affectent que le composant L
- **Intuitivité** : Plus facile de définir des couleurs par teinte (H) et saturation (S)
- **Tolérance** : Permet de définir des plages de tolérance pour chaque composant

### 2. Détection des Ronds Blancs

#### Étape 1 : Identification des Pixels Blancs
```javascript
// Critères HSL pour les pixels blancs
- Luminosité (L) >= 70%
- Saturation (S) <= 30%
```

#### Étape 2 : Groupement des Pixels
- Algorithme de **flood fill** pour regrouper les pixels blancs connectés
- Distance maximale configurable entre pixels (défaut: 3-4 pixels)
- Filtrage des groupes trop petits (< 10 pixels)

#### Étape 3 : Calcul des Centres
- Centre de masse géométrique de chaque groupe
- Taille du groupe (nombre de pixels)

### 3. Identification des Couleurs de Cartes

#### Échantillonnage Circulaire
Autour de chaque rond blanc détecté :
- Échantillonnage de 16-32 points en cercle
- Rayon configurable (15-25 pixels)
- Conversion RGB → HSL pour chaque point

#### Correspondance des Couleurs
```javascript
const CARD_COLORS = [
    { 
        name: 'bleu-marine', 
        hsl: { h: 240, s: 60, l: 30 },
        tolerance: { h: 20, s: 30, l: 20 }
    },
    // ... autres couleurs
];
```

#### Calcul de Distance
Distance euclidienne normalisée dans l'espace HSL :
```
distance = √[(ΔH/tol_H)² + (ΔS/tol_S)² + (ΔL/tol_L)²]
```

## Utilisation

### Démarrage Rapide
```bash
npm start
```

### Tests Avancés
```bash
npm test
```

### Scripts Disponibles
- `npm run detect` : Détection standard
- `npm run advanced` : Tests avec paramètres ajustés

## Configuration

### Paramètres de Base (`detectWhiteCircles.js`)
```javascript
const WHITE_DETECTION = {
    minBrightness: 200,  // Seuil de luminosité
    maxSaturation: 30    // Saturation maximale pour le blanc
};
```

### Configuration Avancée (`advancedDetection.js`)
```javascript
const CONFIG = {
    whiteDetection: {
        minBrightness: 180,
        maxSaturation: 40,
        minSize: 8
    },
    grouping: {
        maxDistance: 4,
        minGroupSize: 10
    },
    colorAnalysis: {
        sampleRadius: 20,
        samplePoints: 24,
        confidenceThreshold: 0.8
    }
};
```

## Couleurs Supportées

Le système peut détecter les couleurs suivantes :
- **Bleu marine** : HSL(240°, 60%, 30%)
- **Bleu turquoise** : HSL(195°, 60%, 50%)
- **Vert** : HSL(120°, 45%, 40%)
- **Orange** : HSL(35°, 65%, 55%)
- **Rose** : HSL(320°, 70%, 50%)

Chaque couleur a une tolérance configurable pour s'adapter aux variations d'éclairage.

## Avantages de cette Approche

1. **Robustesse** : L'espace HSL est moins sensible aux variations d'éclairage
2. **Flexibilité** : Paramètres entièrement configurables
3. **Précision** : Groupement intelligent des pixels connectés
4. **Débogage** : Image de sortie avec détections marquées
5. **Extensibilité** : Facile d'ajouter de nouvelles couleurs

## Diagnostic et Débogage

Le système génère :
- Rapport détaillé avec positions et tailles
- Scores de confiance pour chaque détection
- Image de débogage avec marqueurs visuels
- Statistiques complètes du traitement

## Optimisations Possibles

1. **Préfiltrage** : Réduire la résolution pour accélérer le traitement
2. **Zones d'intérêt** : Limiter la recherche à certaines régions
3. **Morphologie** : Opérations d'ouverture/fermeture pour nettoyer les détections
4. **Machine Learning** : Entraîner un modèle pour la classification des couleurs
