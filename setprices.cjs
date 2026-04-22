const path = require('path');
const Database = require('better-sqlite3');

// Try both possible locations
const paths = [
  path.join(__dirname, 'roms.db'),
  path.join(process.cwd(), 'roms.db'),
];

console.log('Checking DB paths:');
paths.forEach(p => {
  try {
    const db = new Database(p);
    const cols = db.prepare('PRAGMA table_info(menu)').all().map(c => c.name);
    const count = db.prepare('SELECT COUNT(*) as c FROM menu').get();
    console.log(`  ${p}: exists, ${count.c} items, columns: ${cols.join(', ')}`);
    
    // Set prices for existing items to test half/full
    db.prepare('UPDATE menu SET price = 180, half_price = 100 WHERE id = 2').run(); // Margherita Pizza
    db.prepare('UPDATE menu SET price = 150, half_price = 90 WHERE id = 3').run();  // Pesto Pasta
    db.prepare('UPDATE menu SET price = 250, half_price = 140 WHERE id = 12').run(); // Paneer Tikka
    db.prepare('UPDATE menu SET price = 200, half_price = 120 WHERE id = 14').run(); // Dal Fry
    db.prepare('UPDATE menu SET price = 150, half_price = 0 WHERE id = 11').run();   // Chicken Wings (Full only)
    
    const sample = db.prepare('SELECT id, name, price, half_price FROM menu WHERE id IN (2,3,12)').all();
    console.log('  After update:');
    sample.forEach(i => console.log(`    ${i.name}: price=${i.price}, half_price=${i.half_price}`));
    
    // Also fix out_of_stock for items with stock > 0
    db.prepare('UPDATE menu SET out_of_stock = 0 WHERE stock > 0').run();
    console.log('  Fixed out_of_stock for available items');
    
    db.close();
  } catch(e) {
    console.log(`  ${p}: ERROR - ${e.message}`);
  }
});

console.log('Done! Please refresh the app now.');
