import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { getAdminBootstrapConfig } from './config.js';

// --- Schema ---

export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('超市'),
  contactName: text('contact_name').notNull().default(''),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  settlementDay: text('settlement_day').notNull().default(''),
  discountRate: real('discount_rate').notNull().default(1.0),
  basketCount: integer('basket_count').notNull().default(0),
  status: text('status').notNull().default('启用'),
  note: text('note').default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull().default(''),
  status: text('status').notNull().default('启用'),
});

export const productSpecs = sqliteTable('product_specs', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  label: text('label').notNull(),
  unitPrice: real('unit_price').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const deliveryTasks = sqliteTable('delivery_tasks', {
  id: text('id').primaryKey(),
  taskDate: text('task_date').notNull(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id),
  merchantName: text('merchant_name').notNull(),
  merchantType: text('merchant_type').notNull().default(''),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  routeEta: text('route_eta').notNull().default(''),
  status: text('status').notNull().default('待配货'),
  settlementDay: text('settlement_day').notNull().default(''),
  plannedWeight: real('planned_weight').notNull().default(0),
  actualWeight: real('actual_weight').notNull().default(0),
  photoCount: integer('photo_count').notNull().default(0),
  beforeBasketCount: integer('before_basket_count').notNull().default(0),
  sentBasketCount: integer('sent_basket_count').notNull().default(0),
  returnedBasketCount: integer('returned_basket_count').notNull().default(0),
  signMethod: text('sign_method').notNull().default(''),
  operator: text('operator').notNull().default(''),
  note: text('note').default(''),
  exceptionReason: text('exception_reason').default(''),
  exceptionNote: text('exception_note').default(''),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

export const taskItems = sqliteTable('task_items', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => deliveryTasks.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  specId: text('spec_id').notNull(),
  productName: text('product_name').notNull(),
  specLabel: text('spec_label').notNull(),
  unitPrice: real('unit_price').notNull(),
  quantity: integer('quantity').notNull().default(1),
  displayAmount: real('display_amount').notNull().default(0),
  displayUnit: text('display_unit').notNull().default('斤'),
  plannedWeight: real('planned_weight').notNull().default(0),
  actualWeight: real('actual_weight').notNull().default(0),
});

export const taskPhotos = sqliteTable('task_photos', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => deliveryTasks.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull().default('复秤'),
  fileName: text('file_name').notNull(),
  originalName: text('original_name').notNull().default(''),
  mimeType: text('mime_type').notNull().default('image/jpeg'),
  fileSize: integer('file_size').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id),
  merchantName: text('merchant_name').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  totalAmount: real('total_amount').notNull().default(0),
  paidAmount: real('paid_amount').notNull().default(0),
  payStatus: text('pay_status').notNull().default('未收款'),
  payMethod: text('pay_method').default(''),
  operator: text('operator').notNull().default(''),
  note: text('note').default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

export const settlementItems = sqliteTable('settlement_items', {
  id: text('id').primaryKey(),
  settlementId: text('settlement_id').notNull().references(() => settlements.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  taskDate: text('task_date').notNull(),
  productName: text('product_name').notNull(),
  specLabel: text('spec_label').notNull(),
  weight: real('weight').notNull(),
  unitPrice: real('unit_price').notNull(),
  subtotal: real('subtotal').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('admin'),
  status: text('status').notNull().default('启用'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// --- Database connection ---

const dbPath = process.env.DB_PATH || './data/doufu.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite);

// --- Initialize tables ---

export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT '超市',
      contact_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '', settlement_day TEXT NOT NULL DEFAULT '',
      discount_rate REAL NOT NULL DEFAULT 1.0, basket_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '启用', note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '启用'
    );
    CREATE TABLE IF NOT EXISTS product_specs (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
      label TEXT NOT NULL, unit_price REAL NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS delivery_tasks (
      id TEXT PRIMARY KEY, task_date TEXT NOT NULL,
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      merchant_name TEXT NOT NULL, merchant_type TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      route_eta TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '待配货',
      settlement_day TEXT NOT NULL DEFAULT '',
      planned_weight REAL NOT NULL DEFAULT 0, actual_weight REAL NOT NULL DEFAULT 0,
      photo_count INTEGER NOT NULL DEFAULT 0,
      before_basket_count INTEGER NOT NULL DEFAULT 0,
      sent_basket_count INTEGER NOT NULL DEFAULT 0,
      returned_basket_count INTEGER NOT NULL DEFAULT 0,
      sign_method TEXT NOT NULL DEFAULT '', operator TEXT NOT NULL DEFAULT '',
      note TEXT DEFAULT '', exception_reason TEXT DEFAULT '', exception_note TEXT DEFAULT '',
      completed_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_task_date ON delivery_tasks(task_date);
    CREATE INDEX IF NOT EXISTS idx_task_merchant ON delivery_tasks(merchant_id);
    CREATE INDEX IF NOT EXISTS idx_task_status ON delivery_tasks(status);
    CREATE TABLE IF NOT EXISTS task_items (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES delivery_tasks(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL, spec_id TEXT NOT NULL,
      product_name TEXT NOT NULL, spec_label TEXT NOT NULL,
      unit_price REAL NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
      display_amount REAL NOT NULL DEFAULT 0, display_unit TEXT NOT NULL DEFAULT '斤',
      planned_weight REAL NOT NULL DEFAULT 0, actual_weight REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_task_items_task ON task_items(task_id);
    CREATE TABLE IF NOT EXISTS task_photos (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES delivery_tasks(id) ON DELETE CASCADE,
      stage TEXT NOT NULL DEFAULT '复秤',
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_task_photos_task ON task_photos(task_id);
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id),
      merchant_name TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0, paid_amount REAL NOT NULL DEFAULT 0,
      pay_status TEXT NOT NULL DEFAULT '未收款', pay_method TEXT DEFAULT '',
      operator TEXT NOT NULL DEFAULT '', note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS settlement_items (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, task_date TEXT NOT NULL,
      product_name TEXT NOT NULL, spec_label TEXT NOT NULL,
      weight REAL NOT NULL, unit_price REAL NOT NULL, subtotal REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stl_items_settlement ON settlement_items(settlement_id);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin', status TEXT NOT NULL DEFAULT '启用',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  ensureTaskItemColumn('display_amount', `ALTER TABLE task_items ADD COLUMN display_amount REAL NOT NULL DEFAULT 0`);
  ensureTaskItemColumn('display_unit', `ALTER TABLE task_items ADD COLUMN display_unit TEXT NOT NULL DEFAULT '斤'`);
  ensureTableColumn('task_photos', 'stage', `ALTER TABLE task_photos ADD COLUMN stage TEXT NOT NULL DEFAULT '复秤'`);
  normalizeLegacyTaskStatuses();
  ensureAdminUser();
  console.log('Database initialized');
}

function ensureTaskItemColumn(columnName: string, statement: string) {
  ensureTableColumn('task_items', columnName, statement);
}

function ensureTableColumn(tableName: string, columnName: string, statement: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some(column => column.name === columnName)) return;
  sqlite.exec(statement);
}

function normalizeLegacyTaskStatuses() {
  sqlite.prepare(`UPDATE delivery_tasks SET status = '待复秤', updated_at = datetime('now','localtime') WHERE status = '待拍照'`).run();
}

function ensureAdminUser() {
  const admin = getAdminBootstrapConfig();
  if (!admin) return;

  const passwordHash = bcrypt.hashSync(admin.password, 10);
  const existing = sqlite.prepare('SELECT id FROM users WHERE id = ?').get('user_admin');
  const byUsername = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(admin.username) as { id: string } | undefined;
  const userId = byUsername?.id || 'user_admin';

  if (existing || byUsername) {
    sqlite.prepare(`
      UPDATE users
      SET username = ?, password_hash = ?, display_name = ?, role = ?, status = '启用'
      WHERE id = ?
    `).run(admin.username, passwordHash, admin.displayName, admin.role, userId);
    return;
  }

  sqlite.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, status)
    VALUES (?, ?, ?, ?, ?, '启用')
  `).run(userId, admin.username, passwordHash, admin.displayName, admin.role);
}
