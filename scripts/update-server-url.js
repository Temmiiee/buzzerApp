#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Script pour mettre à jour l'URL du serveur Render
function updateServerUrl(newUrl) {
  const filePath = path.join(__dirname, '../src/lib/remoteGameService.ts');
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Mettre à jour l'URL du serveur de production
    content = content.replace(
      /'https:\/\/buzzer-game-server\.onrender\.com'/,
      `'${newUrl}'`
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ URL du serveur mise à jour : ${newUrl}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour :', error.message);
  }
}

// Utilisation : node scripts/update-server-url.js "https://votre-serveur.onrender.com"
const newUrl = process.argv[2];

if (!newUrl) {
  console.log('📝 Utilisation : node scripts/update-server-url.js "https://votre-serveur.onrender.com"');
  console.log('💡 Exemple : node scripts/update-server-url.js "https://buzzer-game-server.onrender.com"');
} else {
  updateServerUrl(newUrl);
} 