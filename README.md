# Blood Donation & Request Matching System

A full-stack DBMS project for donor discovery, blood donation workflows, hospital inventory management, and blood-request fulfilment. Developed for the fifth-semester DBMS project at PES University.

## Project team

| Student | SRN |
|---|---|
| Yashas Sadananda | PES2UG24CS610 |
| Yashwantha R | PES2UG24CS614 |

**Course:** UE24CSS351A – DBMS Project  
**Section:** J  
**Academic session:** August–December 2026

## Overview

The application coordinates donors, hospitals, blood-requesting organizations, and administrators through role-based workspaces. MySQL is the authoritative store for transactional relational data. MongoDB supports donor location documents, donation-history mirrors, and notifications. An Express API validates requests, enforces authentication and ownership rules, and coordinates database operations.

The primary web interface is implemented with Next.js. A Vite-based React frontend is retained in `frontend/` as the earlier/alternate client.

> **Clinical limitation:** Matching results are informational only. The application does not perform laboratory cross-matching or determine clinical eligibility. Actual donor eligibility and transfusion compatibility must be established through appropriate professional screening. When coordinates are supplied, the matching API returns a proximity rank, not a distance in kilometres.

## Main capabilities

- Registration and authentication for Donor, Hospital, Organization, and Admin roles.
- Role- and ownership-scoped API access.
- Donor profiles, availability, and optional location records.
- ABO/Rh blood-group compatibility matching.
- Optional geospatial donor ranking using MongoDB GeoJSON and a `2dsphere` index.
- Donation submission, review, approval, and rejection.
- Transactional inventory credit when an associated donation is approved.
- Blood-request creation, status tracking, and hospital fulfilment.
- Inventory validation and deduction during request fulfilment.
- Notifications and MySQL-to-MongoDB synchronization through a transactional outbox with retry handling.
- Administrative dashboards and integration monitoring.
- An administrator SQL Playground connected to a separate, restricted database (`BloodDonationPlayground`), not the production project database.

## Technology

| Layer | Technologies |
|---|---|
| Main web interface | Next.js 16, React 19 |
| Alternate/legacy web interface | React, Vite, React Router, Tailwind CSS |
| Backend | Node.js 20, Express |
| Relational database | MySQL 8 / InnoDB |
| Document database | MongoDB |
| Authentication | JWT, bcryptjs |
| Database access | `mysql2`, MongoDB Node.js driver |
| Testing | Node.js test runner; database integration tests |

## Repository layout

```text
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── migrations/
│   │   ├── routes/
│   │   ├── scripts/
│   │   └── services/
│   ├── test/
│   ├── .env.example
│   └── package.json
├── database/
│   ├── schema.sql
│   ├── schema.test.sql
│   └── playground-schema.sql
├── frontend-next/       # Main Next.js application
├── frontend/            # Alternate/earlier Vite React client
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 20.19.x or a compatible supported Node.js 20+ release.
- npm.
- MySQL 8.0.16 or later.
- MongoDB Community Server or a compatible MongoDB deployment.

Start MySQL and MongoDB before starting the backend. Keep credentials and secrets in local environment files; never commit them.

## Local setup

Run commands from the repository root unless a step says otherwise.

### 1. Clone the repository

```powershell
git clone https://github.com/yxshas565/blood-donation-request-matching-system.git
cd blood-donation-request-matching-system
```

### 2. Configure and start the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` with local values for the MySQL connection, MongoDB URI/database, client origin, and a strong unique `JWT_SECRET`. Use the variable names and comments in `.env.example` as the configuration reference. Configure `ADMIN_*` values only when using the one-time administrator bootstrap command.

For a **new, empty database**, create the baseline schema using `database/schema.sql` from a MySQL client. Then return to the backend directory and apply the application's migrations after configuring and verifying database backups:

```powershell
npm run backup:databases
npm run migrate
```

The migration runner requires a verified MySQL and MongoDB backup before changing an existing database. Do not rerun `database/schema.sql` against an already populated project database. `database/schema.test.sql` is for an isolated test database. `database/playground-schema.sql` is for the isolated SQL Playground database.

Start the API:

```powershell
npm run dev
```

The backend listens on port `5000` in the local development setup. Check:

```text
http://127.0.0.1:5000/api/health
http://127.0.0.1:5000/api/health/db
```

### 3. Configure and start the main Next.js frontend

Open a second terminal at the repository root:

```powershell
cd frontend-next
npm install
```

Create `frontend-next/.env.local` with the backend API base URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000/api
```

Start the main web application:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

The browser communicates with the Express API. MySQL and MongoDB credentials remain on the backend and are never placed in browser code.

### 4. Optional Vite frontend

The earlier React/Vite client is retained in `frontend/`. To run it instead, configure its `.env` using the `VITE_API_BASE_URL` setting described in `frontend/.env.example`, then run:

```powershell
cd frontend
npm install
npm run dev
```

The Vite client normally runs at `http://localhost:5173`. Use the Next.js application at port `3000` as the primary frontend for the current project setup.

## Database design and advanced concepts

The original relational baseline contains `User`, `BloodGroup`, `Donor`, `Donation`, `Hospital`, `Organization`, `BloodRequest`, and `BloodInventory`. Additive migrations connect Hospital and Organization profiles to authenticated User accounts, associate donations with a receiving hospital, create the `IntegrationOutbox`, and maintain donor last-donation dates.

The database implementation includes:

- Primary keys, foreign keys, unique constraints, a request-owner `CHECK` constraint, and composite indexes.
- Three views: `vw_AvailableDonors`, `vw_HospitalInventorySummary`, and `vw_PendingBloodRequests`.
- Stored procedure: `sp_FindCompatibleDonors`.
- Stored function: `fn_ApprovedDonationCount`.
- Donation insert/update triggers that recalculate the latest approved donation date.
- Transactions and row locking for donation approval and inventory credit, and for request fulfilment and inventory deduction.
- A transactional outbox for durable, retryable MySQL-to-MongoDB event delivery.

`IntegrationOutbox` intentionally supports different aggregate types and is not represented as a conventional foreign-key child of one business table.

## SQL Playground safety

The SQL Playground is intended for controlled database exercises. It connects to the separate `BloodDonationPlayground` database through a restricted MySQL account. It must not be configured with the main `BloodDonationDB` credentials. Do not use it to execute DDL or DML against the project database.

## Testing and production builds

### Backend unit tests

From `backend/`:

```powershell
npm test
```

The recorded verification run passed **21/21 unit tests**.

### Backend database integration tests

From `backend/`:

```powershell
npm run test:db
```

Run this only with the isolated test configuration and test databases. The recorded verification run passed **7/7 integration tests**. Do not point integration tests at the main `BloodDonationDB` or production MongoDB database. The test setup uses temporary environment overrides and fixture-mutation permission; follow the test script and team setup notes before running it.

### Main frontend production build

From `frontend-next/`:

```powershell
npm run build
```

The Next.js production build completed successfully during final verification.

### Useful backend commands

Run these from `backend/`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start backend development server |
| `npm start` | Start backend server |
| `npm test` | Run backend unit tests |
| `npm run test:db` | Run database integration tests against isolated test databases only |
| `npm run backup:databases` | Create MySQL and MongoDB backups |
| `npm run migrate` | Apply pending migrations after verified backups |
| `npm run reconcile:donations` | Reconcile donation-history mirrors |
| `npm run bootstrap:admin` | Provision an administrator using configured `ADMIN_*` values |

## Security and data handling

- `.env` and `.env.*` files are excluded from version control; `.env.example` files contain placeholders only.
- Never commit database passwords, JWT secrets, tokens, database dumps, backup archives, or real donor/patient data.
- Use synthetic data for demonstrations and screenshots.
- Passwords are hashed by the backend using bcryptjs.
- The API, not the browser, enforces role permissions and record ownership.
- MySQL and MongoDB do not share one distributed ACID transaction. The outbox pattern persists synchronization events with MySQL changes and supports retryable delivery to MongoDB.
- Use local/test databases for demonstrations and automated tests.

## Verification snapshot

The project verification recorded:

- 21/21 backend unit tests passing.
- 7/7 backend integration tests passing with isolated test databases.
- MySQL and MongoDB health checks successful.
- Next.js production build successful.
- Manual role-based application workflows exercised for Admin, Hospital, Organization, and Donor roles.

These results describe the recorded local verification run; they are not a claim that the repository's current GitHub default branch already contains every local change.

## Project report

The accompanying final report is maintained separately as:

- `Blood_Donation_Request_Matching_System_Final_Report_Updated.docx`
- `Blood_Donation_Request_Matching_System_Final_Report_Updated.pdf`

Copy the final approved report into the repository's submission/documentation folder before publishing the final repository, if the course submission requires the report to be versioned with the code.

## References

- [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/)
- [MongoDB Manual](https://www.mongodb.com/docs/manual/)
- [Node.js Documentation](https://nodejs.org/docs/latest/api/)
- [Express Documentation](https://expressjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/learn)
- [Vite Guide](https://vite.dev/guide/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Academic context

PES University · B.Tech in Computer Science and Engineering · UE24CSS351A · Section J · August–December 2026
