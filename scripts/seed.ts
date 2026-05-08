import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import '../server/env.js';

const dbPath = process.env.DB_PATH || './data/doufu.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create tables
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
  CREATE TABLE IF NOT EXISTS task_items (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES delivery_tasks(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL, spec_id TEXT NOT NULL,
    product_name TEXT NOT NULL, spec_label TEXT NOT NULL,
    unit_price REAL NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
    display_amount REAL NOT NULL DEFAULT 0, display_unit TEXT NOT NULL DEFAULT '斤',
    planned_weight REAL NOT NULL DEFAULT 0, actual_weight REAL NOT NULL DEFAULT 0
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
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin', status TEXT NOT NULL DEFAULT '启用',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// Seed data
const insertMerchant = sqlite.prepare(`INSERT OR IGNORE INTO merchants (id, name, type, contact_name, phone, address, settlement_day, discount_rate, basket_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertProduct = sqlite.prepare(`INSERT OR IGNORE INTO products (id, name, category) VALUES (?, ?, ?)`);
const insertSpec = sqlite.prepare(`INSERT OR IGNORE INTO product_specs (id, product_id, label, unit_price, sort_order) VALUES (?, ?, ?, ?, ?)`);
const insertTask = sqlite.prepare(`INSERT OR IGNORE INTO delivery_tasks (id, task_date, merchant_id, merchant_name, merchant_type, address, phone, route_eta, status, settlement_day, planned_weight, actual_weight, photo_count, before_basket_count, sent_basket_count, returned_basket_count, sign_method, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertTaskItem = sqlite.prepare(`INSERT OR IGNORE INTO task_items (id, task_id, product_id, spec_id, product_name, spec_label, unit_price, quantity, display_amount, display_unit, planned_weight, actual_weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertUser = sqlite.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)`);

// Users
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || '管理员';
if (adminUsername && adminPassword) {
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  insertUser.run('user_admin', adminUsername, passwordHash, adminDisplayName, 'admin');
}

// Merchants
insertMerchant.run('merchant_dongqiao', '东桥生活超市', '超市', '王老板', '', '东桥路示例地址', '每月 5 日', 1, 9);
insertMerchant.run('merchant_liuji', '刘记早餐摊', '小商贩', '刘师傅', '', '城南早市示例摊位', '每周日', 0.95, 4);
insertMerchant.run('merchant_lingshou', '散户零售', '散户', '', '', '门店现场自提', '当日结清', 1, 0);

// Products
insertProduct.run('prod_tofu', '豆腐', '豆腐类');
insertProduct.run('prod_black_tofu', '黑豆腐', '豆腐类');
insertProduct.run('prod_dry_tofu', '豆干', '豆干类');
insertProduct.run('prod_crispy_tofu', '脆皮豆腐', '豆腐类');

// Specs
insertSpec.run('spec_tofu_2', 'prod_tofu', '常规价 ¥2/斤', 2, 0);
insertSpec.run('spec_tofu_25', 'prod_tofu', '精品价 ¥2.5/斤', 2.5, 1);
insertSpec.run('spec_black_tofu_4', 'prod_black_tofu', '常规价 ¥4/斤', 4, 0);
insertSpec.run('spec_seasoned_dry_6', 'prod_dry_tofu', '调味 ¥6/斤', 6, 0);
insertSpec.run('spec_plain_dry_5', 'prod_dry_tofu', '未调味 ¥5/斤', 5, 1);
insertSpec.run('spec_crispy_tofu_6', 'prod_crispy_tofu', '常规价 ¥6/斤', 6, 0);

// Today's tasks
const today = '2026-05-08';

insertTask.run('task_dongqiao', today, 'merchant_dongqiao', '东桥生活超市', '超市', '东桥路示例地址', '', '07:10', '待复秤', '每月 5 日', 42, 0, 0, 8, 0, 0, '', adminDisplayName);
insertTaskItem.run('ti_1', 'task_dongqiao', 'prod_tofu', 'spec_tofu_25', '豆腐', '精品价 ¥2.5/斤', 2.5, 1, 20, '斤', 20, 0);
insertTaskItem.run('ti_2', 'task_dongqiao', 'prod_black_tofu', 'spec_black_tofu_4', '黑豆腐', '常规价 ¥4/斤', 4, 1, 10, '斤', 10, 0);
insertTaskItem.run('ti_3', 'task_dongqiao', 'prod_crispy_tofu', 'spec_crispy_tofu_6', '脆皮豆腐', '常规价 ¥6/斤', 6, 1, 12, '斤', 12, 0);

insertTask.run('task_liuji', today, 'merchant_liuji', '刘记早餐摊', '小商贩', '城南早市示例摊位', '', '07:30', '待配货', '每周日', 26, 0, 0, 4, 0, 0, '', adminDisplayName);
insertTaskItem.run('ti_4', 'task_liuji', 'prod_tofu', 'spec_tofu_2', '豆腐', '常规价 ¥2/斤', 2, 1, 1, '筐', 12, 0);
insertTaskItem.run('ti_5', 'task_liuji', 'prod_dry_tofu', 'spec_seasoned_dry_6', '豆干（调味）', '调味 ¥6/斤', 6, 1, 8, '斤', 8, 0);
insertTaskItem.run('ti_6', 'task_liuji', 'prod_dry_tofu', 'spec_plain_dry_5', '豆干（未调味）', '未调味 ¥5/斤', 5, 1, 6, '斤', 6, 0);

insertTask.run('task_lingshou', today, 'merchant_lingshou', '散户零售', '散户', '门店现场自提', '', '随到随卖', '待送达', '当日结清', 9, 9.2, 1, 0, 0, 0, '', adminDisplayName);
insertTaskItem.run('ti_7', 'task_lingshou', 'prod_tofu', 'spec_tofu_2', '豆腐', '常规价 ¥2/斤', 2, 1, 4, '斤', 4, 4.2);
insertTaskItem.run('ti_8', 'task_lingshou', 'prod_crispy_tofu', 'spec_crispy_tofu_6', '脆皮豆腐', '常规价 ¥6/斤', 6, 1, 5, '斤', 5, 5);

sqlite.close();
console.log('Seed data inserted successfully!');
