# Product overview

## What the product does

The Business Projections App gives business, production, finance, and executive users a shared view of a project's commercial lifecycle:

```text
Business Projection → Projected Billable → Total Billable → Yet to Bill → Billed → Receipts
                                                    Billed → Outstanding → Receipts
```

It stores operational data in Google Sheets and presents role-specific React dashboards. Business users maintain projects and expected revenue dates; Production maintains work/billable records; Finance records invoices and receipts; executives see a consolidated, read-only view (`frontend/src/App.jsx:83-165`, `backend/Code.gs:149-238`, `backend/Code.gs:1064-1311`, `backend/Code.gs:1773-1886`).

## Modules and users

| Module | Intended users confirmed by routing | Purpose | Main actions |
|---|---|---|---|
| Admin Dashboard | Admin, Multi Role, Executive | Module launcher | Open permitted hubs |
| Business Hub | Biz, BizPoC, Admin, Executive | Projects and business projections | Search/filter; create as Admin; edit as Biz, BizPoC, or Admin; Executive is read-only |
| Production Hub | Production, Admin, Prod Admin, Executive | Work allocation, bins, expected/actual billables, approvals | Edit production data; approve as Admin/Prod Admin; Executive is read-only |
| Finance Hub | Finance, Admin, Executive | Approved billables, invoices, receipts, payment status | Record finance data as Finance/Admin; Executive is read-only |
| Client Code | Client Code, Admin, Executive | Client/show-code mapping | Generate and save mappings; export visible data to CSV; Executive is read-only |
| Executive Hub | Executive, Admin | Consolidated project and financial view | Filter, inspect project details and timelines; read-only |
| Marketing Dashboard | (Unfinished) | Prototype/Unused | - |
| Login | Public | User authentication | Authenticate and route to primary hub |

Route and role evidence: `frontend/src/App.jsx:35-165`. Module visibility: `frontend/src/pages/AdminDashboard.jsx:41-170`. Login routing: `frontend/src/pages/Login.jsx:45-65`.

Actual role strings found in the UI include `Admin`, `Multi Role`, `Executive`, `Biz`, `BizPoC`, `Production`, `Prod Admin`, `Finance`, and `Client Code`. Comparisons are usually case-insensitive in routing, but some backend comparisons are case-sensitive, so consistent sheet values matter.

### What each role can see

- Admin can enter all modules, create projects, edit operational data, and approve billables.
- Executive can enter all hubs but the UI makes Business, Production, Finance, and Client Code views read-only.
- Biz can see all Business Hub projects under the current backend rule. BizPoC is normally limited to rows whose stored email matches the logged-in email.
- Production and Prod Admin use Production Hub. Prod Admin, like Admin, can approve billables in the UI. Production sees masked client and project names (e.g., "Hidden Project") unless explicitly revealed, whereas Prod Admin and Finance bypass this masking.
- Finance works with approved billables and their invoices/receipts.
- Client Code maintains client and show-code mappings.
- Multi Role is routed to the Admin Dashboard, where tile visibility depends on the comma-separated roles stored for that user.

**Security caution:** these restrictions are primarily enforced in the browser. Backend mutation functions do not prove the caller's identity or role before changing sheets. UI visibility must not be treated as a security boundary (`frontend/src/App.jsx:35-69`, `backend/Code.gs:17-34`).

## Main workflows

### 1. Project and business projection

An Admin can create a project and its dated projection entries. Biz, BizPoC, and Admin can open the modification route, although many CRM-like project fields are presented as read-only and projection rows are the primary editable data. A create operation writes the Projects, Projections, and history sheets; an update changes the project and upserts/deletes projections (`frontend/src/App.jsx:149-165`, `backend/Code.gs:329-386`).

**Inferred:** projects may historically have originated in HubSpot or Zoho because a legacy SQL union maps CRM deals/blocks into a common structure. The repository does not show a live feed from that query into the Projects sheet, so the current origin and refresh method **Needs Business Confirmation** (`backend/old appdata bigquery.sql.txt:1-180`).

### 2. Awarded project to Production

The backend has a synchronization function that selects project stages containing the text “award” and appends projects not already present in the Production sheet. Matching is a case-insensitive substring, not an exact approved-stage list (`backend/Code.gs:962-1016`).

No caller or scheduler for this function exists in the repository. **Needs Business Confirmation:** whether it is run manually, by an Apps Script trigger outside source control, or not at all.

### 3. Production billable and approval

Production maintains bins and billable entries with planned/actual billable dates and amounts. Changes are stored immediately and history rows are created for selected changes. For an initial billable approval:

1. An Admin or Prod Admin selects approval in the UI.
2. The backend records unique approver names.
3. One name produces “Partially Approved.”
4. Two or more distinct names set `Approved_to_Finance = True`.
5. The backend creates a placeholder Finance row if one is not already present.

References: `frontend/src/components/BillableRepeater.jsx:525-539`, `backend/Code.gs:1458-1503`.

**Mismatch/Risk:** the backend trusts the submitted approver name and does not verify the caller's role. Changes are not held pending approval; history approval happens after the underlying billable was updated (`backend/Code.gs:1511-1757`).

### 4. Finance invoice and receipt

Finance loads billables whose `Approved_to_Finance` value is true. Users can add invoice dates, due dates, invoice numbers, billed amounts, taxes/deductions, receipts, and payment status. Saving updates Finance rows and appends receipt rows. An invoice number marks related billable/bin status as billed or partially billed (`backend/Code.gs:1773-2143`).

Due date is automatically set to 30 calendar days after the billed date in the Finance modal (`frontend/src/components/FinanceModal.jsx:179-194`). This is a fixed UI rule; no client-specific credit-term configuration was found.

### 5. Executive consolidation

The Executive Hub joins Business projects to Production data using Block ID, then joins Finance data using Billable ID. It calculates approved production amount, billed amount, receipts, yet-to-bill, and outstanding values, and supports project-level details and a global timeline (`frontend/src/pages/ExecutivePage.jsx:98-339`).

The screen is a client-side consolidation over data fetched from multiple sheet-backed backend functions. It is not a separate warehouse/reporting table.

## Financial terminology: expected meaning versus implementation

| Term | Business meaning | Implemented source/behavior | Alignment |
|---|---|---|---|
| Business Projection | What Business expects to become available, by amount and date | Current rows in Projections, entered with a project and displayed/aggregated by projection date | Broadly aligned |
| Projected Billable | What Production expects to bill | Timeline event derived from Billable History rows whose Type is exactly `New` | Partial; this is a history-event proxy rather than an independent current forecast |
| Total Billable | Completed work approved for invoicing | Executive/timeline use approved billables; timeline also excludes held entries. Production page totals all billables regardless of approval or hold | Inconsistent |
| Yet to Bill | Approved billable value not yet invoiced | Usually `max(0, approved billable − billed)` | Broadly aligned, but negative balances are hidden and hold treatment differs |
| Billed | Invoiced client value | Finance rows with an invoice number, normally excluding Credit Notes in KPIs | Broadly aligned; status updates may still treat a Credit Note number as billed |
| Receipts | Money recorded as received | Rows in Receipts joined by invoice number | Broadly aligned; joins and deduplication vary |
| Outstanding | Invoiced value not collected | Multiple formulas subtract some combination of receipts, TDS, bank charges, exchange difference, and sometimes GST/GST received | Not consistent with one canonical definition |

Full formulas and references are in [Data Flow](DATA_FLOW.md#financial-formula-inventory).

## Currency and time

- Screens support home currency, USD, and INR views. Frontend conversion uses fixed values: USD 90 INR, EUR 107, GBP 123, AUD 63, CAD 66, YEN 12.9, INR 1 (`frontend/src/components/ProjectForm.jsx:41-49`).
- Project USD is calculated as `home amount × currency-to-INR rate ÷ 90` and rounded to two decimals (`frontend/src/components/ProjectForm.jsx:129-145`).
- The legacy CRM SQL uses materially different rates, so imported/stored USD values can disagree with frontend recalculation (`backend/old appdata bigquery.sql.txt:31-48`).
- Financial years run from April through March. Calendar-year filters use January through December (`frontend/src/lib/utils.js:58-86`).
- Global timeline “weekly” buckets are week-of-month (days 1–7, 8–14, and so on), while dashboard week filters use Monday-based ranges. These are different meanings of “week” (`frontend/src/components/GlobalTimelineModal.jsx:165-247`).

## Business benefits

- One project-level view across commercial expectation, production readiness, invoicing, and collection.
- Role-specific dashboards without requiring users to navigate the underlying sheets.
- Drill-down timelines and period filters for forecast and performance review.
- Traceable projection and billable change history, although approval is retrospective.
- Client/show-code management and filtered CSV export.

## High-level limitations and decisions required

1. **Access control:** implement or confirm server-side identity and authorization before treating the application as secure for financial data.
2. **Canonical definitions:** approve one definition for Total Billable, holds, Yet to Bill, Outstanding, GST, TDS, bank charges, exchange difference, and credit notes.
3. **Currency governance:** identify the authoritative rate source, rate date, supported currency codes, and rounding policy. “YEN” is used rather than the ISO code JPY.
4. **CRM ownership:** confirm whether HubSpot, Zoho, BigQuery, or manual sheet entry currently owns each project field and how changes reach the app.
5. **Scheduling:** confirm how awarded-project synchronization and finance maintenance functions are invoked.
6. **Approval policy:** confirm whether projection/billable changes should wait for approval or whether approval is intentionally an audit acknowledgement.
7. **Data integrity:** multi-sheet writes have no transaction or lock, and duplicate backend helper declarations have different blank/zero behavior.
8. **Reporting consistency:** reconcile Production, Finance, Executive, project modal, and global timeline formulas before using them as financial control totals.
9. **Testing and operations:** no automated test suite, monitoring integration, deployment pipeline, or checked-in Apps Script manifest was found.
