# sour-lemon-backend

API for the Sour Lemon site. Node + Express + TypeScript + PostgreSQL/Sequelize.

## Commands

- `npm run dev` — start the dev server with Nodemon watch mode
- `npm run build` — type-check and compile to `dist/`
- `npm start` — run the compiled server from `dist/`
- `npm run lint` — run ESLint

## Environment

Copy `.env.example` to `.env` and adjust as needed. `PORT` defaults to `4000`.

Create the PostgreSQL database before starting the API:

```sql
CREATE DATABASE sour_lemon;
```

You can connect with either `DATABASE_URL` or the individual `DB_HOST`,
`DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables. `DATABASE_URL`
takes precedence when both are supplied. The API verifies the connection before
it starts listening and closes the connection gracefully on shutdown.

Import the shared `sequelize` instance from `src/config/database.ts` when adding
models. Schema synchronization is intentionally not run automatically; use
migrations once models are introduced so schema changes remain reviewable.

## Database migrations

This project uses the official Sequelize CLI migration workflow. Migrations are
stored in `src/database/migrations`, seeders in `src/database/seeders`, and
execution history in PostgreSQL's `SequelizeMeta` and `SequelizeData` tables.

1. Copy `.env.example` to `.env` and configure `DATABASE_URL` or the `DB_*`
   variables.
2. Create the PostgreSQL database if it does not exist:

   ```bash
   npm run db:create
   ```

3. Review pending and completed migrations:

   ```bash
   npm run db:migrate:status
   ```

4. Apply every pending schema migration:

   ```bash
   npm run db:migrate
   ```

5. Insert the initial sections, cake categories, and application settings:

   ```bash
   npm run db:seed
   ```

Use `npm run db:migrate:undo` to revert only the latest migration. Use
`npm run db:migrate:undo:all` only for a disposable database because it removes
the entire application schema. Undo seed data with `npm run db:seed:undo`.

Generate future migration skeletons with:

```bash
npm exec sequelize-cli -- migration:generate --name describe-the-change
```

Always edit and review the generated `up` and `down` functions. Never use
`sequelize.sync({ alter: true })` as a replacement for migrations.

## Authentication API

Configure `JWT_SECRET`, `JWT_EXPIRES_IN`, and `BCRYPT_SALT_ROUNDS` before
starting the API. Phone numbers use E.164 format, such as `+233201234567`.

- `POST /api/auth/signup` - create a customer with `name`, `phoneNumber`,
  `password`, optional `whatsappNumber`, and a required `deliveryAddress` object.
  The address requires `addressLine1` and `city`; `addressLine2` and `landmark`
  are optional. It is saved as the customer's default address.
- `POST /api/auth/signin` - authenticate with `phoneNumber` and `password`.
- `PATCH /api/users/me` - update the authenticated customer's contact data or
  password. Password changes require `currentPassword` and `newPassword`.
- `DELETE /api/users/me` - soft-delete the authenticated account and its saved
  addresses/sessions; the request body must contain `password`.
- `GET /api/users?page=1&limit=25` - list users; restricted to administrators.

Protected routes require `Authorization: Bearer <token>`. Sign-up never accepts
an admin role; the initial administrator must be created through trusted seed or
deployment tooling.

## Journal API

Public reads:

- `GET /api/journal/categories`
- `GET /api/journal/posts?page=1&limit=12&category=recipes`
- `GET /api/journal/posts/:slug`

Administrator management:

- `GET /api/journal/admin/categories`
- `POST /api/journal/categories`
- `PATCH|DELETE /api/journal/categories/:categoryId`
- `GET /api/journal/admin/posts` and `GET /api/journal/admin/posts/:postId`
- `POST /api/journal/posts` and `PATCH|DELETE /api/journal/posts/:postId`
- `POST /api/journal/posts/:postId/schedule|publish|archive`
- `POST /api/journal/posts/:postId/images` using multipart fields `file`, `role`,
  `altText`, optional `caption`, and optional `sortOrder`
- `PATCH /api/journal/posts/:postId/images/reorder`
- `DELETE /api/journal/posts/:postId/images/:imageId`

Journal uploads accept JPEG, PNG, and WebP images up to
`JOURNAL_IMAGE_MAX_BYTES`. Configure `AWS_REGION`, `AWS_S3_BUCKET`, and
`AWS_S3_PUBLIC_BASE_URL`. The application uses the AWS SDK credential provider
chain; do not commit access keys. Keep the bucket private and use a CloudFront
distribution or equivalent public CDN URL for customer-facing images.
