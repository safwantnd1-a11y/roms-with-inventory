import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const XLSX = _require('xlsx') as typeof import('xlsx');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DB_PATH || 'roms.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'kitchen')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,
    waiter_id INTEGER NOT NULL,
    status TEXT DEFAULT 'new',
    total_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id),
    FOREIGN KEY (waiter_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_id) REFERENCES menu(id)
  );
`);

// Add missing menu/user fields when upgrading existing database
const menuColumns = db.prepare('PRAGMA table_info(menu)').all().map((col: any) => col.name);
if (!menuColumns.includes('description')) db.prepare('ALTER TABLE menu ADD COLUMN description TEXT DEFAULT ""').run();
if (!menuColumns.includes('preparation_time')) db.prepare('ALTER TABLE menu ADD COLUMN preparation_time INTEGER DEFAULT 0').run();
if (!menuColumns.includes('stock')) db.prepare('ALTER TABLE menu ADD COLUMN stock INTEGER DEFAULT 0').run();
if (!menuColumns.includes('out_of_stock')) db.prepare('ALTER TABLE menu ADD COLUMN out_of_stock INTEGER DEFAULT 0').run();
if (!menuColumns.includes('is_veg')) db.prepare('ALTER TABLE menu ADD COLUMN is_veg INTEGER DEFAULT 1').run();
if (!menuColumns.includes('half_price')) db.prepare('ALTER TABLE menu ADD COLUMN half_price REAL DEFAULT 0').run();
if (!menuColumns.includes('sub_category')) db.prepare('ALTER TABLE menu ADD COLUMN sub_category TEXT DEFAULT ""').run();
if (!menuColumns.includes('type')) db.prepare('ALTER TABLE menu ADD COLUMN type TEXT DEFAULT "veg"').run();
if (!menuColumns.includes('image_url')) db.prepare('ALTER TABLE menu ADD COLUMN image_url TEXT DEFAULT NULL').run();
if (!menuColumns.includes('unit')) db.prepare('ALTER TABLE menu ADD COLUMN unit TEXT DEFAULT "pcs"').run();

const orderItemColumns = db.prepare('PRAGMA table_info(order_items)').all().map((col: any) => col.name);
if (!orderItemColumns.includes('portion')) db.prepare("ALTER TABLE order_items ADD COLUMN portion TEXT DEFAULT 'full'").run();
if (!orderItemColumns.includes('notes')) db.prepare("ALTER TABLE order_items ADD COLUMN notes TEXT DEFAULT ''").run();

const ordersTableColumns = db.prepare('PRAGMA table_info(orders)').all().map((col: any) => col.name);
if (!ordersTableColumns.includes('notes')) db.prepare("ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT ''").run();
if (!ordersTableColumns.includes('bill_number')) db.prepare("ALTER TABLE orders ADD COLUMN bill_number TEXT DEFAULT NULL").run();
if (!ordersTableColumns.includes('paid_at')) db.prepare("ALTER TABLE orders ADD COLUMN paid_at DATETIME DEFAULT NULL").run();
// Backfill: paid orders that have NULL paid_at → use created_at as fallback
db.prepare("UPDATE orders SET paid_at = created_at WHERE status = 'paid' AND paid_at IS NULL").run();

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((col: any) => col.name);
if (!userColumns.includes('login_count')) db.prepare('ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0').run();
if (!userColumns.includes('last_login')) db.prepare('ALTER TABLE users ADD COLUMN last_login DATETIME').run();
if (!userColumns.includes('active')) db.prepare('ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 0').run();
if (!userColumns.includes('left_company')) db.prepare('ALTER TABLE users ADD COLUMN left_company INTEGER DEFAULT 0').run();

// Normalize any legacy restaurant.com / testy.com staff emails to @roms.com
db.prepare("UPDATE users SET email = REPLACE(email, '@restaurant.com', '@roms.com') WHERE email LIKE '%@restaurant.com'").run();
db.prepare("UPDATE users SET email = REPLACE(email, '@testy.com', '@roms.com') WHERE email LIKE '%@testy.com'").run();

// Remove the legacy waiter assignment table now that the app is admin + kitchen only.
db.exec('DROP TABLE IF EXISTS staff_tables');

// Create customers (CRM) table
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0,
    visits INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    stock REAL DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    min_stock REAL DEFAULT 5,
    price REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    remaining_quantity REAL NOT NULL,
    price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
  );

  CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    item_type TEXT DEFAULT 'inventory', -- 'inventory' or 'menu'
    manager_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'in' or 'out'
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    unit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    restaurant_name TEXT,
    address TEXT,
    gst_number TEXT,
    fssai_number TEXT,
    cgst_percent REAL DEFAULT 2.5,
    sgst_percent REAL DEFAULT 2.5,
    service_charge_percent REAL DEFAULT 0,
    contact_number TEXT
  );

  INSERT OR IGNORE INTO settings (id, restaurant_name, address, gst_number, fssai_number, cgst_percent, sgst_percent, service_charge_percent, contact_number)
  VALUES (1, 'ROMS Restaurant', '123 Main St, City', '27AAACG0000A1Z5', '12345678901234', 2.5, 2.5, 0, '9876543210');
`);

// NOTE: ordersColumns migration runs AFTER the FK guard below to ensure columns
// are added to the final rebuilt table, not the stale one.

// Add merged_into to tables if not present (for visual merge tracking)
const tablesColumns = db.prepare('PRAGMA table_info(tables)').all().map((col: any) => col.name);
if (!tablesColumns.includes('merged_into')) db.prepare('ALTER TABLE tables ADD COLUMN merged_into INTEGER DEFAULT NULL').run();

// Migration for stock_transactions
const stColumns = db.prepare('PRAGMA table_info(stock_transactions)').all().map((col: any) => col.name);
if (!stColumns.includes('item_type')) {
  db.prepare("ALTER TABLE stock_transactions ADD COLUMN item_type TEXT DEFAULT 'inventory'").run();
}

// ── Migration: remove restrictive CHECK constraint on users.role ──────────
{
  // Guard: clean up a leftover users_old from a previously failed migration
  const usersOldExists = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'"
  ).get() as any);
  if (usersOldExists) {
    console.log('[MIGRATION] Detected leftover users_old table — cleaning up...');
    db.pragma('foreign_keys = OFF');
    db.exec('DROP TABLE IF EXISTS users_old;');
    db.pragma('foreign_keys = ON');
  }

  const usersDDL: string = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
  ).get() as any)?.sql ?? '';

  if (usersDDL.includes("CHECK(role IN")) {
    db.pragma('foreign_keys = OFF');
    db.exec('ALTER TABLE users RENAME TO users_old;');
    db.exec(`
      CREATE TABLE users (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL,
        email        TEXT UNIQUE NOT NULL,
        password     TEXT NOT NULL,
        role         TEXT NOT NULL,
        login_count  INTEGER DEFAULT 0,
        last_login   DATETIME,
        active       INTEGER DEFAULT 0,
        left_company INTEGER DEFAULT 0
      );
    `);
    db.exec(`
      INSERT INTO users (id, name, email, password, role, login_count, last_login, active, left_company)
      SELECT id, name, email, password, role,
             COALESCE(login_count, 0), last_login, COALESCE(active, 0), COALESCE(left_company, 0)
      FROM users_old;
    `);
    db.exec('DROP TABLE users_old;');
    db.pragma('foreign_keys = ON');
    console.log('[MIGRATION] users table rebuilt — role constraint removed.');
  }
}

// ── Migration: remove restrictive CHECK constraint on orders.status ──────────
// The original table had CHECK(status IN ('new','preparing','ready','served'))
// which blocks 'billing' and 'paid'. SQLite can't DROP a constraint, so we
// recreate the table without it (preserving all existing data).
{
  // Guard: clean up a leftover orders_old from a previously failed migration
  const ordersOldExists = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='orders_old'"
  ).get() as any);
  if (ordersOldExists) {
    console.log('[MIGRATION] Detected leftover orders_old table — cleaning up...');
    db.pragma('foreign_keys = OFF');
    db.exec('DROP TABLE IF EXISTS orders_old;');
    db.pragma('foreign_keys = ON');
  }

  const ordersDDL: string = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'"
  ).get() as any)?.sql ?? '';

  if (ordersDDL.includes("CHECK(status IN")) {
    db.pragma('foreign_keys = OFF');
    db.exec('ALTER TABLE orders RENAME TO orders_old;');
    db.exec(`
      CREATE TABLE orders (
        id          INTEGER  PRIMARY KEY AUTOINCREMENT,
        table_id    INTEGER  NOT NULL,
        waiter_id   INTEGER  NOT NULL,
        status      TEXT     DEFAULT 'new',
        total_price REAL     NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id)  REFERENCES tables(id),
        FOREIGN KEY (waiter_id) REFERENCES users(id)
      );
    `);
    db.exec('INSERT INTO orders SELECT id, table_id, waiter_id, status, total_price, created_at FROM orders_old;');
    db.exec('DROP TABLE orders_old;');
    db.pragma('foreign_keys = ON');
    console.log('[MIGRATION] orders table rebuilt — CHECK constraint removed.');
  }
}

// ── Permanent guard: fix orders FK / partial migration states ──────────────
{
  db.pragma('foreign_keys = OFF');

  const hasOrders    = !!(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").get());
  const hasBroken    = !!(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders_fk_broken'").get());
  const ordersDDL: string = hasOrders
    ? ((db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get() as any)?.sql ?? '')
    : '';

  if (hasBroken && !hasOrders) {
    // Previous run renamed orders → orders_fk_broken but crashed before creating the new orders table
    console.log('[STARTUP FIX] orders_fk_broken found without orders — restoring...');
    db.exec(`
      CREATE TABLE orders (
        id              INTEGER  PRIMARY KEY AUTOINCREMENT,
        table_id        INTEGER  NOT NULL,
        waiter_id       INTEGER  NOT NULL,
        status          TEXT     DEFAULT 'new',
        total_price     REAL     NOT NULL,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes           TEXT     DEFAULT '',
        bill_number     TEXT     DEFAULT NULL,
        paid_at         DATETIME DEFAULT NULL,
        customer_id     INTEGER  DEFAULT NULL,
        payment_method  TEXT     DEFAULT 'cash',
        discount        REAL     DEFAULT 0,
        FOREIGN KEY (table_id)  REFERENCES tables(id),
        FOREIGN KEY (waiter_id) REFERENCES users(id)
      );
    `);
    db.exec(`
      INSERT INTO orders
        (id, table_id, waiter_id, status, total_price, created_at, notes, bill_number, paid_at, customer_id, payment_method, discount)
      SELECT id, table_id, waiter_id, status, total_price, created_at,
             COALESCE(notes,''), bill_number, paid_at, customer_id,
             COALESCE(payment_method,'cash'), COALESCE(discount,0)
      FROM orders_fk_broken;
    `);
    db.exec('DROP TABLE orders_fk_broken;');
    console.log('[STARTUP FIX] orders restored from orders_fk_broken.');
  } else if (hasBroken && hasOrders) {
    // Both exist — orders was already rebuilt, just drop the stale backup
    console.log('[STARTUP FIX] Stale orders_fk_broken found — dropping...');
    db.exec('DROP TABLE orders_fk_broken;');
    console.log('[STARTUP FIX] orders_fk_broken dropped.');
  } else if (hasOrders && ordersDDL.includes('users_old')) {
    // orders exists but its FK still points to users_old
    console.log('[STARTUP FIX] orders FK points to users_old — rebuilding...');
    db.exec('ALTER TABLE orders RENAME TO orders_fk_broken;');
    db.exec(`
      CREATE TABLE orders (
        id              INTEGER  PRIMARY KEY AUTOINCREMENT,
        table_id        INTEGER  NOT NULL,
        waiter_id       INTEGER  NOT NULL,
        status          TEXT     DEFAULT 'new',
        total_price     REAL     NOT NULL,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes           TEXT     DEFAULT '',
        bill_number     TEXT     DEFAULT NULL,
        paid_at         DATETIME DEFAULT NULL,
        customer_id     INTEGER  DEFAULT NULL,
        payment_method  TEXT     DEFAULT 'cash',
        discount        REAL     DEFAULT 0,
        FOREIGN KEY (table_id)  REFERENCES tables(id),
        FOREIGN KEY (waiter_id) REFERENCES users(id)
      );
    `);
    db.exec(`
      INSERT INTO orders
        (id, table_id, waiter_id, status, total_price, created_at, notes, bill_number, paid_at, customer_id, payment_method, discount)
      SELECT id, table_id, waiter_id, status, total_price, created_at,
             COALESCE(notes,''), bill_number, paid_at, customer_id,
             COALESCE(payment_method,'cash'), COALESCE(discount,0)
      FROM orders_fk_broken;
    `);
    db.exec('DROP TABLE orders_fk_broken;');
    console.log('[STARTUP FIX] orders rebuilt with correct FK to users.');
  }

  db.pragma('foreign_keys = ON');
}

// ── Column migrations — run AFTER guard so rebuilt tables get all columns ──
{
  const ordersColumns = db.prepare('PRAGMA table_info(orders)').all().map((col: any) => col.name);
  if (!ordersColumns.includes('customer_id'))    db.prepare('ALTER TABLE orders ADD COLUMN customer_id INTEGER DEFAULT NULL').run();
  if (!ordersColumns.includes('payment_method')) db.prepare("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'").run();
  if (!ordersColumns.includes('discount'))       db.prepare('ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0').run();
  if (!ordersColumns.includes('notes'))          db.prepare("ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT ''").run();
  if (!ordersColumns.includes('bill_number'))    db.prepare('ALTER TABLE orders ADD COLUMN bill_number TEXT DEFAULT NULL').run();
  if (!ordersColumns.includes('paid_at'))        db.prepare('ALTER TABLE orders ADD COLUMN paid_at DATETIME DEFAULT NULL').run();
  if (!ordersColumns.includes('cgst'))           db.prepare('ALTER TABLE orders ADD COLUMN cgst REAL DEFAULT 0').run();
  if (!ordersColumns.includes('sgst'))           db.prepare('ALTER TABLE orders ADD COLUMN sgst REAL DEFAULT 0').run();
  if (!ordersColumns.includes('service_charge')) db.prepare('ALTER TABLE orders ADD COLUMN service_charge REAL DEFAULT 0').run();
  if (!ordersColumns.includes('round_off'))      db.prepare('ALTER TABLE orders ADD COLUMN round_off REAL DEFAULT 0').run();
  if (!ordersColumns.includes('grand_total'))    db.prepare('ALTER TABLE orders ADD COLUMN grand_total REAL DEFAULT 0').run();
}

// Fix: ensure items with stock > 0 are not marked out_of_stock (fixes bad initial seed data)
db.prepare("UPDATE menu SET out_of_stock = 0 WHERE stock > 0 AND out_of_stock = 1").run();
// Fix: ensure items with stock = 0 but were seeded with prep_time are marked available (drinks/etc)
// Reset all base seeded items to available if stock wasn't intentionally drained
db.prepare("UPDATE menu SET out_of_stock = 0 WHERE name IN ('Coke','Craft Beer') AND out_of_stock = 1").run();

// Seed initial data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
const salt = bcrypt.genSaltSync(10);
const adminPassword = bcrypt.hashSync('admin', salt);
const defaultPassword = bcrypt.hashSync('password123', salt);
const defaultUsers = [
  { name: 'Admin User', email: 'admin', role: 'admin', password: adminPassword },
  { name: 'Order Staff', email: 'orders@roms.com', role: 'kitchen', password: defaultPassword },
];

if (userCount.count === 0) {
  defaultUsers.forEach((user) => {
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
      .run(user.name, user.email, user.password, user.role);
  });

  // Seed tables
  for (let i = 1; i <= 10; i++) {
    db.prepare('INSERT INTO tables (table_number) VALUES (?)').run(`Table ${i}`);
  }

  // Seed menu: [name, price, category, description, prep_time, stock, is_veg (1=veg, 0=non-veg)]
  const menuItems = [
    ['Classic Burger', 12.99, 'Main', 'Beef patty with lettuce, tomato, and special sauce', 15, 20, 0],
    ['Margherita Pizza', 15.50, 'Main', 'Tomato, mozzarella, and fresh basil', 20, 15, 1],
    ['Pesto Pasta', 11.00, 'Main', 'Pasta tossed in creamy basil pesto', 18, 12, 1],
    ['Caesar Salad', 8.50, 'Starter', 'Crisp romaine, parmesan, and croutons', 10, 8, 1],
    ['Coke', 2.50, 'Drink', 'Chilled classic cola', 0, 50, 1],
    ['Craft Beer', 5.00, 'Drink', 'Locally brewed ale', 0, 30, 1],
    ['Garlic Bread', 4.00, 'Starter', 'Toasted with herb butter', 8, 25, 1],
    ['Tiramisu', 6.50, 'Dessert', 'Classic Italian coffee dessert', 5, 10, 1],
    ['Chicken Wings', 9.99, 'Starter', 'Crispy fried wings with hot sauce', 12, 18, 0],
    ['Grilled Salmon', 18.99, 'Main', 'Atlantic salmon with herb butter and lemon', 20, 10, 0],
    ['Paneer Tikka', 11.50, 'Starter', 'Grilled cottage cheese with spices', 15, 15, 1],
    ['Dal Makhani', 10.00, 'Main', 'Slow-cooked creamy black lentils', 25, 12, 1],
  ];
  menuItems.forEach(([name, price, cat, desc, prep, stock, is_veg]) => {
    const stockValue = Number(stock);
    db.prepare('INSERT INTO menu (name, price, category, description, preparation_time, stock, out_of_stock, is_veg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, price, cat, desc, prep, stockValue, 0, is_veg); // all seeded items start as available
  });
}

defaultUsers.forEach((user) => {
  db.prepare(
    `INSERT INTO users (name, email, password, role)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       password = excluded.password,
       role = excluded.role,
       left_company = 0`
  ).run(user.name, user.email, user.password, user.role);
});

// Reassign any legacy waiter-owned orders to admin, then remove waiter accounts.
const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get() as any;
if (adminUser?.id) {
  const legacyWaiters = db.prepare("SELECT id FROM users WHERE role = 'waiter'").all() as Array<{ id: number }>;
  if (legacyWaiters.length > 0) {
    const placeholders = legacyWaiters.map(() => '?').join(',');
    db.prepare(`UPDATE orders SET waiter_id = ? WHERE waiter_id IN (${placeholders})`).run(
      adminUser.id,
      ...legacyWaiters.map((user) => user.id)
    );
    db.prepare("DELETE FROM users WHERE role = 'waiter'").run();
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

  // ── Multer: image upload ──────────────────────────────────────────────────
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `menu-${Date.now()}${ext}`);
    },
  });
  const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

  // Serve uploaded images
  app.use('/uploads', express.static(uploadsDir));

  const generateRandomPassword = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const makeEmailFromName = (name: string, role: string) => {
    const slug = name.trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    return `${slug || role}@roms.com`;
  };

  const ensureUniqueEmail = (email: string) => {
    let candidate = email;
    let suffix = 1;
    while (db.prepare('SELECT 1 FROM users WHERE email = ?').get(candidate)) {
      candidate = `${email.replace(/@.*$/, '')}${suffix}@roms.com`;
      suffix += 1;
    }
    return candidate;
  };

  // Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Auth Routes
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const identifier = (email || '').trim();

    // Security Fix: only check email or name, NOT role
    let user = db.prepare('SELECT * FROM users WHERE email = ? OR name = ?').get(identifier, identifier) as any;

    if (!user && (identifier.toLowerCase().includes('@testy.com') || identifier.toLowerCase().includes('@roms.com'))) {
      const legacyIdentifier = identifier.replace(/@testy\.com$/i, '@restaurant.com').replace(/@roms\.com$/i, '@restaurant.com');
      user = db.prepare('SELECT * FROM users WHERE email = ? OR name = ?').get(legacyIdentifier, legacyIdentifier) as any;
    }

    if (!user && identifier.toLowerCase().includes('@restaurant.com')) {
      const modernIdentifier = identifier.replace(/@restaurant\.com$/i, '@roms.com');
      user = db.prepare('SELECT * FROM users WHERE email = ? OR name = ?').get(modernIdentifier, modernIdentifier) as any;
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.email.toLowerCase().endsWith('@restaurant.com') || user.email.toLowerCase().endsWith('@testy.com')) {
      const updatedEmail = user.email.replace(/@restaurant\.com$/i, '@roms.com').replace(/@testy\.com$/i, '@roms.com');
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(updatedEmail, user.id);
      user.email = updatedEmail;
    }

    db.prepare('UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login = CURRENT_TIMESTAMP, active = 1 WHERE id = ?').run(user.id);
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        login_count: (user.login_count || 0) + 1,
        last_login: new Date().toISOString(),
        active: 1,
      },
    });
    io.emit('staff-status-updated');
  });

  app.post('/api/auth/logout', authenticate, (req: any, res: any) => {
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.user.id);
    io.emit('staff-status-updated');
    res.json({ success: true });
  });

  // Change password (any authenticated user can change their own password)
  app.put('/api/auth/change-password', authenticate, (req: any, res: any) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
    res.json({ success: true });
  });


  // Bulk add menu items
  app.post('/api/menu/bulk', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Invalid data format' });

    try {
      const transaction = db.transaction(() => {
        const insert = db.prepare(`
          INSERT INTO menu (name, category, sub_category, price, half_price, description, preparation_time, stock, out_of_stock, is_veg, type, unit, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          const out_of_stock = Number(item.stock || 0) <= 0 ? 1 : 0;
          const isVeg = (item.is_veg === 'no' || item.is_veg === 0 || item.is_veg === 'false' || item.type === 'non-veg') ? 0 : 1;
          const itemType = isVeg ? 'veg' : 'non-veg';
          
          insert.run(
            item.name,
            item.category || 'Main',
            item.sub_category || '',
            Number(item.price) || 0,
            Number(item.half_price) || 0,
            item.description || '',
            Number(item.preparation_time) || 15,
            Number(item.stock) || 0,
            out_of_stock,
            isVeg,
            itemType,
            item.unit || 'pcs',
            item.image_url || null
          );
        }
      });
      transaction();
      io.emit('menu-updated');
      res.json({ success: true, count: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Menu Routes
  app.get('/api/menu', (req, res) => {
    const menu = db.prepare('SELECT * FROM menu').all();
    res.json(menu);
  });

  app.post('/api/menu', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { name, price, category, sub_category, type, description, preparation_time, stock, is_veg, half_price, unit } = req.body;
    const out_of_stock = Number(stock) <= 0 ? 1 : 0;

    // backwards compatibility for is_veg if type not provided
    const finalType = type || (is_veg === 0 || is_veg === false ? 'non-veg' : 'veg');

    const result = db.prepare('INSERT INTO menu (name, price, category, sub_category, type, description, preparation_time, stock, out_of_stock, is_veg, half_price, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, price, category, sub_category || '', finalType, description || '',
        Number(preparation_time) || 0, Number(stock) || 0, out_of_stock,
        finalType === 'veg' ? 1 : 0,
        Number(half_price) || 0,
        unit || 'pcs');
    io.emit('menu-updated');
    res.json({ id: result.lastInsertRowid });
  });

  app.delete('/api/menu/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      db.prepare('DELETE FROM menu WHERE id = ?').run(req.params.id);
      io.emit('menu-updated');
      res.json({ success: true });
    } catch (e: any) {
      if (e.message.includes('FOREIGN KEY')) {
        return res.status(400).json({ error: 'Cannot delete item with existing order history. Mark it "Out of Stock" instead.' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/menu/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'kitchen') return res.status(403).json({ error: 'Forbidden' });
    const { stock, out_of_stock, price, half_price } = req.body;

    // If price / half_price update requested (admin only)
    if (price !== undefined || half_price !== undefined) {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const item = db.prepare('SELECT * FROM menu WHERE id = ?').get(req.params.id) as any;
      if (!item) return res.status(404).json({ error: 'Not found' });
      db.prepare('UPDATE menu SET price = ?, half_price = ? WHERE id = ?')
        .run(
          price !== undefined ? Number(price) : item.price,
          half_price !== undefined ? Number(half_price) : item.half_price,
          req.params.id
        );
      io.emit('menu-updated');
      return res.json({ success: true });
    }

    // Stock toggle
    const stockValue = Number(stock ?? 0);
    const outOfStockValue = out_of_stock ? 1 : 0;
    db.prepare('UPDATE menu SET stock = ?, out_of_stock = ? WHERE id = ?')
      .run(stockValue, outOfStockValue, req.params.id);
    io.emit('menu-updated');
    res.json({ success: true });
  });

  // Staff management for admin
  app.get('/api/admin/staff', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const staff = db.prepare(`
      SELECT
        u.id,
        u.name,
        REPLACE(REPLACE(u.email, '@restaurant.com', '@roms.com'), '@testy.com', '@roms.com') AS email,
        u.role,
        u.active,
        COALESCE(u.login_count, 0) as login_count,
        u.last_login,
        COALESCE(SUM(CASE WHEN o.status != 'served' THEN 1 ELSE 0 END), 0) as activeOrders,
        COALESCE(SUM(CASE WHEN o.status = 'served' THEN 1 ELSE 0 END), 0) as completedOrders,
        COALESCE(COUNT(o.id), 0) as totalOrders
      FROM users u
      LEFT JOIN orders o ON o.waiter_id = u.id
      WHERE u.role IN ('kitchen', 'stock_manager') AND u.left_company = 0
      GROUP BY u.id
    `).all();
    res.json(staff);
  });

  app.post('/api/admin/staff', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const staff = Array.isArray(req.body.staff) ? req.body.staff : [];
    const created: any[] = [];

    const insertStaff = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');

    staff.forEach((entry: any) => {
      const name = String(entry.name || '').trim();
      const role = entry.role || 'kitchen';
      const rawEmail = entry.email ? String(entry.email).trim() : makeEmailFromName(name, role);
      const email = ensureUniqueEmail(rawEmail);
      const password = entry.password ? String(entry.password).trim() : generateRandomPassword(8);
      const hashedPassword = bcrypt.hashSync(password, 10);

      insertStaff.run(name || `${role} staff`, email, hashedPassword, role);
      created.push({ name: name || `${role} staff`, role, email, password });
    });

    io.emit('staff-status-updated');
    res.json(created);
  });

  app.delete('/api/admin/staff/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.prepare('UPDATE users SET left_company = 1, active = 0 WHERE id = ?').run(req.params.id);
    io.emit('staff-status-updated');
    res.json({ success: true });
  });

  // Tables Routes
  app.get('/api/tables', authenticate, (req: any, res: any) => {
    const tables = db.prepare('SELECT * FROM tables').all();
    res.json(tables);
  });

  // Admin & Kitchen: add a table
  app.post('/api/tables', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'kitchen') return res.status(403).json({ error: 'Forbidden' });
    const { table_number } = req.body;
    if (!table_number) return res.status(400).json({ error: 'table_number required' });
    try {
      const result = db.prepare('INSERT INTO tables (table_number) VALUES (?)').run(table_number.trim());
      io.emit('table-status-updated');
      res.json({ id: result.lastInsertRowid, table_number: table_number.trim() });
    } catch (e: any) {
      res.status(400).json({ error: 'Table already exists' });
    }
  });

  // Admin & Kitchen: merge tables
  app.post('/api/tables/merge', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'kitchen') return res.status(403).json({ error: 'Forbidden' });
    const { source_table_id, target_table_id } = req.body;
    if (!source_table_id || !target_table_id) return res.status(400).json({ error: 'Source and target tables required' });
    if (source_table_id === target_table_id) return res.status(400).json({ error: 'Cannot merge a table with itself' });
    try {
      // Move all active orders from source → target
      db.prepare("UPDATE orders SET table_id = ? WHERE table_id = ? AND status NOT IN ('paid', 'cancelled')").run(target_table_id, source_table_id);
      // Record the merge link on the source table
      db.prepare('UPDATE tables SET merged_into = ? WHERE id = ?').run(target_table_id, source_table_id);
      io.emit('order-status-updated');
      io.emit('table-status-updated');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin & Kitchen: unmerge a table (restore source table's independent status)
  app.post('/api/tables/unmerge', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'kitchen') return res.status(403).json({ error: 'Forbidden' });
    const { source_table_id } = req.body;
    if (!source_table_id) return res.status(400).json({ error: 'source_table_id required' });
    try {
      db.prepare('UPDATE tables SET merged_into = NULL WHERE id = ?').run(source_table_id);
      io.emit('table-status-updated');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin & Kitchen: delete a table
  app.delete('/api/admin/tables/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'kitchen') return res.status(403).json({ error: 'Forbidden' });
    try {
      db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
      io.emit('table-status-updated');
      res.json({ success: true });
    } catch (e: any) {
      if (e.message.includes('FOREIGN KEY')) {
        return res.status(400).json({ error: 'Cannot delete table with existing orders. Clear the orders first.' });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Image upload endpoint
  app.post('/api/admin/upload-image', authenticate, upload.single('image'), (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

  // Update menu item image (or full update)
  app.put('/api/menu/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { name, price, category, sub_category, type, description, preparation_time, stock, is_veg, half_price, image_url, unit } = req.body;
    const out_of_stock = Number(stock) <= 0 ? 1 : 0;
    const finalType = type || (is_veg === 0 || is_veg === false ? 'non-veg' : 'veg');
    db.prepare(`UPDATE menu SET name=?, price=?, category=?, sub_category=?, type=?, description=?, preparation_time=?, stock=?, out_of_stock=?, is_veg=?, half_price=?, image_url=?, unit=? WHERE id=?`)
      .run(name, Number(price), category, sub_category || '', finalType, description || '',
        Number(preparation_time) || 0, Number(stock) || 0, out_of_stock,
        finalType === 'veg' ? 1 : 0, Number(half_price) || 0, image_url || null, unit || 'pcs', req.params.id);
    io.emit('menu-updated');
    res.json({ success: true });
  });

  // Bulk stock update
  app.post('/api/admin/bulk-stock', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'stock_manager') return res.status(403).json({ error: 'Forbidden' });
    const { updates } = req.body; // Array of { id, stock, price, unit }
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Updates must be an array' });

    const transaction = db.transaction(() => {
      const stmt = db.prepare('UPDATE menu SET stock = ?, price = ?, unit = ?, out_of_stock = ? WHERE id = ?');
      updates.forEach((u: any) => {
        const out_of_stock = Number(u.stock) <= 0 ? 1 : 0;
        stmt.run(Number(u.stock), Number(u.price), u.unit || 'pcs', out_of_stock, u.id);
      });
    });
    transaction();
    io.emit('menu-updated');
    res.json({ success: true });
  });

  // Bulk add inventory items
  app.post('/api/inventory/bulk', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'stock_manager') return res.status(403).json({ error: 'Forbidden' });
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Invalid data format' });

    try {
      const transaction = db.transaction(() => {
        const insertItem = db.prepare(`
          INSERT INTO inventory (name, category, unit, min_stock, price, stock)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const insertBatch = db.prepare(`
          INSERT INTO inventory_batches (inventory_id, quantity, remaining_quantity, price)
          VALUES (?, ?, ?, ?)
        `);

        for (const item of items) {
          const result = insertItem.run(
            item.name, 
            item.category || 'Raw Material', 
            item.unit || 'pcs', 
            item.min_stock || 5, 
            item.price || 0, 
            item.stock || 0
          );
          
          const inventoryId = result.lastInsertRowid;
          if (Number(item.stock) > 0) {
            insertBatch.run(inventoryId, item.stock, item.stock, item.price || 0);
          }
        }
      });

      transaction();
      res.json({ success: true, count: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get all inventory (raw materials)
  app.get('/api/inventory', (req, res) => {
    try {
      const inventory = db.prepare('SELECT * FROM inventory').all();
      res.json(inventory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Add new inventory item
  app.post('/api/inventory', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'stock_manager') return res.status(403).json({ error: 'Forbidden' });
    const { name, category, unit, min_stock, price, stock } = req.body;
    try {
      const transaction = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO inventory (name, category, unit, min_stock, price, stock)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(name, category, unit || 'pcs', min_stock || 5, price || 0, stock || 0);
        
        const inventoryId = result.lastInsertRowid;

        if (Number(stock) > 0) {
          db.prepare(`
            INSERT INTO inventory_batches (inventory_id, quantity, remaining_quantity, price)
            VALUES (?, ?, ?, ?)
          `).run(inventoryId, stock, stock, price || 0);
        }

        return inventoryId;
      });

      const id = transaction();
      res.json({ id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Bulk stock transaction for inventory
  app.post('/api/admin/stock-transaction', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'stock_manager') return res.status(403).json({ error: 'Forbidden' });
    const { items: txItems, type, target } = req.body; 
    
    if (!Array.isArray(txItems) || txItems.length === 0 || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const itemType = target || 'inventory';

    try {
      const batch_id = Date.now().toString();

      const transaction = db.transaction(() => {
        const insertStmt = db.prepare(`
          INSERT INTO stock_transactions (item_id, item_type, manager_id, type, quantity, price, unit)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const updateTable = itemType === 'menu' ? 'menu' : 'inventory';
        const updateStmt = db.prepare(`UPDATE ${updateTable} SET stock = ?, price = ?, min_stock = ? WHERE id = ?`);
        const getStockStmt = db.prepare(`SELECT stock, min_stock FROM ${updateTable} WHERE id = ?`);

        txItems.forEach((u: any) => {
          // 1. Record basic transaction
          insertStmt.run(u.item_id, itemType, req.user.id, type, Number(u.quantity), Number(u.price), u.unit || 'pcs');

          // 2. FIFO Batch Handling for Store Inventory
          if (itemType === 'inventory') {
            if (type === 'in') {
              // Create new batch for Entry
              db.prepare(`
                INSERT INTO inventory_batches (inventory_id, quantity, remaining_quantity, price)
                VALUES (?, ?, ?, ?)
              `).run(u.item_id, Number(u.quantity), Number(u.quantity), Number(u.price));
            } else {
              // Consume oldest batches for Exit (FIFO)
              let remainingToConsume = Number(u.quantity);
              const batches = db.prepare(`
                SELECT * FROM inventory_batches 
                WHERE inventory_id = ? AND remaining_quantity > 0 
                ORDER BY created_at ASC
              `).all(u.item_id) as any[];

              for (const batch of batches) {
                if (remainingToConsume <= 0) break;
                const consumption = Math.min(batch.remaining_quantity, remainingToConsume);
                db.prepare(`
                  UPDATE inventory_batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?
                `).run(consumption, batch.id);
                remainingToConsume -= consumption;
              }
            }
          }

          // 3. Update main stock counter & min_stock
          const item = getStockStmt.get(u.item_id) as any;
          const currentStock = item ? item.stock : 0;
          const newStock = type === 'in' ? currentStock + Number(u.quantity) : Math.max(0, currentStock - Number(u.quantity));
          
          // Use provided min_stock or fallback to current
          const newMinStock = u.min_stock !== undefined ? Number(u.min_stock) : (item ? item.min_stock : 5);
          
          updateStmt.run(newStock, Number(u.price), newMinStock, u.item_id);
          
          if (itemType === 'menu') {
            db.prepare('UPDATE menu SET out_of_stock = ? WHERE id = ?').run(newStock <= 0 ? 1 : 0, u.item_id);
          }
        });

        return batch_id;
      });

      transaction();
      
      const tableName = itemType === 'menu' ? 'menu' : 'inventory';
      const receiptItems = db.prepare(`
        SELECT st.*, t.name as item_name, u.name as manager_name
        FROM stock_transactions st
        JOIN ${tableName} t ON st.item_id = t.id
        JOIN users u ON st.manager_id = u.id
        WHERE st.manager_id = ? AND st.item_type = ?
        ORDER BY st.id DESC LIMIT ?
      `).all(req.user.id, itemType, txItems.length);

      io.emit('menu-updated');
      res.json({
        id: batch_id,
        manager_name: req.user.name,
        created_at: new Date().toISOString(),
        type: type,
        items: receiptItems.reverse()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get stock transaction history
  app.get('/api/admin/stock-history', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin' && req.user.role !== 'stock_manager') return res.status(403).json({ error: 'Forbidden' });
    
    try {
      const history = db.prepare(`
        SELECT 
          st.*,
          COALESCE(i.name, m.name) as item_name,
          COALESCE(i.category, m.category) as category,
          u.name as manager_name
        FROM stock_transactions st
        LEFT JOIN inventory i ON st.item_id = i.id AND st.item_type = 'inventory'
        LEFT JOIN menu m ON st.item_id = m.id AND st.item_type = 'menu'
        JOIN users u ON st.manager_id = u.id
        ORDER BY st.created_at DESC
      `).all();
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Orders Routes
  app.get('/api/orders', authenticate, (req: any, res: any) => {
    let query = `
      SELECT o.*, t.table_number, u.name as staff_name 
      FROM orders o 
      JOIN tables t ON o.table_id = t.id 
      JOIN users u ON o.waiter_id = u.id
    `;

    let params: any[] = [];
    if (req.user.role === 'admin') {
      // Admin sees ALL orders except cancelled normally? No, admin sees all, maybe filter later if needed.
    } else if (req.user.role === 'kitchen') {
      if (req.query.history === 'true') {
        query += ` WHERE o.status IN ('served', 'billing', 'paid', 'cancelled')`;
      } else {
        query += ` WHERE o.status NOT IN ('pending', 'served', 'billing', 'paid', 'cancelled')`;
      }
    }

    query += ` ORDER BY o.created_at DESC`;

    const orders = db.prepare(query).all(...params) as any[];

    const ordersWithItems = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.id as item_id, oi.*, m.name as item_name, m.price, m.is_veg, m.half_price 
        FROM order_items oi 
        JOIN menu m ON oi.menu_id = m.id 
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });

    res.json(ordersWithItems);
  });

  app.post('/api/orders', authenticate, (req: any, res: any) => {
    try {
      const { table_id, items, customer_phone, customer_name, payment_method, notes } = req.body;

      const transaction = db.transaction(() => {
        // Calculate total_price on server to prevent tampering
        let calculatedTotal = 0;
        const menuItems = db.prepare('SELECT id, price, half_price FROM menu').all() as any[];
        const menuMap = new Map(menuItems.map(m => [m.id, m]));

        items.forEach((item: any) => {
          const menuItem = menuMap.get(item.menu_id);
          if (menuItem) {
            const price = item.portion === 'half' ? (menuItem.half_price || menuItem.price / 2) : menuItem.price;
            calculatedTotal += price * item.quantity;
          }
        });

        // Handle CRM customer linkage
        let customerId: number | null = null;
        if (customer_phone) {
          let cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customer_phone) as any;
          if (!cust) {
            const r = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customer_name || 'Guest', customer_phone);
            customerId = r.lastInsertRowid as number;
          } else {
            customerId = cust.id;
          }
        }

        const insertOrder = db.prepare('INSERT INTO orders (table_id, waiter_id, total_price, customer_id, payment_method) VALUES (?, ?, ?, ?, ?)');
        const orderResult = insertOrder.run(table_id, req.user.id, calculatedTotal, customerId, payment_method || 'cash');
        const orderId = orderResult.lastInsertRowid;

        const insertItem = db.prepare("INSERT INTO order_items (order_id, menu_id, quantity, portion) VALUES (?, ?, ?, ?)");
        const updateStock = db.prepare("UPDATE menu SET stock = MAX(0, stock - ?), out_of_stock = CASE WHEN MAX(0, stock - ?) <= 0 THEN 1 ELSE out_of_stock END WHERE id = ?");

        items.forEach((item: any) => {
          insertItem.run(orderId, item.menu_id, item.quantity, item.portion || 'full');
          updateStock.run(item.quantity, item.quantity, item.menu_id);
        });

        // Award loyalty points to customer
        if (customerId) {
          const pts = Math.floor(calculatedTotal / 10);
          db.prepare('UPDATE customers SET visits = visits + 1, total_spent = total_spent + ?, points = points + ? WHERE id = ?')
            .run(calculatedTotal, pts, customerId);
        }
        return orderId;
      });

      const orderId = transaction();
      // Fetch full order for socket broadcast
      const fullOrder = db.prepare(`
        SELECT o.*, t.table_number, u.name as staff_name 
        FROM orders o 
        JOIN tables t ON o.table_id = t.id 
        JOIN users u ON o.waiter_id = u.id
        WHERE o.id = ?
      `).get(orderId) as any;

      if (fullOrder) {
        fullOrder.items = db.prepare(`
          SELECT oi.*, m.name as item_name, m.price, m.is_veg, m.half_price 
          FROM order_items oi 
          JOIN menu m ON oi.menu_id = m.id 
          WHERE oi.order_id = ?
        `).all(orderId);

        io.emit('new-order', fullOrder);
      }
      io.emit('stats-update');
      res.json(fullOrder || { id: orderId, status: 'new' });
    } catch (error: any) {
      console.error('[API] Error placing order:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/orders/:id/status', authenticate, (req: any, res: any) => {
    const { status } = req.body;
    console.log(`[API] Updating order ${req.params.id} to status: ${status}. User: ${req.user.role}`);
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);

    io.emit('order-status-updated', { id: parseInt(req.params.id), status });
    io.emit('stats-update');
    res.json({ success: true });
  });

  // Add more items to an existing order (running order)
  app.post('/api/orders/:id/add-items', authenticate, (req: any, res: any) => {
    try {
      const { items, notes } = req.body;
      const orderId = parseInt(req.params.id);
      if (!items?.length) return res.status(400).json({ error: 'items required' });

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const menuItems = db.prepare('SELECT id, price, half_price FROM menu').all() as any[];
      const menuMap = new Map(menuItems.map((m: any) => [m.id, m]));

      let addedTotal = 0;
      const insertItem = db.prepare("INSERT INTO order_items (order_id, menu_id, quantity, portion, notes) VALUES (?, ?, ?, ?, ?)");
      const updateStock = db.prepare("UPDATE menu SET stock = MAX(0, stock - ?), out_of_stock = CASE WHEN MAX(0, stock - ?) <= 0 THEN 1 ELSE out_of_stock END WHERE id = ?");

      items.forEach((item: any) => {
        const mi = menuMap.get(item.menu_id);
        if (mi) {
          const price = item.portion === 'half' ? (mi.half_price || mi.price / 2) : mi.price;
          addedTotal += price * item.quantity;
        }
        insertItem.run(orderId, item.menu_id, item.quantity, item.portion || 'full', item.notes || '');
        updateStock.run(item.quantity, item.quantity, item.menu_id);
      });

      // Also update order notes if provided
      if (notes) db.prepare('UPDATE orders SET notes = ? WHERE id = ?').run(notes, orderId);

      // Update total price
      db.prepare('UPDATE orders SET total_price = total_price + ? WHERE id = ?').run(addedTotal, orderId);

      // ── KEY FIX: If the order was already served/billing/ready/paid,
      // reset it to 'new' so kitchen gets notified about the extra items.
      const kitchenStatuses = ['served', 'billing', 'ready', 'paid'];
      let newStatus = order.status;
      if (kitchenStatuses.includes(order.status)) {
        newStatus = 'new';
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('new', orderId);
        console.log(`[ADD-ITEMS] Order #${orderId} reset from '${order.status}' → 'new' for kitchen.`);
      }

      // Fetch the updated full order to broadcast to kitchen
      const updatedOrder = db.prepare(`
        SELECT o.*, t.table_number, u.name as staff_name
        FROM orders o
        JOIN tables t ON o.table_id = t.id
        JOIN users u ON o.waiter_id = u.id
        WHERE o.id = ?
      `).get(orderId) as any;

      if (updatedOrder) {
        updatedOrder.items = db.prepare(`
          SELECT oi.*, m.name as item_name, m.price, m.is_veg, m.half_price
          FROM order_items oi JOIN menu m ON oi.menu_id = m.id
          WHERE oi.order_id = ?
        `).all(orderId);

        // If status was reset → fire new-order so kitchen panel shows it
        if (newStatus === 'new') {
          io.emit('new-order', updatedOrder);
        }
      }

      io.emit('order-status-updated', { id: orderId, status: newStatus });
      io.emit('stats-update');
      res.json({ success: true, added: items.length, extra: addedTotal, newStatus });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // Update order notes
  app.patch('/api/orders/:id/notes', authenticate, (req: any, res: any) => {
    const { notes } = req.body;
    db.prepare('UPDATE orders SET notes = ? WHERE id = ?').run(notes || '', req.params.id);
    io.emit('order-status-updated', { id: parseInt(req.params.id) });
    res.json({ success: true });
  });

  // ── Mark Table Paid: generate bill number + save to Excel ───────────────
  app.post('/api/admin/mark-paid', authenticate, async (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { order_ids, table_number, staff_name } = req.body;
      if (!order_ids?.length) return res.status(400).json({ error: 'No order_ids provided' });

      // ── Generate bill number: BILL-YYYYMMDD-NNN ────────────────────────
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const lastBill = db.prepare(
        `SELECT bill_number FROM orders WHERE bill_number LIKE 'BILL-${dateStr}-%' ORDER BY bill_number DESC LIMIT 1`
      ).get() as any;
      let seq = 1;
      if (lastBill?.bill_number) {
        const parts = lastBill.bill_number.split('-');
        seq = parseInt(parts[parts.length - 1]) + 1;
      }
      const billNumber = `BILL-${dateStr}-${String(seq).padStart(3, '0')}`;

      // ── Fetch full order + items data (before marking paid) ─────────────
      const orders = order_ids.map((oid: number) => {
        const order = db.prepare(`SELECT o.*, t.table_number, u.name as staff_name FROM orders o
          JOIN tables t ON o.table_id = t.id
          JOIN users u ON o.waiter_id = u.id WHERE o.id = ?`).get(oid) as any;
        if (!order) return null;
        const items = db.prepare(`SELECT oi.id as item_id, oi.*, m.name as item_name, m.price, m.half_price
          FROM order_items oi JOIN menu m ON oi.menu_id = m.id WHERE oi.order_id = ?`).all(oid) as any[];
        return { ...order, items };
      }).filter(Boolean);

      const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
      const cgstPercent = settings?.cgst_percent || 0;
      const sgstPercent = settings?.sgst_percent || 0;
      const servicePercent = settings?.service_charge_percent || 0;

      const subtotal = orders.reduce((s: number, o: any) => s + (o.total_price || 0), 0);
      const cgstAmount = Number((subtotal * cgstPercent / 100).toFixed(2));
      const sgstAmount = Number((subtotal * sgstPercent / 100).toFixed(2));
      const serviceAmount = Number((subtotal * servicePercent / 100).toFixed(2));
      const totalWithTax = subtotal + cgstAmount + sgstAmount + serviceAmount;
      const finalGrandTotal = Math.round(totalWithTax);
      const roundOff = Number((finalGrandTotal - totalWithTax).toFixed(2));

      // ── Mark all orders as paid + set bill_number + save taxes ─────────
      const paidAt = today.toISOString();
      for (const oid of order_ids) {
        db.prepare(`
          UPDATE orders 
          SET status = ?, 
              bill_number = ?, 
              paid_at = ?, 
              cgst = ?, 
              sgst = ?, 
              service_charge = ?, 
              round_off = ?, 
              grand_total = ? 
          WHERE id = ?
        `).run('paid', billNumber, paidAt, cgstAmount, sgstAmount, serviceAmount, roundOff, finalGrandTotal, oid);
      }

      // ── Append to bills_log.xlsx ───────────────────────────────────────
      const xlsxPath = path.join(__dirname, 'bills_log.xlsx');
      let wb: any;
      if (fs.existsSync(xlsxPath)) {
        wb = XLSX.readFile(xlsxPath);
      } else {
        wb = XLSX.utils.book_new();
      }
      const wsName = 'Bills';
      let ws = wb.Sheets[wsName];
      const header = ['Bill No', 'Date', 'Time', 'Table', 'Staff', 'Items', 'Subtotal (₹)', 'CGST (₹)', 'SGST (₹)', 'Round Off (₹)', 'Grand Total (₹)'];
      const itemsSummary = orders.flatMap((o: any) =>
        (o.items || []).map((i: any) => {
          const p = i.portion === 'half' ? (i.half_price || i.price / 2) : i.price;
          return `${i.item_name}${i.portion === 'half' ? '(½)' : ''} x${i.quantity} @₹${p}`;
        })
      ).join(', ');
      const newRow = [
        billNumber,
        today.toLocaleDateString('en-IN'),
        today.toLocaleTimeString('en-IN'),
        table_number || (orders[0]?.table_number ?? ''),
        staff_name || (orders[0]?.staff_name ?? ''),
        itemsSummary,
        subtotal.toFixed(2),
        cgstAmount.toFixed(2),
        sgstAmount.toFixed(2),
        roundOff.toFixed(2),
        finalGrandTotal.toFixed(2),
      ];
      if (!ws) {
        ws = XLSX.utils.aoa_to_sheet([header, newRow]);
        XLSX.utils.book_append_sheet(wb, ws, wsName);
      } else {
        XLSX.utils.sheet_add_aoa(ws, [newRow], { origin: -1 });
      }
      XLSX.writeFile(wb, xlsxPath);
      console.log(`[BILL] ${billNumber} saved → bills_log.xlsx`);

      io.emit('order-status-updated', {});
      io.emit('stats-update');
      res.json({
        success: true,
        bill_number: billNumber,
        grand_total: finalGrandTotal,
        subtotal,
        cgst: cgstAmount,
        sgst: sgstAmount,
        round_off: roundOff,
        orders,
        paid_at: paidAt,
      });
    } catch (e: any) {
      console.error('[MARK-PAID ERROR]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── Bills History: filtered paid bills with tax breakdown ──────────────────
  app.get('/api/admin/bills-history', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { from, to } = req.query;
      let query = `
        SELECT o.id, o.bill_number,
               o.total_price, o.cgst, o.sgst, o.service_charge, o.round_off, o.grand_total,
               COALESCE(o.paid_at, o.created_at) as paid_at,
               t.table_number, u.name as staff_name,
               GROUP_CONCAT(m.name || ' x' || oi.quantity, ', ') as items
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN users u ON o.waiter_id = u.id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN menu m ON m.id = oi.menu_id
        WHERE o.status = 'paid'
      `;
      const params: any[] = [];
      if (from) { query += ` AND date(COALESCE(o.paid_at, o.created_at)) >= date(?)`; params.push(from); }
      if (to)   { query += ` AND date(COALESCE(o.paid_at, o.created_at)) <= date(?)`; params.push(to); }
      query += ` GROUP BY o.id ORDER BY paid_at DESC`;
      const bills = db.prepare(query).all(...params) as any[];
      res.json(bills);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Bills Reset: delete paid orders within date range ────────────────────
  app.delete('/api/admin/bills-reset', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { from, to } = req.query;
      let query = `SELECT id FROM orders WHERE status = 'paid'`;
      const params: any[] = [];
      if (from) { query += ` AND date(paid_at) >= date(?)`; params.push(from); }
      if (to)   { query += ` AND date(paid_at) <= date(?)`; params.push(to); }
      const ids = (db.prepare(query).all(...params) as any[]).map((r: any) => r.id);
      if (!ids.length) return res.json({ deleted: 0 });
      const ph = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM order_items WHERE order_id IN (${ph})`).run(...ids);
      db.prepare(`DELETE FROM orders WHERE id IN (${ph})`).run(...ids);
      io.emit('stats-update');
      io.emit('order-status-updated', {});
      res.json({ deleted: ids.length });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/admin/order-items/:itemId', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const itemId = parseInt(req.params.itemId);
      // Get item details before deleting (to recalculate total)
      const item = db.prepare(`
        SELECT oi.id as item_id, oi.order_id, oi.quantity, oi.portion, m.price, m.half_price 
        FROM order_items oi
        JOIN menu m ON oi.menu_id = m.id WHERE oi.id = ?
      `).get(itemId) as any;
      if (!item) return res.status(404).json({ error: 'Item not found', itemId });

      const price = item.portion === 'half' ? (item.half_price || item.price / 2) : item.price;
      const itemTotal = price * item.quantity;

      // Delete item and reduce order total
      db.prepare('DELETE FROM order_items WHERE id = ?').run(itemId);
      db.prepare('UPDATE orders SET total_price = MAX(0, total_price - ?) WHERE id = ?').run(itemTotal, item.order_id);

      io.emit('order-status-updated', { id: item.order_id });
      io.emit('stats-update');
      res.json({ success: true, removed: itemTotal });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Apply discount to a table's orders (admin) ─────────────────────────
  app.put('/api/admin/orders/discount', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const { order_ids, discount_type } = req.body;
      const discount_value = parseFloat(req.body.discount_value);
      console.log('[DISCOUNT]', { order_ids, discount_type, discount_value });
      if (!order_ids?.length || isNaN(discount_value) || discount_value <= 0)
        return res.status(400).json({ error: 'Missing or invalid params', received: req.body });

      // Calculate total of all orders first (for percent split)
      const allOrders = order_ids.map((oid: number) =>
        db.prepare('SELECT id, total_price FROM orders WHERE id = ?').get(oid) as any
      ).filter(Boolean);

      const grandTotal = allOrders.reduce((s: number, o: any) => s + o.total_price, 0);

      for (const order of allOrders) {
        let discForThisOrder = 0;
        if (discount_type === 'percent') {
          // Each order gets its proportional share of percent discount
          discForThisOrder = order.total_price * discount_value / 100;
        } else {
          // Flat: split proportionally by order's share of grand total
          const share = grandTotal > 0 ? order.total_price / grandTotal : 1 / allOrders.length;
          discForThisOrder = discount_value * share;
        }
        const newTotal = Math.max(0, Math.round((order.total_price - discForThisOrder) * 100) / 100);
        db.prepare('UPDATE orders SET total_price = ? WHERE id = ?').run(newTotal, order.id);
        console.log(`[DISCOUNT] Order #${order.id}: ${order.total_price} → ${newTotal}`);
      }
      io.emit('stats-update');
      io.emit('order-status-updated', {});
      res.json({ success: true });
    } catch (e: any) { 
      console.error('[DISCOUNT ERROR]', e.message);
      res.status(500).json({ error: e.message }); 
    }
  });

  // Reset all orders for new month (admin only)
  app.post('/api/admin/reset-orders', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
      const orderCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any).count;
      db.prepare('DELETE FROM order_items').run();
      db.prepare('DELETE FROM orders').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='orders'").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name='order_items'").run();
      io.emit('stats-update');
      io.emit('new-order');
      res.json({ success: true, deleted: orderCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── SETTINGS ROUTES ────────────────────────────────────────────────────────
  app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(settings);
  });

  app.put('/api/settings', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { restaurant_name, address, gst_number, fssai_number, cgst_percent, sgst_percent, service_charge_percent, contact_number } = req.body;
    db.prepare(`
      UPDATE settings SET 
        restaurant_name = ?, address = ?, gst_number = ?, fssai_number = ?, 
        cgst_percent = ?, sgst_percent = ?, service_charge_percent = ?, contact_number = ?
      WHERE id = 1
    `).run(restaurant_name, address, gst_number, fssai_number, cgst_percent, sgst_percent, service_charge_percent, contact_number);
    res.json({ success: true });
  });

  // ─── PUBLIC QR ORDERING ROUTES (no auth required) ────────────────────────
  app.get('/api/public/menu', (req, res) => {
    const menu = db.prepare('SELECT * FROM menu WHERE out_of_stock = 0').all();
    res.json(menu);
  });

  app.get('/api/public/table/:number', (req, res: any) => {
    const table = db.prepare('SELECT * FROM tables WHERE table_number = ?').get(req.params.number);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    res.json(table);
  });

  app.post('/api/public/orders', (req: any, res: any) => {
    try {
      const { table_id, items, customer_name, customer_phone } = req.body;
      if (!table_id || !items?.length) return res.status(400).json({ error: 'table_id and items required' });

      // Self-orders are attributed to admin, with kitchen as a fallback if no admin exists.
      let targetStaffId = 1;
      const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as any;
      if (adminUser) {
        targetStaffId = adminUser.id;
      } else {
        const kitchenUser = db.prepare("SELECT id FROM users WHERE role = 'kitchen' LIMIT 1").get() as any;
        if (kitchenUser) targetStaffId = kitchenUser.id;
      }

      // Handle customer CRM
      let customerId: number | null = null;
      if (customer_phone) {
        let cust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customer_phone) as any;
        if (!cust) {
          const r = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(customer_name || 'Guest', customer_phone);
          customerId = r.lastInsertRowid as number;
        } else {
          customerId = cust.id;
        }
      }

      const transaction = db.transaction(() => {
        let calculatedTotal = 0;
        const menuItems = db.prepare('SELECT id, price, half_price FROM menu').all() as any[];
        const menuMap = new Map(menuItems.map(m => [m.id, m]));
        items.forEach((item: any) => {
          const menuItem = menuMap.get(item.menu_id);
          if (menuItem) {
            const price = item.portion === 'half' ? (menuItem.half_price || menuItem.price / 2) : menuItem.price;
            calculatedTotal += price * item.quantity;
          }
        });

        const orderResult = db.prepare(
          'INSERT INTO orders (table_id, waiter_id, total_price, customer_id, payment_method, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(table_id, targetStaffId, calculatedTotal, customerId, 'self-order', 'pending');
        const orderId = orderResult.lastInsertRowid;

        const insertItem = db.prepare("INSERT INTO order_items (order_id, menu_id, quantity, portion) VALUES (?, ?, ?, ?)");
        items.forEach((item: any) => insertItem.run(orderId, item.menu_id, item.quantity, item.portion || 'full'));

        // Award loyalty points: 1 per 10 spent
        if (customerId) {
          const pts = Math.floor(calculatedTotal / 10);
          db.prepare('UPDATE customers SET visits = visits + 1, total_spent = total_spent + ?, points = points + ? WHERE id = ?')
            .run(calculatedTotal, pts, customerId);
        }
        return { orderId, total: calculatedTotal };
      });

      const result = transaction() as any;
      const fullOrder = db.prepare(
        `SELECT o.*, t.table_number, u.name as staff_name FROM orders o
         JOIN tables t ON o.table_id = t.id JOIN users u ON o.waiter_id = u.id WHERE o.id = ?`
      ).get(result.orderId) as any;
      if (fullOrder) {
        fullOrder.items = db.prepare(
          `SELECT oi.*, m.name as item_name, m.price FROM order_items oi JOIN menu m ON oi.menu_id = m.id WHERE oi.order_id = ?`
        ).all(result.orderId);
        io.emit('new-order', { ...fullOrder, self_order: true });
      }
      io.emit('stats-update');
      res.json({ order_id: result.orderId, total: result.total, status: 'new' });
    } catch (e: any) {
      console.error('[Public Order Error]', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ─── CUSTOMER CRM ROUTES ────────────────────────────────────────────────────
  app.get('/api/customers', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const customers = db.prepare('SELECT * FROM customers ORDER BY total_spent DESC').all();
    res.json(customers);
  });

  app.post('/api/customers/lookup', authenticate, (req: any, res: any) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
    res.json(customer || null);
  });

  app.post('/api/customers', authenticate, (req: any, res: any) => {
    const { name, phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    try {
      const result = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(name || 'Guest', phone);
      res.json({ id: result.lastInsertRowid, name: name || 'Guest', phone, points: 0, visits: 0, total_spent: 0 });
    } catch (e: any) {
      // Duplicate phone — return existing
      const existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
      res.json(existing);
    }
  });

  app.patch('/api/customers/:id/points', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { points } = req.body;
    db.prepare('UPDATE customers SET points = ? WHERE id = ?').run(Number(points), req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/customers/:id', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ─── ADVANCED ANALYTICS ROUTE ───────────────────────────────────────────────
  app.get('/api/admin/analytics', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const topItems = db.prepare(`
      SELECT m.name, SUM(oi.quantity) as quantity_sold, SUM(m.price * oi.quantity) as revenue
      FROM order_items oi JOIN menu m ON oi.menu_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'paid'
      GROUP BY m.id ORDER BY quantity_sold DESC LIMIT 8
    `).all();

    const revenueByDay = db.prepare(`
      SELECT DATE(COALESCE(paid_at, created_at)) as date, SUM(COALESCE(grand_total, total_price)) as revenue, COUNT(*) as orders
      FROM orders
      WHERE status = 'paid' AND DATE(COALESCE(paid_at, created_at)) >= DATE('now', '-7 days')
      GROUP BY DATE(COALESCE(paid_at, created_at)) ORDER BY date ASC
    `).all();

    const peakHours = db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as order_count
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY hour ORDER BY hour ASC
    `).all();

    const categoryBreakdown = db.prepare(`
      SELECT m.category, SUM(m.price * oi.quantity) as revenue, SUM(oi.quantity) as qty
      FROM order_items oi JOIN menu m ON oi.menu_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'paid'
      GROUP BY m.category ORDER BY revenue DESC
    `).all();

    const totalCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as any).c;
    const repeatCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers WHERE visits > 1').get() as any).c;
    const totalRevenue = (db.prepare("SELECT SUM(COALESCE(grand_total, total_price)) as t FROM orders WHERE status = 'paid'").get() as any).t || 0;
    const totalOrders = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status != 'cancelled'").get() as any).c;

    res.json({ topItems, revenueByDay, peakHours, categoryBreakdown, totalCustomers, repeatCustomers, totalRevenue, totalOrders });
  });

  // Export all orders data for excel/pdf (admin only)
  app.get('/api/admin/export-data', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const orders = db.prepare(`
      SELECT o.id, o.bill_number, t.table_number, u.name as staff_name,
             o.status, o.total_price, o.cgst, o.sgst, o.service_charge, o.round_off, o.grand_total, o.created_at, o.paid_at
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      JOIN users u ON o.waiter_id = u.id
      ORDER BY o.created_at DESC
    `).all() as any[];
    const result = orders.map(order => {
      const items = db.prepare(`
        SELECT oi.quantity, oi.portion, m.name as item_name, m.price, m.half_price
        FROM order_items oi JOIN menu m ON oi.menu_id = m.id
        WHERE oi.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });
    res.json(result);
  });

  // Admin Stats
  app.get('/api/admin/stats', authenticate, (req: any, res: any) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const totalOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'").get() as any;
    const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status NOT IN ('served', 'billing', 'paid', 'cancelled')").get() as any;
    const completedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('served', 'billing', 'paid')").get() as any;
    const revenue = db.prepare("SELECT SUM(COALESCE(grand_total, total_price)) as total FROM orders WHERE status = 'paid'").get() as any;
    const activeStaff = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'kitchen' AND active = 1 AND left_company = 0").get() as any;
    const totalStaff = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'kitchen' AND left_company = 0").get() as any;

    res.json({
      totalOrders: totalOrders.count,
      activeOrders: activeOrders.count,
      completedOrders: completedOrders.count,
      revenue: revenue.total || 0,
      activeStaff: activeStaff.count,
      totalStaff: totalStaff.count,
    });
  });

  // Reset all users to offline when server starts to prevent ghost sessions from previous ungraceful shutdowns
  db.prepare('UPDATE users SET active = 0').run();
  
  // Track socket connections for real-time online status tracking
  const userSockets = new Map<number, Set<string>>(); // userId -> Set of socket.ids
  const socketUserMap = new Map<string, number>(); // socket.id -> userId

  // Socket.IO
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('register', (userId) => {
      const id = Number(userId);
      socketUserMap.set(socket.id, id);
      
      if (!userSockets.has(id)) {
        userSockets.set(id, new Set());
      }
      userSockets.get(id)?.add(socket.id);
      
      db.prepare('UPDATE users SET active = 1 WHERE id = ?').run(id);
      io.emit('staff-status-updated');
    });

    socket.on('join-room', (role) => {
      socket.join(role);
      console.log(`Socket ${socket.id} joined room: ${role}`);
    });
    
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const userId = socketUserMap.get(socket.id);
      if (userId) {
        socketUserMap.delete(socket.id);
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(userId);
            io.emit('staff-status-updated');
          }
        }
      }
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.DIST_PATH || path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(3000, '0.0.0.0', () => {
    console.log('Server running on http://localhost:3000');
  });
}

startServer();
