# AIFAT REGISTRATION & TRAINING MANAGEMENT SYSTEM
## The Signal School | Signal Regiment, Philippine Army

The official production-ready registration and training operations portal for the **Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)**.

Conducted by:
**THE SIGNAL SCHOOL**
**SIGNAL REGIMENT, PHILIPPINE ARMY**
*Fort Andres Bonifacio, Taguig City*
*In collaboration with a TESDA-accredited training provider.*

---

## 1. System Architecture & Tech Stack

- **Runtime & Hosting**: Cloudflare Workers / Pages via [Vinext](https://github.com/cloudflare/vinext) (Next.js App Router compatible on Vite)
- **Frontend**: React 19, Tailwind CSS 4, Radix UI Primitives, Lucide Icons
- **Database Layer**: Drizzle ORM over Cloudflare D1 (SQLite-compatible) with adaptive local fallback for standalone Node.js test runners and migrations
- **Authentication**: Institutional Administrative Session tokens with Web Crypto PBKDF2 (100,000 rounds, SHA-256) password hashing and HMAC-SHA256 signature verification
- **Data Privacy**: Strict privacy consent logging, minimal public QR verification endpoints (initials only), no public roster exposure

---

## 2. Institutional Logic: Approved vs. Configurable

### A. APPROVED / LOCKED LOGIC (Do Not Change Without Explicit Command Order)
1. **Institutional Identity**:
   - Authorized branding: `THE SIGNAL SCHOOL / SIGNAL REGIMENT, PHILIPPINE ARMY`
   - Approved provider wording: *"In collaboration with a TESDA-accredited training provider."*
   - Certification copy: *"TESDA Certification Opportunity"*
   - Prohibited copy: No "BrandBoss" references; no statement claiming The Signal School itself is TESDA accredited.
2. **AOR to Internal Code Mapping**:
   - 1ID AOR → `A`
   - 2ID AOR → `B`
   - 3ID AOR → `C`
   - 4ID AOR → `D`
   - 5ID AOR → `E`
   - 6ID AOR → `F`
   - 7ID AOR → `G`
   - 8ID AOR → `H`
   - 9ID AOR → `I`
   - 10ID AOR → `J`
   - 11ID AOR → `K`
   - NCR AOR → `T`
3. **Delivery Mode Constraints**:
   - **1ID–11ID (Codes A–K)**: Authorized strictly for **Online AM** and **Online PM** sessions. Face-to-Face is strictly forbidden.
   - **NCR AOR (Code T)**: Authorized for **Online AM**, **Online PM**, **Face-to-Face AM**, and **Face-to-Face PM** sessions.
   - Enforced across public UI, server-side registration API, database rules, and administrative batch provisioning.
4. **Registration Safeguards**:
   - Duplicate prevention by email + batch.
   - Capacity race condition protection.
   - Server-side deadline and batch status verification (`OPEN` / `NEARLY FULL`).

### B. CONFIGURABLE OPERATIONAL DATA (Pending Final TSS Operational Input)
The following parameters are manageable dynamically via the **Administrative Dashboard (`/admin/settings`)** without code changes:
- Official telephone contact numbers and local extensions.
- Official training directorate support email address.
- Specific operational registration deadlines per batch.
- Subsequent changes to training dates and academic periods.
- Room/hall venue specifications for NCR Face-to-Face sessions.
- Final approved reference-number sequence formula (default: `AIFAT-{YEAR}-{AOR}-{SEQ}`).
- Record retention period guidelines.

---

## 3. Local Development Setup

### Prerequisites
- Node.js `>=22.13.0` (Tested on Node.js `v24.19.0`)
- npm `>=10.0.0`

### Installation
```bash
# 1. Clone repository and navigate to directory
cd AIFAT-main

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
```

### Running Development Server
```bash
npm run dev
# Server will launch at http://localhost:5173
```

---

## 4. Administrative Dashboard Access

The administrative command portal is located at:
```
http://localhost:5173/admin
```

- **Administrative Account Bootstrap**: Configured via the `ADMIN_INITIAL_PASSWORD` environment variable in `.env` (no default password is hard-coded or committed).
- **Username**: `admin` (or custom administrator as configured)
- **Capabilities**:
  - **Dashboard**: Real-time telemetry, enrollment vs. capacity per AOR and delivery mode.
  - **Batch Management**: Provision new batches (strictly enforcing AOR rules), edit capacities, update venues, change deadlines, open/close registrations.
  - **Learner Roster**: Search, filter by AOR/mode/status, view details, update attendance and completion statuses.
  - **Reports & Export**: Download spreadsheet-compatible CSV roster (with CSV injection sanitization) and generate official print-ready rosters.
  - **Operational Settings**: Update institutional contact details, reference sequence formats, and retention notices.

---

## 5. Verification & Testing

The test suite includes the 8 baseline automated tests and comprehensive production features testing:

```bash
# 1. Run institutional rules verification
node --test tests/aifat-rules.test.mjs

# 2. Run production features test suite (Auth, Batch Rules, Reference Generator, Settings)
node --test tests/production-features.test.mjs

# 3. Run UI components & CSS bundle validation (requires build)
npm run build
node --test tests/ui-components.test.mjs

# Run all test suites combined
node --test tests/*.test.mjs
```

---

## 6. Production Deployment

### Cloudflare Pages / Workers Deployment
1. Ensure Cloudflare D1 database binding `DB` is provisioned:
   ```bash
   npx wrangler d1 create aifat-production-db
   ```
2. Run database migrations:
   ```bash
   npx wrangler d1 execute aifat-production-db --file=drizzle/0000_premium_green_goblin.sql
   npx wrangler d1 execute aifat-production-db --file=drizzle/0001_production_schema.sql
   ```
3. Deploy application:
   ```bash
   npx wrangler deploy
   ```
