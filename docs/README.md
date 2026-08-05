# Business Projections App documentation

This documentation explains the product, its architecture, and the movement of project financial data from business projection through production billing, invoicing, and receipts.

## Documentation set

| Document | Primary audience | Purpose |
|---|---|---|
| [Product overview](PRODUCT_OVERVIEW.md) | ELT, business users, product owners | Plain-language description of modules, users, workflows, terminology, and limitations |
| [System architecture](SYSTEM_ARCHITECTURE.md) | Developers, technical leads, support | Technology, components, access control, Google Sheets data model, deployment, and operational behavior |
| [Data flow and formula inventory](DATA_FLOW.md) | Product, finance, data, and engineering teams | Source-to-screen lineage, workflow diagrams, implemented calculations, filters, and inconsistencies |

Recommended reading order: Product Overview, System Architecture, then Data Flow.

## Scope and evidence

The repository was inspected excluding generated dependencies and build output except where build/deployment behavior required confirmation. The active implementation appears to be:

- React source under `frontend/src`
- Google Apps Script backend in `backend/Code.gs`
- Generated Apps Script web UI in `backend/index.html`

The root `Code.gs` and `index.html`, `Richard Backup`, `frontend/dist`, and generated backend assets appear to be older, backup, or build output rather than the current editable source. This classification is **Inferred** from build scripts and duplicate artifacts; deployment ownership should be confirmed. See [System Architecture](SYSTEM_ARCHITECTURE.md#repository-and-source-of-truth).

Evidence labels used throughout:

- **Confirmed:** directly implemented or configured in the repository.
- **Inferred:** strongly suggested by code or build flow, but not explicitly declared.
- **Needs Business Confirmation:** intent, ownership, scheduling, or policy cannot be established from the repository.
- **Mismatch/Risk:** two implementations differ, a comment differs from behavior, or an implementation may not meet the stated business definition.

Technical statements include `path:line-line` references where practical. Line numbers reflect commit `2dc7c68e7eeda95740e973aa1ebd61275e4430a9`.

## Important findings

- CRM-to-BigQuery SQL exists only as a legacy text artifact. The repository does not contain the extraction jobs, credentials, scheduler, destination table, write mode, pagination, retry logic, or an active BigQuery API connection. CRM lineage is therefore historical/incomplete, not a confirmed live integration (`backend/old appdata bigquery.sql.txt:1-180`).
- User login compares a submitted password with a Google Sheet value, while most role enforcement is in React route/UI logic. Backend write functions do not independently verify the caller's role. This is a material access-control risk (`backend/Code.gs:17-34`, `frontend/src/App.jsx:35-69`).
- Projection and billable “approval” is retrospective in the implementation: the changed values are written before their history rows are approved. Projection deletion is performed without creating a deletion-history record in the normal update path (`backend/Code.gs:389-604`, `backend/Code.gs:1511-1757`).
- “Total Billable,” “Yet to Bill,” “Outstanding,” and hold handling are not calculated consistently across Production, Finance, Executive, and timeline views. The exact variants are inventoried in [Data Flow](DATA_FLOW.md#financial-formula-inventory).
- Currency conversion is based on hard-coded frontend rates, while the legacy CRM SQL contains a different rate set. No rate service or effective-date model is present (`frontend/src/components/ProjectForm.jsx:41-49`, `backend/old appdata bigquery.sql.txt:31-48`).
- The repository contains no application manifest, environment-variable definition, CI workflow, active scheduled job definition, automated tests, or transactional/locking mechanism.

## Ownership and review

**Document owner:** Needs Business Confirmation. Recommended joint ownership: Product Operations for definitions and workflow, Finance for financial formulas, and Engineering for architecture and security.

**Last generated:** 5 August 2026  
**Repository commit:** `2dc7c68e7eeda95740e973aa1ebd61275e4430a9` (“Before project Documentation”)

> These documents are repository-derived and must be reviewed by the product owner, Finance owner, CRM/data owner, and application security owner before they are treated as operating policy.
