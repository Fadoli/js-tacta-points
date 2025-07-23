const { AdvancedWhiteCircleDetector } = require('./advancedDetection');
const path = require('path');

async function testDetection() {
    const imagePath = path.join(__dirname, 'img', '1000007553.jpg');
    
    try {
        console.log('=== TEST DE DÉTECTION AVANCÉE ===');
        console.log(`Traitement de l'image: ${imagePath}`);
        
        // Créer le détecteur avancé
        const detector = new AdvancedWhiteCircleDetector(imagePath);
        await detector.loadImage();
        
        // Diagnostic détaillé
        await detector.diagnose();
        
        // Détecter les ronds blancs et leurs couleurs
        console.log('\n=== DÉBUT DE LA DÉTECTION ===');
        const results = await detector.detectWhiteCirclesAndColors();
        
        // Générer le rapport détaillé
        const counts = detector.generateReport(results);
        
        // Afficher les détails avec scores de confiance
        console.log('\n=== DÉTAILS AVEC SCORES ===');
        results.forEach((result, index) => {
            console.log(`Rond ${index + 1}:`);
            console.log(`  Position: (${result.center.x}, ${result.center.y})`);
            console.log(`  Taille: ${result.center.size} pixels`);
            console.log(`  Couleur détectée: ${result.cardColor}`);
            console.log(`  Score de correspondance: ${result.score ? result.score.toFixed(3) : 'N/A'}`);
            console.log('');
        });
        
        // Sauvegarder une image de débogage
        const debugPath = path.join(__dirname, 'debug_output.jpg');
        await detector.saveDebugImage(results, debugPath);
        
        return { results, counts };
        
    } catch (error) {
        console.error('Erreur lors du test:', error);
    }
}

// Test avec différents paramètres
async function testWithDifferentParams() {
    console.log('\n=== TEST AVEC PARAMÈTRES AJUSTÉS ===');
    
    const customConfig = {
        whiteDetection: {
            minBrightness: 160,  // Plus sensible
            maxSaturation: 50,   // Tolérance plus élevée
            minSize: 5          // Ronds plus petits acceptés
        },
        grouping: {
            maxDistance: 5,      // Groupement plus large
            minGroupSize: 8      // Groupes plus petits acceptés
        },
        colorAnalysis: {
            sampleRadius: 25,    // Échantillonnage plus large
            samplePoints: 32,    // Plus de points
            confidenceThreshold: 1.0  // Moins strict
        }
    };
    
    const imagePath = path.join(__dirname, 'img', '1000007553.jpg');
    const detector = new AdvancedWhiteCircleDetector(imagePath, customConfig);
    
    try {
        await detector.loadImage();
        const results = await detector.detectWhiteCirclesAndColors();
        
        console.log(`Détection avec paramètres ajustés: ${results.length} ronds trouvés`);
        
        return results;
        
    } catch (error) {
        console.error('Erreur avec paramètres ajustés:', error);
    }
}

async function main() {
    // Test standard
    await testDetection();
    
    // Test avec paramètres ajustés
    await testWithDifferentParams();
}

if (require.main === module) {
    main();
}

module.exports = { testDetection, testWithDifferentParams };
