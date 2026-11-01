# Backend – Blood Donation & Request Matching System

Express REST API for the Blood Donation & Request Matching System. The backend coordinates authentication, donor discovery, donation review, hospital inventory, blood requests, notifications, and MySQL–MongoDB synchronization.

## Stack

- Node.js 20+
- Express 5
- MySQL 8 with `mysql2`
- MongoDB Node.js driver
- JWT authentication and `bcryptjs`
- `dotenv`, `express-validator`, Helmet, and CORS

## Setup

1. Start the MySQL and MongoDB services.
2. Ensure the `BloodDonationDB` databases and the eight original relational tables from the project ER-to-relational design are created. The additive migration scripts in this repository extend that submitted core schema; they are not a replacement for the original Lab 4 DDL.
3. From this directory, install dependencies and create a local environment file:

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

4. Edit `.env` with your local database credentials and a strong, unique `JWT_SECRET` (at least 32 characters). Do not commit `.env` or share credentials.
5. Run the migrations only after taking and verifying a backup of existing databases:

   ```powershell
   npm run backup:databases
   npm run migrate
   ```

6. Start the API:

   ```powershell
   npm run dev
   ```

The default API address is `http://localhost:5000`; health check: `GET /api/health`.

## Environment variables

See `.env.example` for the supported configuration keys:

- `PORT`, `CLIENT_URL`
- `JWT_SECRET`
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `MONGODB_URI`, `MONGODB_DATABASE`
- Optional one-time administrator bootstrap values: `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_PASSWORD`

All actual credentials belong in the local `.env` file, which is excluded from Git.

## Main modules

```text
src/
├── config/        MySQL, MongoDB, and environment validation
├── controllers/   Authentication controller
├── middleware/    JWT authorization and rate limiting
├── migrations/    Additive schema migrations and migration runner
├── routes/        Authentication and application API routes
├── scripts/       Backup, admin bootstrap, and donation-history reconciliation
└── services/      Access policies, dates, domain matching, and outbox delivery
```

## API capabilities

- Registration, login, and authenticated account lookup.
- Donor profile, availability, and location management.
- ABO/Rh-compatible donor matching, with optional MongoDB geospatial proximity ranking.
- Donation submission, hospital/admin review, and inventory credit on approval.
- Hospital/organization blood-request management and hospital request fulfilment.
- Notifications and administrator overview/integration monitoring.

The API enforces role and ownership checks. Matching is informational only; actual donor eligibility and transfusion decisions require appropriate clinical screening. When coordinates are supplied, the matching result returns a proximity rank, not a kilometre distance.

## Database responsibilities and synchronization

**MySQL** is authoritative for users, donors, blood groups, donations, hospitals, organizations, blood requests, inventory, and the integration outbox.

**MongoDB** stores the `DonorLocation`, `DonationHistory`, and `Notifications` collections. Geospatial donor lookup uses a `2dsphere` index on the donor location field.

The two databases do not participate in one distributed ACID transaction. MySQL transactions persist outbox events alongside the relevant relational changes. The worker delivers those events to MongoDB and supports retryable, idempotent processing.

## Commands

Run from the backend directory:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server with nodemon |
| `npm start` | Start the API server |
| `npm test` | Run the isolated Node.js unit test suite |
| `npm run test:db` | Run database integration tests; use only with an isolated test database after reviewing fixture/cleanup behaviour |
| `npm run backup:databases` | Create MySQL and MongoDB backups |
| `npm run migrate` | Apply pending migrations; back up first |
| `npm run reconcile:donations` | Reconcile MySQL donation records with MongoDB history |
| `npm run bootstrap:admin` | Provision an administrator using the optional `ADMIN_*` environment values |

Do not run database integration tests or migrations against a database containing important data unless the backup and test isolation requirements have been addressed.

## Tests

`npm test` uses Node's built-in test runner for access-policy, date handling, migration safety, outbox delivery/idempotency, and security validation tests. The project verification run completed with 21 unit tests passing. The frontend production build and live application workflows were also verified during project testing.

## Team

- Yashas Sadananda — PES2UG24CS610
- Yashwantha R — PES2UG24CS614

PES University · B.Tech Computer Science and Engineering · Section J · August–December 2026
