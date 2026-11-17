# Library Issue and Service Request System

**Department of Computer Science**  
**Aligarh Muslim University, Aligarh - 202002**  
**M.C.A Semester – III | Session: 2026–27**  
**Course Code:** CAMS-3P01 (Mini Project)  
**Author:** Prince Kaushal  
**Faculty No:** `25CAMSA123` | **Enrollment No:** `Gr0683`

---

## 📖 Project Overview

The **Library Issue and Service Request System** is a full-stack, three-tier web application built to streamline academic library circulation, digital service request workflows, and fine administration for university libraries.

It centralizes circulation records, transparently calculates overdue penalties according to configurable library policies, enables students and faculty to track reservations and loan renewals in real time, and provides comprehensive operational reports for library staff.

---

## 🛠️ Technology Stack (SRS Section 4.1)

| Layer | Technology | Justification |
| :--- | :--- | :--- |
| **Presentation Tier** | HTML5, CSS3, JavaScript, EJS, Bootstrap 5, Bootstrap Icons, Chart.js | Responsive web interface, server-rendered views, interactive analytics |
| **Logic Tier** | Node.js, Express.js | Modular routing, middleware, RESTful controllers, session management |
| **Data Tier** | MongoDB, Mongoose | Document-oriented storage, schema validation, relationship modeling |
| **Authentication** | `express-session`, `bcryptjs` | Role-based authorization (`PATRON` vs `STAFF`), salted password hashing |
| **Reporting & Export** | CSV Export, Print View Stylesheet | Real-time audits of circulation, overdue loans, and financial fines |

---

## 🚀 Requirement Traceability (FR-001 to FR-010)

| Requirement ID | Module / Feature | Description |
| :--- | :--- | :--- |
| **FR-001** | User Registration & Role Login | Secure authentication for Patrons and Staff with role-based routing and bcrypt password hashing. |
| **FR-002** | Catalog Search & Browsing | Real-time search across titles, authors, categories, ISBNs, and stock availability tracking. |
| **FR-003** | Centralized Book Issue & Return | Staff issue interface enforcing borrowing rules (max books) and automated due date assignment; return interface with inventory restocking. |
| **FR-004** | Service Request Submission | Patron interface for 4 request categories: **Reservation**, **Loan Renewal**, **Complaint**, and **New Title Suggestion**. |
| **FR-005** | Request Validation & Management | Staff approval workflow: validates borrowing limits, checks duplicate holds, automatically extends due date on renewal approval, and records staff remarks. |
| **FR-006** | Real-Time Request Tracking | Patron portal tracking request lifecycle (`PENDING` &rarr; `APPROVED` &rarr; `RESOLVED` / `REJECTED`). |
| **FR-007** | Automated Fine Calculation | Overdue calculation based on `(days late × configurable daily rate)`. Fines ledger supporting `PAID`, `PENDING`, and `WAIVED` statuses. |
| **FR-008** | In-App Notifications | Automated alerts for upcoming due dates (within 3 days), overdue loans, and service request decision events. |
| **FR-009** | Staff Operations Dashboard | Administrative control center with operational KPIs, recent activity tables, and visual Chart.js analytics. |
| **FR-010** | Comprehensive Reporting | Tabular reports and downloadable CSV exports for Active Loans, Overdue Audits, Fine Collections, and Request Statistics. |

---

## 🔑 Default Login Credentials

A rich seed dataset is included. You can log in using either account below or use the one-click demo buttons on the login page:

### 1. Library Staff / Admin
- **Email:** `staff@amu.ac.in`
- **Password:** `staff123`
- **Role:** `STAFF` (Full administrative, circulation, fine, and reporting access)

### 2. Patron (Student)
- **Email:** `student@amu.ac.in`
- **Password:** `student123`
- **Name:** Prince Kaushal (`25CAMSA123` / `Gr0683`)
- **Role:** `PATRON` (Catalog browsing, active loans, request submission, notifications)

### 3. Patron (Faculty)
- **Email:** `tariq@amu.ac.in`
- **Password:** `patron123`
- **Role:** `PATRON`

---

## 💻 Installation & Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (Community Server running on `localhost:27017` or MongoDB Atlas URI)

### Step 1: Install Dependencies
Open a terminal in the project directory and run:
```bash
npm install
```

### Step 2: Configure Environment Variables
Verify or edit `.env` (a ready-to-run `.env` is already configured):
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/library_system
SESSION_SECRET=amu_library_mca_secret_key_2026_amu_cs
NODE_ENV=development
MAX_BOOKS_PER_PATRON=3
LOAN_PERIOD_DAYS=14
FINE_RATE_PER_DAY=5
```

### Step 3: Populate Database with Seed Data
Run the database seed script to initialize books, accounts, active loans, and service requests:
```bash
npm run seed
```

### Step 4: Launch Application Server
Start the Express application:
```bash
npm start
```
Or with auto-restart on changes:
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📁 Project Directory Structure

```
library-management-system/
├── config/
│   ├── db.js                 # MongoDB connection handler
│   └── settings.js           # Default configurations
├── controllers/
│   ├── authController.js     # Login, registration, session management
│   ├── catalogController.js  # Book catalog, filtering, and detail views
│   ├── patronController.js   # Patron dashboard, request submission, my loans
│   ├── staffController.js    # Issue/return, request review, fines, inventory
│   └── reportController.js   # Audit reports and CSV export generation
├── middleware/
│   ├── auth.js               # Route authentication and role authorization
│   └── notifications.js      # Auto due-date check and alert badge counter
├── models/
│   ├── Book.js               # Catalog titles, stock, availability
│   ├── Circulation.js        # Issue and return transactions
│   ├── Fine.js               # Overdue penalties and payment statuses
│   ├── Notification.js       # In-app notifications
│   ├── ServiceRequest.js     # Reservations, renewals, complaints, suggestions
│   ├── Setting.js            # Dynamic borrowing parameters
│   └── User.js               # Staff and patron profiles
├── public/
│   ├── css/style.css         # Custom styling, badges, and print CSS
│   └── js/main.js            # Client-side dynamic forms and demo logins
├── routes/
│   ├── authRoutes.js
│   ├── catalogRoutes.js
│   ├── patronRoutes.js
│   ├── reportRoutes.js
│   └── staffRoutes.js
├── views/
│   ├── auth/                 # Login & Registration views
│   ├── catalog/              # Catalog index & single book detail
│   ├── patron/               # Patron dashboard, my-books, request-submit, etc.
│   ├── staff/                # Staff dashboard, issue, return, requests, etc.
│   ├── reports/              # Visual reporting & export views
│   └── partials/             # Header, Navbar, Alerts, Footer
├── .env                      # Environment configuration
├── package.json              # Dependencies and npm scripts
├── seed.js                   # Realistic database population script
└── server.js                 # Express application entry point
```

---

## 📊 Evaluation & Verification Checklist

- [x] **FR-001:** Patron registration, secure login with bcrypt, session persistence, role-based protection.
- [x] **FR-002:** Book catalog with search by title, author, category, ISBN, and stock status.
- [x] **FR-003:** Issue book to patron with due date calculation; return book with stock restocking.
- [x] **FR-004:** Submit Reservation, Renewal, Complaint, or Suggestion requests.
- [x] **FR-005:** Staff review, approval, rejection, and resolution of service requests.
- [x] **FR-006:** Patron tracking screen with state badges (`PENDING`, `APPROVED`, `RESOLVED`, `REJECTED`).
- [x] **FR-007:** Overdue fines automatically computed based on days late and configurable fine rate.
- [x] **FR-008:** Due date reminder notifications and overdue alerts.
- [x] **FR-009:** Staff dashboard with 6 KPIs and Chart.js graphs.
- [x] **FR-010:** 4 dedicated reports with print stylesheet and instant `.csv` downloads.
