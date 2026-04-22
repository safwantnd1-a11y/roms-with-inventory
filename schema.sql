-- Restaurant Order Management System (ROMS)
-- PostgreSQL Schema

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'kitchen')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tables Table
CREATE TABLE tables (
    id SERIAL PRIMARY KEY,
    table_number VARCHAR(10) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available'
);

-- 3. Menu Table
CREATE TABLE menu (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE
);

-- 4. Orders Table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    table_id INTEGER REFERENCES tables(id),
    staff_id INTEGER REFERENCES users(id),
    status VARCHAR(20) CHECK (status IN ('new', 'preparing', 'ready', 'served')) DEFAULT 'new',
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Order Items Table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    menu_id INTEGER REFERENCES menu(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_staff ON orders(staff_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
