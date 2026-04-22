const Database = require('better-sqlite3');

const db = new Database('roms.db');

try {
  const users = db.prepare('SELECT id, name, email, role, active FROM users ORDER BY id').all();
  const tableCount = db.prepare('SELECT COUNT(*) AS count FROM tables').get();
  const orderCount = db.prepare('SELECT COUNT(*) AS count FROM orders').get();

  console.log('Users:', JSON.stringify(users, null, 2));
  console.log('Tables:', JSON.stringify(tableCount, null, 2));
  console.log('Orders:', JSON.stringify(orderCount, null, 2));
} catch (error) {
  console.error(error);
} finally {
  db.close();
}
