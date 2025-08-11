const axios = require('axios');

async function checkRailwayMultiplier() {
  try {
    // Check if multiplier field exists by looking at the admin cards endpoint
    const response = await axios.get('https://web-production-9efa.up.railway.app/api/admin/cards?page=1&limit=5');
    
    if (response.data && response.data.cards && response.data.cards.length > 0) {
      console.log('Sample cards from Railway database:');
      response.data.cards.forEach((card, index) => {
        console.log(`Card ${index + 1}:`);
        console.log(`  Title: ${card.title}`);
        console.log(`  PSA10 Price: $${card.psa10Price}`);
        console.log(`  Raw Average Price: $${card.rawAveragePrice}`);
        console.log(`  Multiplier: ${card.multiplier}`);
        console.log(`  Sport: ${card.sport}`);
        console.log('---');
      });
      
      // Check if any cards have multiplier values
      const cardsWithMultiplier = response.data.cards.filter(card => card.multiplier && card.multiplier !== 'N/A');
      console.log(`\nCards with multiplier values: ${cardsWithMultiplier.length}/${response.data.cards.length}`);
      
      if (cardsWithMultiplier.length > 0) {
        console.log('Sample cards with multiplier:');
        cardsWithMultiplier.slice(0, 3).forEach(card => {
          console.log(`  ${card.title}: ${card.multiplier}`);
        });
      }
    } else {
      console.log('No cards found in response');
    }
  } catch (error) {
    console.error('Error checking Railway database:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

checkRailwayMultiplier();

