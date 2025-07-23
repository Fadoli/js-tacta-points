const WhiteCircleDetector = require('./detectWhiteCircles');
const path = require('path');

async function main() {
    const imagePath = path.join(__dirname, 'img', '1000007553.jpg');
    
    try {
        console.log(`Traitement de l'image: ${imagePath}`);
        
        // Créer et initialiser le détecteur
        const detector = new WhiteCircleDetector(imagePath);
        await detector.loadImage();
        
        // Détecter les ronds blancs et leurs couleurs
        const results = await detector.detectWhiteCirclesAndColors();
        
        // Générer le rapport
        const counts = detector.generateReport(results);
        
        // Afficher les détails de chaque détection
        console.log('\n=== DÉTAILS DES DÉTECTIONS ===');
        results.forEach((result, index) => {
            console.log(`Rond ${index + 1}:`);
            console.log(`  Position: (${result.center.x}, ${result.center.y})`);
            console.log(`  Taille: ${result.center.size} pixels`);
            console.log(`  Couleur de carte: ${result.cardColor}`);
            console.log(`  Confiance: ${result.confidence}`);
            console.log('');
        });
        
        return counts;
        
    } catch (error) {
        console.error('Erreur lors du traitement:', error);
    }
}

// Exécuter si ce fichier est lancé directement
if (require.main === module) {
    main();
}

module.exports = main;
