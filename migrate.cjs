const Database = require('better-sqlite3');
const db = new Database('./roms.db');

// Show current schema
const cols = db.prepare('PRAGMA table_info(menu)').all();
console.log('menu columns:', cols.map(c => c.name).join(', '));

// Show first 3 items
const items = db.prepare('SELECT id, name, price, half_price FROM menu LIMIT 5').all();
console.log('Sample items:');
items.forEach(i => console.log(`  id=${i.id} name="${i.name}" price=${i.price} half_price=${i.half_price}`));

// Test direct update
db.prepare('UPDATE menu SET price = 200, half_price = 120 WHERE id = 2').run();
const pizza = db.prepare('SELECT id, name, price, half_price FROM menu WHERE id = 2').get();
console.log('After update, Margherita Pizza:', pizza);

// Check order_items columns
const cols2 = db.prepare('PRAGMA table_info(order_items)').all();
console.log('order_items columns:', cols2.map(c => c.name).join(', '));

console.log('Done');
