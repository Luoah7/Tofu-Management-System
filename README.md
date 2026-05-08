# Doufu

Doufu is an operations platform for fresh tofu distribution. It brings order fulfillment, mobile delivery execution, settlement, receipt printing, merchant billing, and lightweight back-office management into one focused workflow.

The product is designed for small teams that need to move fast in the morning rush, keep delivery records clean, and close settlement without spreadsheet drift.

## What It Covers

- Mobile-first delivery workspace for weighing, photographing, delivery confirmation, and exception handling.
- Admin workspace for merchants, products, daily tasks, allocation records, settlement, and thermal receipts.
- Public merchant bill view for transparent delivery history and pending settlement amounts.
- SQLite-backed local deployment with a simple Node server and React frontend.
- Environment-based bootstrap for admin account and business profile, so secrets and private contact data stay outside git.

## Architecture

Doufu keeps the stack intentionally compact. The frontend is built with React, Vite, Ant Design, Ant Design Mobile, and Lucide icons. The backend uses Hono, better-sqlite3, Drizzle schema definitions, JWT authentication, and bcrypt password hashing.

Runtime configuration is loaded from environment variables. The repository only ships `.env.example`; real `.env` files, database files, and build output are ignored by git.

## Quick Start

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

Before running in production, fill `.env` with your own `JWT_SECRET`, admin account, database path, and public business profile. Do not commit `.env`.

## Environment

```bash
PORT=3000
DB_PATH=./data/doufu.db
JWT_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_DISPLAY_NAME=
ADMIN_ROLE=admin
VITE_BUSINESS_NAME=
VITE_BUSINESS_PHONE=
VITE_BUSINESS_ADDRESS=
```

`ADMIN_USERNAME` and `ADMIN_PASSWORD` are used to create or refresh the admin user when the server initializes. `VITE_BUSINESS_*` values are public-facing display fields and are compiled into the frontend, so only place information there that is safe to show to users.

## Development

```bash
npm run dev
npm run typecheck
npm run build
```

The default database location is under `data/`, which is ignored by git. Use `npm run seed` to create demo operational data for local development.

## Deployment Notes

Set production environment variables on the server or hosting platform instead of committing configuration files. A production deployment must provide `JWT_SECRET`; the server intentionally refuses to start without it when `NODE_ENV=production`.

The app can be deployed as a Node service serving the API and static frontend assets. Build the client with `npm run build`, then start the server with `npm run start`.

## License

MIT
