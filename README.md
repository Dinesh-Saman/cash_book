# Cash Book Management System (Kassenbuch)

A full-featured, cloud-ready **Cash Book Management System** for Mr. Ambikapathy.

## Quick Start

### Prerequisites
- **Node.js** v18+
- **MongoDB** running locally on port 27017 (or update `MONGODB_URI` in `backend/.env`)

### 1. Start the Backend
```powershell
cd d:\Uvexzon\Cash_Book_Management_System\backend
npm install          # already done
npm run dev          # starts on http://localhost:5000
```

On first startup, the database is automatically seeded with:
- **Admin user**: `admin@cashbook.com` / `Admin@1234`
- **14 default Booking Rules** (as per SRS)
- **Default settings** (opening balance = 0)

### 2. Start the Frontend
```powershell
cd d:\Uvexzon\Cash_Book_Management_System\frontend
npm install          # already done
npm run dev          # starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Login Credentials (Default)

| Role | Email | Password |
|---|---|---|
| Administrator | admin@cashbook.com | Admin@1234 |

---

## Features Implemented (per SRS v1.5)

| SRS Section | Feature | Status |
|---|---|---|
| 4.1 | Cash book table (all 10 columns) | ✅ |
| 4.1 | Live summary bar (balance, income, expenses) | ✅ |
| 4.2 | Opening balance setup | ✅ |
| 4.3 | Balance validation + SRS error message | ✅ |
| 4.4.1 | Add/Edit Expense form | ✅ |
| 4.4.2 | Add/Edit Income form | ✅ |
| 4.4.3 | VAT 0% / 7% / 19% | ✅ |
| 4.4.4 | 14 default Booking Rules + Add New | ✅ |
| 4.4.5 | Document upload (PDF/JPG/PNG) + viewer | ✅ |
| 4.7 | Monthly cash book listing | ✅ |
| 4.8 | Annual report with bar chart | ✅ |
| 4.9 | Delete with confirmation + balance recalc | ✅ |
| 4.10 | Historical date entries + chronological recalc | ✅ |
| 4.11A | XML export (monthly/yearly) | ✅ |
| 4.11B | DATEV export (EXTF_ CSV format) | ✅ |
| 4.11C | PDF export | ✅ |
| 4.11D | Excel export | ✅ |
| 5 | User roles (Admin/Accountant/Viewer) | ✅ |
| 6 | Audit log with action tracking | ✅ |
| 7 | Entry editing with balance recalculation | ✅ |
| — | German language UI throughout | ✅ |

---

## Project Structure

```
Cash_Book_Management_System/
├── backend/
│   ├── src/
│   │   ├── models/          # MongoDB Mongoose models
│   │   ├── routes/          # Express API routes
│   │   ├── services/        # Balance, Export, Audit services
│   │   ├── middleware/       # JWT auth + error handler
│   │   ├── seeder.ts        # DB seeder (runs on first startup)
│   │   ├── app.ts           # Express app
│   │   └── server.ts        # Server entry point
│   ├── uploads/             # Uploaded documents (auto-created)
│   ├── .env                 # Environment config
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # All pages (Login, CashBook, Reports, Admin, Settings)
│   │   ├── components/      # Reusable components
│   │   ├── store/           # Zustand state stores
│   │   ├── lib/             # API client, utilities
│   │   └── types/           # TypeScript types
│   └── package.json
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET | /api/entries | List entries (filter by year/month) |
| POST | /api/entries | Create entry (multipart) |
| PUT | /api/entries/:id | Edit entry |
| DELETE | /api/entries/:id | Soft delete entry |
| GET | /api/entries/summary | Live balance summary |
| GET | /api/booking-rules | List booking rules |
| POST | /api/booking-rules | Add booking rule |
| GET | /api/settings | Get settings |
| PUT | /api/settings | Update settings |
| GET | /api/reports/monthly | Monthly report |
| GET | /api/reports/annual | Annual report |
| GET | /api/exports/pdf | Download PDF |
| GET | /api/exports/excel | Download Excel |
| GET | /api/exports/xml | Download XML |
| GET | /api/exports/datev | Download DATEV CSV |
| GET | /api/users | List users (admin) |
| POST | /api/users | Create user (admin) |
| GET | /api/audit | Audit log (admin) |
| GET | /api/documents/:filename | View uploaded document |
