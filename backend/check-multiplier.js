const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('new-scorecard.db');

db.all('SELECT id, title, psa10_price, raw_average_price, multiplier FROM cards LIMIT 10', (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Sample cards with multiplier values:');
    rows.forEach(row => {
      console.log(`ID: ${row.id}, PSA10: $${row.psa10_price}, Raw: $${row.raw_average_price}, Multiplier: ${row.multiplier}`);
    });
  }
  db.close();
});

