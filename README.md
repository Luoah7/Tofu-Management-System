# Doufu 豆腐配送管理系统

[中文](#中文说明) | [English](#english)

## 中文说明

Doufu 是一套面向豆制品配送场景的轻量业务系统，覆盖商户管理、商品管理、配送任务、移动端执行、结算单、小票和商户账单查询。它把早间配货、现场复秤、拍照留档、送达签收和后续结算放进同一条业务链里，减少表格切换和人工对账。

### 功能范围

- 移动端任务执行，支持复秤、拍照、送达确认和异常记录
- 移动端管理页，支持商户和商品的直接维护
- 后台管理页，覆盖商户、商品、任务、配货、结算和小票预览
- 商户公开账单页，查看配送记录、待结金额和已结金额
- 本地环境变量启动账号和品牌信息，敏感数据不进入 git

### 架构说明

整个项目采用前后端同仓的轻量架构。

前端部分位于 `src/`，使用 React、Vite、React Router、Ant Design、Ant Design Mobile 和 Lucide Icons。后台页和移动端共用一套数据接口，但根据使用场景拆成不同页面层，移动端优先保证首屏操作密度和触达效率。

后端部分位于 `server/`，使用 Hono 提供 HTTP API，认证基于 JWT，密码使用 bcrypt 哈希。业务入口在 `server/index.ts`，接口按商户、商品、任务、结算等领域拆分到 `server/routes/`。

数据层使用 SQLite 和 better-sqlite3，Schema 定义集中在 `server/db.ts`。项目没有引入独立数据库服务，适合单机部署、轻量私有化和本地演示。初始化时会根据环境变量自动补齐管理员账号。

配置层分成两部分。服务端敏感配置通过 `.env` 注入，包括管理员账号、JWT 密钥和数据库路径。前端公开展示信息通过 `VITE_BUSINESS_*` 注入，只用于品牌名、联系电话、地址等可公开字段。仓库只保留 `.env.example`，真实 `.env`、数据库文件和构建产物都被 git 忽略。

运行方式是 Vite 在开发时代理 `/api` 到 Node 服务，生产环境由 Node 服务同时提供 API 和构建后的静态资源。这样部署面简单，不需要额外反向代理也能跑通完整流程。

### 快速开始

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

### 环境变量

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

`ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 会在服务启动时用于创建或刷新管理员账号。`VITE_BUSINESS_*` 会进入前端构建结果，只能填写允许公开展示的信息。

### 开发命令

```bash
npm run dev
npm run typecheck
npm run build
npm run seed
```

### 部署说明

生产环境必须提供 `JWT_SECRET`。服务端在 `NODE_ENV=production` 时如果拿不到该变量会直接拒绝启动。

```bash
npm run build
npm run start
```

项目默认把数据库放在 `data/` 目录下，该目录不会进入 git。

### 版本记录

#### v0.3.0

- 移动端任务流重构为 `待配货 → 待复秤 → 待送达 → 已完成`
- 复秤与拍照合并为一步，支持秤面照片识别重量
- 送达阶段支持再次拍照留档，异常记录优先于筐子录入
- 批量导入支持更接近真实微信口语的订货表达
- 首页与任务页移动端布局重做，首屏操作更直接
- 浏览器标签页标题改为跟随品牌变量

#### v0.2.0

- 补齐移动端管理页中的商户管理和商品管理入口
- 新增移动端手动补录、批量导入、任务预览确认
- 增加任务删除、日期筛选、商户筛选和收入指标
- 引入 R2 上传支持与本地部署文档

#### v0.1.0

- 初始化豆腐配送管理系统基础架构
- 提供商户、商品、任务、结算和小票的基本能力
- 提供 React + Hono + SQLite 的单仓部署方案

## English

Doufu is a lightweight operations system for tofu and fresh soy product distribution. It covers merchant management, product management, delivery tasks, mobile execution, settlement, receipt printing, and merchant bill lookup in one compact workflow.

### Scope

- Mobile task execution for weighing, photo logging, delivery confirmation, and exception reporting
- Mobile management screens for merchants and products
- Admin workspace for merchants, products, tasks, allocation, settlement, and receipt preview
- Public merchant bill page for delivery history and settlement visibility
- Environment-based bootstrap for admin credentials and business profile without exposing secrets in git

### Architecture

The project uses a monorepo-style single workspace with a compact full-stack setup.

The frontend lives in `src/` and is built with React, Vite, React Router, Ant Design, Ant Design Mobile, and Lucide Icons. Admin screens and mobile screens share the same API layer, while the UI is split by operational context rather than by codebase.

The backend lives in `server/` and uses Hono for HTTP APIs, JWT for authentication, and bcrypt for password hashing. The application entry is `server/index.ts`, and domain routes are split across `server/routes/` for merchants, products, tasks, and settlements.

The data layer uses SQLite with better-sqlite3. Schema definitions are centralized in `server/db.ts`. This keeps the deployment footprint small and makes the system suitable for local use, small private installations, and demos. On initialization, the server can create or refresh the admin account from environment variables.

Configuration is split into private server config and public frontend config. Sensitive values such as admin credentials, JWT secrets, and database paths are loaded from `.env`. Public-facing business fields are injected through `VITE_BUSINESS_*` and are compiled into the frontend bundle. The repository only includes `.env.example`; real `.env` files, database files, and build artifacts are ignored by git.

In development, Vite proxies `/api` requests to the Node server. In production, the Node server serves both API endpoints and the built frontend assets. This keeps deployment straightforward and reduces infrastructure overhead.

### Quick Start

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

### Environment Variables

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

`ADMIN_USERNAME` and `ADMIN_PASSWORD` are used to create or refresh the admin user when the server starts. `VITE_BUSINESS_*` values are compiled into the frontend bundle and should only contain information that is safe to display publicly.

### Development

```bash
npm run dev
npm run typecheck
npm run build
npm run seed
```

### Deployment

Production requires `JWT_SECRET`. The server intentionally refuses to start without it when `NODE_ENV=production`.

```bash
npm run build
npm run start
```

By default, the database is stored under `data/`, which is ignored by git.

### Version History

#### v0.3.0

- Refactored the mobile task flow into `Pending Allocation → Pending Weigh → Pending Delivery → Completed`
- Merged weighing and photo logging into one step, with scale photo weight recognition
- Added delivery-stage photo archiving and prioritized exception handling over basket entry
- Improved bulk import to support more natural WeChat-style order phrases
- Refreshed the mobile home and task screens for faster first-screen actions
- Synced the browser tab title with the business profile variable

#### v0.2.0

- Completed mobile management entry points for merchants and products
- Added manual entry, bulk import, and preview confirmation on mobile
- Added task deletion, date filtering, merchant filtering, and revenue metrics
- Added R2 upload support and deployment documentation

#### v0.1.0

- Initial project structure for the tofu delivery management system
- Delivered baseline flows for merchants, products, tasks, settlement, and receipts
- Set up a single-repo deployment model with React, Hono, and SQLite

## License

MIT
