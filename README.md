# Roomz — Shared Household Expense Application

A mobile-first, secure, zero-cost web application designed specifically for **three roommates** living together to track shared household expenses, grocery shopping, room maintenance, monthly budgets, and end-of-month settlements.

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **TypeScript**, and **Supabase (Auth + PostgreSQL + SSR + RLS + Realtime)**.

---

## 📑 Table of Contents

- [Core Principles & Product Decisions](#core-principles--product-decisions)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Database & Security Model](#database--security-model)
- [Integer-Paise Accounting Engine](#integer-paise-accounting-engine)
- [Preloaded Catalog](#preloaded-catalog)
- [Environment Variables](#environment-variables)
- [Supabase Setup & Migrations](#supabase-setup--migrations)
- [Local Development & Testing](#local-development--testing)
- [Deploying to Vercel (Hobby Tier)](#deploying-to-vercel-hobby-tier)
- [Application Feature Walkthrough](#application-feature-walkthrough)
- [Verification Checklist & Invariants](#verification-checklist--invariants)

---

## 🎯 Core Principles & Product Decisions

1. **3-Roommate Household**: Specifically designed for three roommates with individual authenticated accounts sharing a single household. A hard limit of 3 active members is enforced both in the database functions and application layer.
2. **Invite-Code Onboarding**: Households are created with secure 8-character uppercase invitation codes. Roommates join seamlessly without email invite delivery friction.
3. **Exact Paise-Level Math (INR)**: Zero floating-point rounding errors. All monetary values are represented as integers in **paise** (`₹1.00 = 100 paise`). Indivisible remainders are deterministically assigned so the sum of individual splits always matches the total expense down to 1 paise.
4. **Personal vs. Shared Isolation**: Roommates can log personal items (e.g. personal snacks or toiletries) alongside shared expenses. Personal items are assigned 100% to the payer and **never inflate household shared totals or other roommates' debts**.
5. **Settlements Do Not Inflate Spending**: Debt settlements between roommates are treated as balance reconciliations, never as household expenses.
6. **Asia/Kolkata Calendar Months**: All monthly reporting and budget periods use the `Asia/Kolkata` timezone (IST, UTC+05:30).
7. **Zero-Cost Deployment Target**: Fully optimized to run within free tiers: **Vercel Hobby** and **Supabase Free tier** with no paid third-party APIs.

---

## 🏛️ Architecture & Tech Stack

- **Framework**: [Next.js 16.4](https://nextjs.org/) (App Router, Turbopack, React 19).
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with modern `@import "tailwindcss";` CSS-first engine.
- **Backend & Auth**: [Supabase](https://supabase.com/) PostgreSQL database with Row-Level Security (RLS) and email/password authentication.
- **Server Utilities**: `@supabase/ssr` with async `cookies()` integration in `src/lib/supabase.server.ts` and Next.js 16 proxy session refresh in `src/proxy.ts`.
- **State & Server Actions**: React 19 Server Actions (`'use server'`) for atomic mutations and instant client-side feedback.
- **Realtime Updates**: Supabase Realtime channel subscription for immediate sync when roommates log expenses.
- **Testing**:
  - [Vitest](https://vitest.dev/) for pure accounting tests, utils, and full month invariant lifecycle tests.
  - [Playwright](https://playwright.dev/) for desktop and mobile smoke tests.

---

## 🗄️ Database & Security Model

The schema is defined across two versioned SQL migrations located in `supabase/migrations/`:

1. `20241009_initial_schema.sql`: Core tables, RLS policies, helper function `current_profile_id()`.
2. `20241009_000002_schema_enhancements.sql`: Enhanced user profiles, triggers, performance indexes, Indian catalog seeding, and atomic RPC functions.

### Relational Schema

- **`profiles`**: Linked 1:1 with `auth.users`. Automatically provisioned via PostgreSQL trigger on signup.
- **`households`**: Room name, monthly budget cap (in paise), creation metadata.
- **`household_members`**: Membership table with role (`admin` or `member`) and join timestamps. Enforces the 3-member ceiling.
- **`invitations`**: 8-character unique alphanumeric tokens, expiration timestamps, usage status.
- **`categories`**: Preloaded expense categories with icons and color accents.
- **`catalog_items`**: Preloaded standard Indian groceries and household goods with default quantities, units, and suggested prices.
- **`expenses`**: Transaction records storing `total_amount` (paise), payer, category, quantity, unit, and personal flag.
- **`expense_splits`**: Split breakdown storing each beneficiary's exact share in paise.
- **`settlements`**: Direct debt settlement records between two roommates (`payer_id` -> `receiver_id`).
- **`budgets`**: Monthly spending targets for the household or individual categories.
- **`audit_events`**: Audit log of critical events (member joined, budget updated, settlement recorded).

### Row-Level Security (RLS)

Every table enables RLS. Read and write permissions require membership in the corresponding `household_id`:
```sql
CREATE POLICY "household_members_view" ON household_members
  FOR SELECT TO authenticated
  USING (
    household_id IN (
      SELECT hm.household_id FROM household_members hm
      WHERE hm.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );
```

### Atomic Database Functions (RPC)

Financial transactions and household mutations execute atomically via PostgreSQL functions to prevent partial writes:
- `create_household(household_name, user_full_name)`: Creates household, sets up admin membership, and seeds starter categories and catalog items.
- `create_expense(...)`: Writes the expense and all beneficiary splits in a single atomic transaction.
- `update_expense(...)`: Updates expense metadata and re-computes beneficiary splits atomically.
- `delete_expense(expense_id)`: Deletes an expense and its cascading splits.
- `record_settlement(...)`: Records a debt settlement between roommates and emits an audit event.
- `redeem_invitation(token)`: Validates token validity and enforces the 3-roommate ceiling before adding the member.

---

## 🧮 Integer-Paise Accounting Engine

Implemented in `src/lib/accounting.ts` with pure TypeScript functions:

### 1. `splitEqualPaise(totalPaise: bigint, beneficiaryCount: number): bigint[]`
Splits an integer paise amount evenly. If `totalPaise % beneficiaryCount !== 0`, the remainder paise are distributed 1 paise each to the first remainder beneficiaries.
- **Example**: `₹100.00` (10,000 paise) split among 3 roommates:
  - Base: `10000 / 3 = 3333 paise`
  - Remainder: `10000 % 3 = 1 paise`
  - Result: `[3334 paise, 3333 paise, 3333 paise]` (Sum = 10,000 paise).

### 2. `calculateNetBalance(payments, responsibilities): Record<string, bigint>`
- **Net Balance** = `Total Paid - Total Fair Share Responsibility`.
- Positive balance: **Creditor** (is owed money).
- Negative balance: **Debtor** (owes money).
- Zero balance: **Settled**.
- **Invariant**: In any closed household, `sum(netBalances) === 0n`.

### 3. `suggestSettlements(balances): Array<{ from: string, to: string, amount: bigint }>`
Greedy bipartite settlement reconciliation algorithm that matches the largest debtor with the largest creditor, minimizing the total number of transfers required to settle all debts (at most $N-1$ transfers).

---

## 🛒 Preloaded Catalog

Upon household creation, `seed_household_defaults()` automatically provisions **9 categories** and **35+ common Indian household items**:

| Category | Example Catalog Items |
| :--- | :--- |
| 🍚 **Groceries & Staples** | Rice (Basmati / Sona Masoori), Atta (Wheat Flour), Toor Dal, Moong Dal, Mustard / Sunflower Oil, Salt & Spices |
| 🥦 **Vegetables & Fruits** | Onions, Potatoes, Tomatoes, Ginger & Garlic, Seasonal Vegetables, Bananas, Apples |
| 🥛 **Dairy & Breakfast** | Milk (Packet / Pouch), Curd / Yogurt, Eggs (Tray of 30), Bread, Butter, Paneer |
| ⚡ **Utilities & Bills** | Electricity Bill, High-Speed WiFi Internet, LPG Cooking Gas Cylinder, Water Delivery Can |
| 🧹 **Household Supplies** | Dishwash Liquid, Detergent Powder, Floor Cleaner (Phenyl / Lizol), Garbage Bags, Toilet Paper / Napkins |
| 🧴 **Toiletries & Personal** | Handwash Liquid, Bath Soap / Body Wash, Shampoo, Toothpaste |
| 🍕 **Food & Snacks** | Evening Snacks / Namkeen, Tea (Chai Patti), Coffee Powder, Drinking Water Filter Maintenance |
| 🔧 **Room Maintenance** | Electrician / Plumbing Repair, AC Servicing & Cleaning, Spare Light Bulbs / Tubelights |
| 📦 **Other** | Miscellaneous Room Purchases |

Roommates can also add custom items on the fly with custom units and suggested prices.

---

## ⚙️ Environment Variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **Note**: `.env*.local` and `.env` are excluded in `.gitignore` to prevent secret leakage. Only `.env.example` is committed to Git.

---

## 🚀 Supabase Setup & Migrations

### 1. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com/) and create a new project on the Free tier.
2. Under **Project Settings -> API**, copy your **Project URL** and **Project API Key (`anon public`)**.

### 2. Execute Migrations
Open the **SQL Editor** in your Supabase dashboard:
1. Paste and run the contents of [`supabase/migrations/20241009_initial_schema.sql`](file:///D:/Room_Manager/supabase/migrations/20241009_initial_schema.sql).
2. Paste and run the contents of [`supabase/migrations/20241009_000002_schema_enhancements.sql`](file:///D:/Room_Manager/supabase/migrations/20241009_000002_schema_enhancements.sql).

### 3. Configure Auth Redirect URLs
In Supabase under **Authentication -> URL Configuration**:
- **Site URL**: `http://localhost:3000` (or your Vercel production domain).
- **Redirect URLs**: Add `http://localhost:3000/auth/callback` and `https://your-app.vercel.app/auth/callback`.

---

## 💻 Local Development & Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
# Run unit and accounting flow invariant tests
npm run test

# Run ESLint validation
npm run lint

# Run Playwright E2E smoke tests (when Playwright browsers are installed)
npm run test:e2e
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser or mobile viewport emulator.

### 4. Build for Production
```bash
npm run build
```

---

## ☁️ Deploying to Vercel (Hobby Tier)

1. Push your code to a GitHub repository:
   ```bash
   git add .
   git commit -m "feat: complete production-ready Room Manager application"
   git push origin main
   ```
2. Go to [vercel.com](https://vercel.com/) and click **Add New... -> Project**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, configure:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key`
5. Click **Deploy**. Vercel will build and deploy the Next.js App Router application on the Hobby plan at zero cost.

---

## 📱 Application Feature Walkthrough

### 1. Landing & Authentication
- Session-aware landing page with quick action triggers.
- Login and Signup with full name, email, and password.
- Automatic creation of user profiles via database triggers.

### 2. Onboarding: Create or Join
- **Create Household**: Name your room (e.g. "Flat 302 Roommates") to automatically provision default categories and catalog items.
- **Join Household**: Enter an 8-character invitation code to join an existing room. Rejects joins once 3 active members have joined.

### 3. Dashboard
- **Monthly Overview**: Total spending this month, household budget progress bar with warning states (yellow at 80%, red at 100%).
- **Roommate Balances**: Shows who is owed money and who owes money.
- **1-Click Settlement**: Roommates with debts can settle suggested transfers directly from the dashboard.
- **Category Spending Breakdown**: Visual bar breakdown of expenditures across categories.
- **Recent Expenses**: Latest transactions with live updates via Supabase Realtime.

### 4. Fast Add Expense Flow (Mobile-Optimized)
- **Preloaded Catalog Autocomplete**: Select standard items like "Basmati Rice", "Milk 1L", "Eggs (30 tray)", "Electricity Bill" to automatically populate category, default units, and suggested price.
- **Live Split Preview**: Shows exact breakdown per roommate in rupees and paise in real time as the amount is entered.
- **Personal Purchase Mode**: Toggle the "Personal Purchase" switch for items bought by one roommate for themselves; splits are allocated 100% to the payer.
- **"Save & Add Another"**: Quickly log multiple grocery items in a single sitting without reloading.

### 5. Expense History & Management
- Search expenses by title or notes.
- Filter by month, category, or payer.
- Edit existing expenses or delete them with instant recalculation of splits and balances.

### 6. Monthly Budgets
- Set or update the household-wide monthly budget limit in INR.
- Set optional category-level spending limits.
- Visual progress bars indicate spent vs. remaining budget with over-budget alerts.

### 7. Settlement Center
- Complete debt audit showing pair-wise obligations.
- Record custom payments (cash, UPI, Google Pay).
- Suggested transfers calculate the minimal number of payments to achieve complete zero balances.

### 8. Analytics & CSV Export
- View current month and historical month aggregates.
- Summary of fair-share contributions vs. actual paid amounts per roommate.
- **Export Transactions to CSV**: Generates a standard UTF-8 BOM CSV compatible with Microsoft Excel, Google Sheets, and LibreOffice containing date, title, category, payer, amount, personal flag, and notes.

### 9. Room Settings & Invitations
- View all active members.
- Generate or revoke 8-character invitation codes.
- One-tap invite code copy button for sharing via WhatsApp or SMS.
- Secure sign-out.

---

## ✅ Verification Checklist & Invariants

- [x] **Zero Floating-Point Math**: All financial records, inputs, and balances use integer paise (`bigint`).
- [x] **Total Conservation**: `sum(splitPaise) === totalExpensePaise` at all times.
- [x] **Zero-Sum Balances**: `sum(netBalances) === 0` across the entire household.
- [x] **Personal Isolation**: Personal items never inflate shared expenses or other roommates' liabilities.
- [x] **Membership Cap**: Strictly capped at 3 members per household.
- [x] **Next.js 16 SSR Compatibility**: Async `cookies()`, proxy session refresh in `src/proxy.ts`, server-only client protection.
- [x] **Test Suite**: 22 unit & invariant tests passing cleanly in Vitest.
- [x] **Production Build**: Clean compilation with Next.js 16 App Router and Turbopack.
- [x] **Zero-Cost Deployment**: Ready for Vercel Hobby and Supabase Free tier.

---

*Room Manager — Built with care for roommates.*
