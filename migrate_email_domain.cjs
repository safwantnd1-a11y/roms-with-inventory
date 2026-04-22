const Database = require('better-sqlite3');
const db = new Database('roms.db');

const result = db.prepare("UPDATE users SET email = REPLACE(email, '@testy.com', '@roms.com') WHERE email LIKE '%@testy.com'").run();
console.log(`Migration done! Rows updated: ${result.changes}`);

const users = db.prepare('SELECT id, name, email, role FROM users').all();
console.table(users);
