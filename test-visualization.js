const WhiteCircleDetector = require('./detectWhiteCirclesOptimized');

async function testWithVisualization() {
    console.log('=== TEST AVEC VISUALISATION ===');
    
    try {
        const detector = new WhiteCircleDetector('./img/1000007553.jpg');
        await detector.loadImage();
        
        console.log('Début de la détection avec génération de visualisation...');
        const results = await detector.detectWhiteCirclesAndColors(true);
        
        // Générer le rapport
        detector.generateReport(results);
        
        console.log('\n=== STATISTIQUES DES GROUPES ===');
        const groups = detector.findWhitePixelsAndGroup();
        
        // Analyser la taille des groupes
        const groupSizes = groups.map(group => group.length);
        groupSizes.sort((a, b) => b - a); // Trier par taille décroissante
        
        console.log(`Groupe le plus grand: ${groupSizes[0]} pixels`);
        console.log(`Groupe le plus petit: ${groupSizes[groupSizes.length - 1]} pixels`);
        console.log(`Taille moyenne: ${Math.round(groupSizes.reduce((a, b) => a + b, 0) / groupSizes.length)} pixels`);
        console.log(`Médiane: ${groupSizes[Math.floor(groupSizes.length / 2)]} pixels`);
        
        // Montrer la distribution des tailles
        const sizeRanges = {
            'Très petits (10-50 pixels)': groupSizes.filter(s => s >= 10 && s <= 50).length,
            'Petits (51-200 pixels)': groupSizes.filter(s => s > 50 && s <= 200).length,
            'Moyens (201-1000 pixels)': groupSizes.filter(s => s > 200 && s <= 1000).length,
            'Grands (1001-5000 pixels)': groupSizes.filter(s => s > 1000 && s <= 5000).length,
            'Très grands (>5000 pixels)': groupSizes.filter(s => s > 5000).length
        };
        
        console.log('\nDistribution des tailles:');
        for (const [range, count] of Object.entries(sizeRanges)) {
            console.log(`  ${range}: ${count} groupes`);
        }
        
        console.log('\n✅ Image de visualisation générée: groupes_detectes.jpg');
        console.log('Vous pouvez ouvrir cette image pour voir tous les groupes détectés.');
        
    } catch (error) {
        console.error('Erreur:', error.message);
    }
}

testWithVisualization();
