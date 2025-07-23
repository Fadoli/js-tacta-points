# countPoint

Ce projet Node.js permet de traiter une image contenant des cartes de différentes couleurs et de compter le nombre de ronds blancs visibles sur chaque carte selon sa couleur.

## Fonctionnalités
- Détection de cartes par couleur (rouge, bleu, vert, etc.)
- Comptage automatique des ronds blancs visibles sur chaque carte
- Paramétrage facile des couleurs et seuils dans le fichier `countWhiteDots.js`

## Prérequis
- Node.js >= 20
- npm

## Installation
```
npm install
```

## Utilisation
Placez votre image dans le dossier du projet puis lancez :
```
node countWhiteDots.js <chemin/vers/image.png>
```

Le résultat affichera le nombre de ronds blancs détectés pour chaque couleur de carte.

## Personnalisation
- Modifiez le tableau `CARD_COLORS` dans `countWhiteDots.js` pour ajouter ou ajuster les couleurs de cartes.
- Ajustez les seuils `WHITE_THRESHOLD` et `COLOR_TOLERANCE` si besoin.

## Limites
- Ce script suppose que les ronds blancs sont bien distincts et que les couleurs de cartes sont franches.
- Pour des cas plus complexes, un traitement d'image avancé ou une approche IA peut être nécessaire.
