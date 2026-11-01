# Blood Donation & Request Matching System

A full-stack database management system mini project developed to support blood donation recording, compatible donor discovery, hospital blood inventory management, and blood request fulfilment.

## Project Team

| Name | SRN |
|---|---|
| Yashas Sadananda | PES2UG24CS610 |
| Yashwantha R | PES2UG24CS614 |

**Section:** J  
**Institution:** PES University  
**Programme:** B.Tech – Computer Science and Engineering  
**Academic Session:** August–December 2026

## Overview

The application connects donors, hospitals, blood-requesting organizations, and administrators through a role-based web interface. It uses MySQL for core relational records and MongoDB for supporting location, donation-history, and notification documents.

The backend exposes REST APIs used by the React frontend. A transactional outbox is used to record cross-database synchronization and notification work durably, so events can be processed and retried.

## Features

- Role-based registration and authentication for donors, hospitals, organizations, and administrators.
- Donor profile and availability management.
- ABO/Rh blood-group compatibility matching.
- Optional geospatial donor ranking using saved donor locations and requester coordinates.
- Donation submission, review, approval, and rejection.
- Hospital inventory credit when an associated donation is approved.
- Blood request creation, tracking, and hospital fulfilment.
- Inventory deduction during request fulfilment.
- Notifications for relevant request and donation events.
- Administrative dashboard and integration/outbox monitoring.

> **Clinical note:** Matching results are informational. Actual donor eligibility and transfusion compatibility must be established through appropriate clinical screening. The current matching response provides a proximity rank when coordinates are supplied; it does not report a distance in kilometres.

## Technology Stack

### Frontend
- React
- React Router
- Vite
- Tailwind CSS
- Lucide React

### Backend
- Node.js
- Express
- MySQL2
- MongoDB Node.js driver
- JSON Web Tokens (JWT)
- bcryptjs
- Helmet and CORS

### Databases
- **MySQL:** users, donors, blood groups, donations, hospitals, organizations, blood requests, inventory, and integration outbox records.
- **MongoDB:** `DonorLocation`, `DonationHistory`, and `Notifications` collections.

## Repository Structure

```text
blood-donation-request-matching-system/
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
│   │   └── unit/
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   └── services/
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 20 or later
- npm
- MySQL 8
- MongoDB Community Server

The application expects the MySQL and MongoDB databases to be available and configured locally. Database credentials and application secrets must be supplied through local environment files.

## Local Development

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

Edit `backend/.env` and set the local MySQL connection details, MongoDB URI/database, client URL, and a strong unique `JWT_SECRET`. The example values are placeholders; do not use them as production credentials.

Start the backend:

```powershell
npm run dev
```

The backend development server uses `http://localhost:5000` by default. Its health endpoint is:

```text
http://localhost:5000/api/health
```

### 3. Configure and start the frontend

Open a second terminal from the repository root:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Set `VITE_API_BASE_URL` in `frontend/.env` to the backend API base URL (default: `http://localhost:5000/api`). Then start Vite:

```powershell
npm run dev
```

The frontend is served at `http://localhost:5173` by default.

### 4. Database setup

Start MySQL and MongoDB before starting the application. Configure the database names and credentials in `backend/.env`. Review the backend migration scripts and the accompanying database documentation before applying migrations to an existing database. Back up existing data before running schema changes.

A one-time administrator account can be provisioned with the backend bootstrap script after the required `ADMIN_*` variables are configured in the local backend environment:

```powershell
npm run bootstrap:admin
```

Do not commit local `.env` files, credentials, database dumps, or backup archives.

## Testing and Build

Run the backend unit tests from the `backend` directory:

```powershell
npm test
```

Build the frontend from the `frontend` directory:

```powershell
npm run build
```

The backend also contains a database integration test command (`npm run test:db`). It operates against configured databases; use an isolated test database and review its fixture/cleanup behavior before running it. Do not run it against a database containing important project data.

## Data and Security Notes

- Local environment files (`.env`) are excluded from version control.
- `.env.example` files contain configuration placeholders only.
- `node_modules`, frontend build output, logs, and database backups are excluded from version control.
- Passwords are stored as hashes by the application; never publish account credentials or tokens.
- The API enforces role-based access and ownership checks for the tested donor and hospital workflows.
- MySQL and MongoDB do not share a distributed ACID transaction. The outbox records work in MySQL and supports durable, retryable delivery to MongoDB.

## Academic Context

This repository accompanies the DBMS mini project report for the August–December 2026 semester at PES University.
