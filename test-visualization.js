const WhiteCircleDetector = require('./detectWhiteCirclesOptimized');


const original = './img/1000007553.jpg';
const newImage = './img/IMG_20250723_190131.jpg';
const newerImage = './img/1000007555.jpg';
const real_good = './img/IMG_20250724_100118.jpg';
const real_good_alt = './img/IMG_20250724_101254.jpg';
const real_good_2 = './img/1000007618.jpg';

async function testWithVisualization() {
    console.log('=== TEST AVEC VISUALISATION ===');
    
    try {
        const detector = new WhiteCircleDetector(real_good_2);
        await detector.loadImage();
        
        console.log('Début de la détection avec génération de visualisation...');
        const results = await detector.detectWhiteCirclesAndColors(true);
        
        // Générer le rapport
        detector.generateReport(results);
        
        console.log('\n✅ Image de visualisation générée: groupes_detectes.jpg');
        console.log('Vous pouvez ouvrir cette image pour voir tous les groupes détectés.');
        
    } catch (error) {
        console.error('Erreur:', error.message);
    }
}

testWithVisualization();
