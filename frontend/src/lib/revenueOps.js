import { parseDate, getFY, getCY, getMonthShort, MONTHS_SHORT, USD_TO_INR } from "./utils";
import { getYearRange, buildPeriodColumns, buildPeriodScope, normalizeYears } from "./periods";

// Re-exported for backward compatibility: Business Projection now shares this same
// period-building code via ./periods, but existing imports of these two names from
// ./revenueOps (and this module's own test harnesses) keep working unchanged.
export { getYearRange, buildPeriodColumns };

// Revenue Operations: turns the Production + Finance payloads into a period grid of seven
// metrics, grouped by deal stage. Kept as a pure module so the aggregation can be tested
// against real sheet data without rendering anything.
//
// Each metric is dated by a DIFFERENT field, which is the whole point of the view:
//
//   Projected Billable   every Billable row, approved or not             -> Billable_date
//   Actual Billable      Approved_to_Finance is True OR Partially Approved -> Billable_date
//   Moved to Billing     Approved_to_Finance is True only (fully approved) -> Billable_date
//   Pending in Billing   approved but no invoice raised yet               -> Billable_date
//   Billed                invoices, excluding credit notes                -> Billed_date
//   Receipts              receipts, excluding credit-noted ones           -> Billed_date
//   Outstanding           Outstanding_amount, excluding CNs               -> Billed_date
//
// Billed, Receipts and Outstanding therefore all sit on ONE date basis -- the invoice's
// Billed_date -- so a period column reads as a single story: this is what we invoiced in
// this month, this much of it has come back, this much is still owed. A receipt is placed
// on the month its INVOICE was raised, not the month the money landed; the receipt's own
// Receipt_date rides along on the event purely for the drill-down list. "When did money
// actually hit the bank" is the Cashflow tab's question, and lib/cashflow.js answers it
// off Receipt_date -- the two views are deliberately different cuts of the same receipts.
//
// Actual Billable and Moved to Billing are not mutually exclusive rows in a waterfall --
// Moved to Billing is a strict subset of Actual Billable (every fully-approved billable is
// also counted as "approved to some degree"), the same way Production's own approval badge
// distinguishes "Partially Approved" from a full "True" (see backend/Code.gs's Approved_to_
// Finance writes and docs/PRODUCT_OVERVIEW.md's approver-count rule).
//
// A credit-noted invoice is excluded from every calculation, including the test for
// whether a billable has been invoiced at all.

// hint is what the user reads on hover, so it is written in plain business language rather
// than in sheet-column terms: what the number MEANS to the person reading it, not which
// field it was derived from. The field-level detail lives in the comment block above.
export const REVENUE_METRICS = [
    { key: 'projectedBillable', label: 'Projected Billable', hint: 'Work the Production team expects to finish and plans to hand over to Finance for invoicing.' },
    { key: 'actualBillable', label: 'Actual Billable', hint: 'Work that is finished and is waiting for the Business team to approve it before it goes to Finance for invoicing.' },
    { key: 'movedToBilling', label: 'Moved to Billing', hint: 'Work that is finished and has been handed over to Finance for invoicing, after both Production and Business approved it.' },
    { key: 'pendingInFinance', label: 'Pending in Billing', hint: 'Work already handed over to Finance by Production and Business, but the invoice has not been raised yet.' },
    { key: 'billed', label: 'Billed', hint: 'An invoice has been raised by Finance and sent to the client.' },
    { key: 'receipts', label: 'Receipts', hint: 'Money actually received and realised in our bank account against the invoices billed in this period.' },
    { key: 'outstanding', label: 'Outstanding', hint: 'Money still due from the client against the invoices billed in this period.' }
];

// Not one of the seven headline rows -- it starts collapsed and is expanded from a small
// arrow beside Receipts (see RevenueOperationsModal). TDS, foreign-exchange gain/loss and
// bank charges all leave the invoice amount without ever being "received" as cash, so they
// come out of Outstanding without ever showing up in Receipts -- this is exactly that gap:
// Billed - Receipts - Other Charges = Outstanding, on every row and in every total.
export const OTHER_CHARGES_METRIC = {
    key: 'otherCharges',
    label: 'Other Charges',
    hint: 'TDS, bank charges and exchange difference. Billed − Receipts − Other Charges = Outstanding.'
};

const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(n) ? n : 0;
};

const text = (v) => String(v ?? '').trim();

// Executive Hub reporting policy: unreceived GST is excluded from "Outstanding" here, even
// though the Finance sheet's own Outstanding_amount (what Finance Hub reads and edits) is
// left exactly as the backend computes it, GST included. Rather than re-deriving Outstanding
// from scratch, this subtracts each row's own unreceived GST share (GST_amount minus
// GST_Received) from the sheet's own figure -- algebraically exact, because
// updateAllOutstandingAmounts' Outstanding_amount is (GST-inclusive base) - GST_Received -
// receipts - TDS - forex - bank charges, so removing (GST_amount - GST_Received) leaves
// exactly (Billed_Amount_in_Inr) - receipts - TDS - forex - bank charges, with everything
// else on that row untouched. GST_amount/GST_Received are per-row fields (unlike pooled
// receipts), so no merged-invoice proration is needed here.
const outstandingExGst = (inv) => num(inv.Outstanding_amount) - (num(inv.GST_amount) - num(inv.GST_Received));

// Approved_to_Finance holds one of three literal values written by Code.gs:
// 'True' (two or more distinct approvers), 'Partially Approved' (exactly one), or blank/
// 'False' (none). Actual Billable counts the first two; Moved to Billing counts only 'True'.
const isApprovedOrPartial = (v) => {
    const t = text(v).toLowerCase();
    return t === 'true' || t === 'partially approved';
};
const isFullyApproved = (v) => text(v).toLowerCase() === 'true';

// A credit note IS the invoice row on this sheet -- there is no separate reversing row --
// so an invoice is credit-noted when its own Billing_type says so or it carries a credit
// note number. Both encodings are honoured so either way of recording one is caught.
const isCreditNoted = (inv) =>
    text(inv && inv.Billing_type).toLowerCase() === 'credit note' ||
    text(inv && inv['Credit Note Number']) !== '';

// INR is the authoritative figure throughout: every metric reads the INR column the sheet
// already stores at the real exchange rate. USD is only ever a convenience view, derived
// from that same INR so the two can never disagree with each other.
const toUsd = (inr) => inr / USD_TO_INR;

export const UNSPECIFIED_STAGE = 'Unspecified';

// What a single cell breaks down into, per metric. Each metric is dated and valued by a
// different field, so its row list names those fields rather than generic ones. Columns
// marked optional start hidden and are revealed on request.
const BILLABLE_DETAIL = [
    { key: 'date', label: 'Billable Date', type: 'date' },
    { key: 'amount', label: 'Billable Amount', type: 'money' },
    { key: 'client', label: 'Client', type: 'text' },
    { key: 'block', label: 'Project', type: 'text' },
    { key: 'bin', label: 'Bin Number', type: 'text', optional: true }
];
export const REVENUE_DETAIL_COLUMNS = {
    projectedBillable: BILLABLE_DETAIL,
    actualBillable: BILLABLE_DETAIL,
    movedToBilling: BILLABLE_DETAIL,
    pendingInFinance: BILLABLE_DETAIL,
    billed: [
        { key: 'date', label: 'Billed Date', type: 'date' },
        { key: 'amount', label: 'Billed Amount', type: 'money' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'block', label: 'Project', type: 'text' },
        { key: 'invoice', label: 'Invoice Number', type: 'text', optional: true }
    ],
    // Dated by the invoice's Billed date (that is what buckets the row into a column), with
    // the date the money actually landed shown beside it so a receipt can still be traced
    // back to its own bank date without leaving the list.
    receipts: [
        { key: 'date', label: 'Billed Date', type: 'date' },
        { key: 'amount', label: 'Receipt Amount', type: 'money' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'block', label: 'Project', type: 'text' },
        { key: 'receiptDate', label: 'Receipt Date', type: 'date' },
        { key: 'invoice', label: 'Invoice Number', type: 'text', optional: true }
    ],
    outstanding: [
        { key: 'date', label: 'Billed Date', type: 'date' },
        { key: 'amount', label: 'Outstanding Amount', type: 'money' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'block', label: 'Project', type: 'text' },
        { key: 'invoice', label: 'Invoice Number', type: 'text', optional: true },
        // Last, so it reads after the money and the names rather than interrupting them.
        { key: 'status', label: 'Payment Status', type: 'text' }
    ],
    otherCharges: [
        { key: 'date', label: 'Billed Date', type: 'date' },
        { key: 'amount', label: 'Other Charges', type: 'money' },
        { key: 'client', label: 'Client', type: 'text' },
        { key: 'block', label: 'Project', type: 'text' },
        // The breakdown behind the total, each hidden by default like every other optional
        // column -- most invoices only carry one or two of the three.
        { key: 'tds', label: 'TDS', type: 'money', optional: true },
        { key: 'exchangeDiff', label: 'Exchange Diff', type: 'money', optional: true },
        { key: 'bankCharges', label: 'Bank Charges', type: 'money', optional: true },
        { key: 'invoice', label: 'Invoice Number', type: 'text', optional: true }
    ]
};

// Below this an Outstanding balance is rounding residue rather than money owed. See the
// note at the outstanding event for why a hundred rupees is a safe cut-off on this data.
const OUTSTANDING_FLOOR = 100;

// --- Event extraction -------------------------------------------------------------

export function buildRevenueOpsEvents({ projects = [], finances = [] } = {}) {
    const events = [];

    // 1 + 2. Billable side, straight off the Production payload.
    const seenBillable = new Set();
    projects.forEach(p => {
        const dims = {
            stage: text(p['deal_stage']) || text(p['Block_Stage']) || UNSPECIFIED_STAGE,
            office: text(p['Contracting_Office']) || text(p['Office']),
            region: text(p['Region']) || text(p['Region Type']),
            poc: text(p['BizPoC']) || text(p['Biz Poc'])
        };
        (p.billables || []).forEach(b => {
            const id = text(b['Billable_id']);
            if (id) {
                if (seenBillable.has(id)) return;
                seenBillable.add(id);
            }
            const date = parseDate(b['Billable_date']);
            const inr = num(b['Amount_in_Inr']);
            const usd = toUsd(inr);
            // Row detail for the drill-down. The billable row carries its own block name;
            // the Production project is the fallback when it is blank.
            const row = {
                client: text(p['Client']) || text(p['Client_Name']),
                block: text(b['BlockName']) || text(p['Block_Name']),
                bin: text(b['Bin_number'])
            };
            events.push({ metric: 'projectedBillable', date, inr, usd, ...dims, ...row });
            if (isApprovedOrPartial(b['Approved_to_Finance'])) {
                events.push({ metric: 'actualBillable', date, inr, usd, ...dims, ...row });
            }
            if (isFullyApproved(b['Approved_to_Finance'])) {
                events.push({ metric: 'movedToBilling', date, inr, usd, ...dims, ...row });
            }
        });
    });

    // 3 - 6. Finance side. getFinances returns one item per approved billable, and a
    // Finance row that covers several billables is handed to each of them -- so invoices
    // are de-duplicated on Finance_id (unique per row) and receipts on Receipt_id.
    // De-duplicating invoices on Invoice_Number would be wrong: one invoice number can
    // legitimately span several Finance rows, each holding its own share of the amount.
    const seenFinanceRow = new Set();
    const seenReceipt = new Set();

    finances.forEach(item => {
        const dims = {
            stage: text(item['deal_stage']) || UNSPECIFIED_STAGE,
            office: text(item['Office']),
            region: text(item['Region']),
            poc: text(item['BizPoC'])
        };
        const invoices = item.finances || [];
        const row = {
            client: text(item['Client']) || text(item['Client_Name']),
            block: text(item['BlockName']),
            bin: text(item['Bin_number'])
        };
        // A credit-noted invoice counts for nothing anywhere, this test included: if a
        // billable's only invoice was credit-noted then the work is un-billed again and
        // belongs back in "pending in Finance". In practice a credit note is followed by a
        // replacement invoice on the same billable, which is what keeps it out of pending.
        const hasInvoice = invoices.some(f => text(f.Invoice_Number) !== '' && !isCreditNoted(f));

        if (!hasInvoice) {
            events.push({
                metric: 'pendingInFinance',
                date: parseDate(item['Billable_date']),
                inr: num(item['Billable_Amount_in_Inr']),
                usd: toUsd(num(item['Billable_Amount_in_Inr'])),
                ...dims,
                ...row
            });
        }

        invoices.forEach(inv => {
            const rowKey = text(inv.Finance_id) ||
                `${text(item.Billable_id)}|${text(inv.Invoice_Number)}|${text(inv.Billed_date)}`;
            const firstSighting = !seenFinanceRow.has(rowKey);
            if (firstSighting) seenFinanceRow.add(rowKey);

            const billedDate = parseDate(inv.Billed_date);
            const creditNoted = isCreditNoted(inv);

            if (firstSighting && text(inv.Invoice_Number) !== '' && !creditNoted) {
                const inr = num(inv.Billed_Amount_in_Inr);
                events.push({
                    metric: 'billed', date: billedDate, inr, usd: toUsd(inr),
                    ...dims, client: row.client, block: row.block,
                    invoice: text(inv.Invoice_Number)
                });
            }

            // Outstanding comes from the Finance sheet with unreceived GST taken back out
            // (see outstandingExGst above), minus credit notes. A credit-noted row can carry
            // a stale outstanding balance bigger than its own billed amount while the
            // replacement invoice that supersedes it sits at zero, so counting it would
            // materially overstate what is owed.
            if (firstSighting && !creditNoted) {
                const outInr = outstandingExGst(inv);
                // The sheet's outstanding recalculation leaves floating point residue on
                // settled invoices (values like 0.19999999999998863, -0.0004880843474523999
                // and a handful sitting at exactly -1 or 1.82). Those showed up as stray
                // "1" and "-1" cells. The data has a clean cliff here -- 167 rows fall under
                // two rupees and nothing at all lands between two rupees and a thousand --
                // so anything under a hundred is treated as settled.
                if (Math.abs(outInr) >= OUTSTANDING_FLOOR) {
                    events.push({
                        metric: 'outstanding', date: billedDate, inr: outInr, usd: toUsd(outInr),
                        ...dims, client: row.client, block: row.block,
                        invoice: text(inv.Invoice_Number), status: text(inv.Payment_status)
                    });
                }

                // Other Charges: TDS, Exchange_Diff and Bank_Charges are exactly the three
                // terms updateAllOutstandingAmounts() subtracts from the billed amount besides
                // receipts and GST, so Billed - Receipts - Other Charges reproduces Outstanding
                // (ex-GST) on the nose -- see OTHER_CHARGES_METRIC's own note in REVENUE_METRICS.
                const tds = num(inv.TDS), exchangeDiff = num(inv.Exchange_Diff), bankCharges = num(inv.Bank_Charges);
                const otherCharges = tds + exchangeDiff + bankCharges;
                if (otherCharges) {
                    events.push({
                        metric: 'otherCharges', date: billedDate, inr: otherCharges, usd: toUsd(otherCharges),
                        tds, tdsUsd: toUsd(tds), exchangeDiff, exchangeDiffUsd: toUsd(exchangeDiff),
                        bankCharges, bankChargesUsd: toUsd(bankCharges),
                        ...dims, client: row.client, block: row.block, invoice: text(inv.Invoice_Number)
                    });
                }
            }

            if (!creditNoted) {
                // One invoice is commonly settled by several receipts, so receipts are NOT
                // collapsed per invoice -- each row stands on its own Receipt_id. The only
                // duplication removed is getFinances handing the same receipt to every
                // billable that shares its invoice number. The positional fallback exists
                // purely for a row with no Receipt_id and carries the index, so two
                // part-payments of the same amount on the same day still count twice.
                (inv.Receipts || []).forEach((r, rIdx) => {
                    const amount = r['Receipt_Amount_in_INR'] !== undefined && r['Receipt_Amount_in_INR'] !== ''
                        ? r['Receipt_Amount_in_INR']
                        : r['Receipt_Amount'];
                    const rKey = text(r.Receipt_id) ||
                        `${text(inv.Invoice_Number)}|${rIdx}|${text(r.Receipt_date)}|${num(amount)}`;
                    if (seenReceipt.has(rKey)) return;
                    seenReceipt.add(rKey);
                    const inr = num(amount);
                    // Placed on the month the INVOICE was raised, not the month the money
                    // landed, so Billed / Receipts / Outstanding read as one story down a
                    // column: billed this much, collected this much of it, still owed this
                    // much. Every Finance row carrying an Invoice_Number also carries a
                    // Billed_date (verified across the whole sheet), and the rows of a
                    // merged invoice all share the same one, so no receipt loses its
                    // placement and it does not matter which row of a merged invoice is
                    // seen first. Receipt_date is kept for the drill-down and is what the
                    // Cashflow tab buckets by instead.
                    events.push({
                        metric: 'receipts', date: billedDate, inr, usd: toUsd(inr),
                        receiptDate: parseDate(r.Receipt_date),
                        ...dims, client: row.client, block: row.block,
                        invoice: text(r.Invoice_Number) || text(inv.Invoice_Number)
                    });
                });
            }
        });
    });

    return events;
}

// --- Periods ----------------------------------------------------------------------

// 'FY-26' -> 1 Apr 2026 to 31 Mar 2027;  'CY-26' -> 1 Jan 2026 to 31 Dec 2026.
// Mirrors getFY/getCY in lib/utils so the app has one definition of a year.
// --- Aggregation ------------------------------------------------------------------

const inList = (list, value) => !list || list.length === 0 || list.includes(value);


// undefined -> out of scope altogether;  null -> in scope but outside every column.
function scopeColumnFor(e, scope, { yearType = 'FY', yearLabel, yearLabels, offices = [], regions = [], pocs = [], months = [] }) {
    if (!inList(offices, e.office)) return undefined;
    if (!inList(regions, e.region)) return undefined;
    if (!inList(pocs, e.poc)) return undefined;
    if (!e.date) return undefined;
    // Year membership uses the app's own getFY/getCY so every view mode agrees on which
    // events belong to the selected year(s) -- the FY/CY pills are a multi-select, so an
    // event counts if its year is ANY of the ones picked.
    const years = normalizeYears(yearLabel, yearLabels);
    const evYear = yearType === 'CY' ? getCY(e.date) : getFY(e.date);
    if (years.length === 0 || !years.includes(evYear)) return undefined;
    if (months && months.length > 0 && !months.includes(getMonthShort(e.date))) return undefined;
    const col = scope.scopedColumns.find(c => e.date >= c.from && e.date <= c.to);
    // Hidden by the period picker rather than out of scope, so it is dropped outright: it
    // must not fall through to "undated", which exists only for real anomalies.
    if (col && !scope.shown.has(col.key)) return undefined;
    return col || null;
}

// The rows behind one cell, in the currency the cell was shown in. Pass columnKey null for
// a metric's Total column, which also picks up anything undated.
export function revenueOpsCellRows({
    events = [],
    metric,
    columnKey = null,
    stage = null,
    currency = 'INR',
    yearType = 'FY',
    yearLabel,
    yearLabels,
    viewMode = 'month',
    offices = [],
    regions = [],
    pocs = [],
    months = [],
    periods = []
} = {}) {
    const scope = buildPeriodScope({ yearType, yearLabel, yearLabels, viewMode, months, periods });
    const filters = { yearType, yearLabel, yearLabels, offices, regions, pocs, months };
    const rows = [];
    events.forEach(e => {
        if (e.metric !== metric) return;
        if (stage && e.stage !== stage) return;
        const col = scopeColumnFor(e, scope, filters);
        if (col === undefined) return;
        if (columnKey !== null && (!col || col.key !== columnKey)) return;
        const amount = currency === 'USD' ? e.usd : e.inr;
        // The grid skips zero-value events, so the row list must too or the two would
        // report different counts for the same cell.
        if (!amount) return;
        rows.push({
            date: e.date,
            amount,
            inr: e.inr,
            client: e.client || '',
            block: e.block || '',
            bin: e.bin || '',
            invoice: e.invoice || '',
            status: e.status || '',
            // Receipts only: the date the money actually reached the bank, alongside the
            // Billed date the row is bucketed by.
            receiptDate: e.receiptDate || null,
            // Other Charges only: the three figures its own amount is made up of, in the
            // same currency the row itself is shown in.
            tds: (currency === 'USD' ? e.tdsUsd : e.tds) || 0,
            exchangeDiff: (currency === 'USD' ? e.exchangeDiffUsd : e.exchangeDiff) || 0,
            bankCharges: (currency === 'USD' ? e.bankChargesUsd : e.bankCharges) || 0,
            period: col ? col.head : ''
        });
    });
    rows.sort((a, b) => (a.date - b.date) || (b.amount - a.amount));
    return rows;
}

// --- Column filters over a drill-down list ----------------------------------------

// Blank is filterable like any other value, so it is given a visible name rather than
// quietly dropping out of the option list.
export const DETAIL_BLANK = '(Blank)';

export function detailCellValue(row, key) {
    const v = String((row && row[key]) ?? '').trim();
    return v === '' ? DETAIL_BLANK : v;
}

// A column filter is a list of EXCLUDED values, which is what makes every value ticked by
// default: an absent or empty list means the column shows everything. That is the
// spreadsheet behaviour -- untick the one client you want out, rather than ticking the
// twenty you want in -- and it is stable, because the default does not have to be
// recomputed every time another column narrows the rows.
//
// `skipKey` leaves one column out, which is how that column's own option list is built: it
// then always lists every value still reachable through the other columns.
export function filterDetailRows(rows = [], filters = {}, skipKey = null) {
    const keys = Object.keys(filters).filter(k => k !== skipKey && filters[k] && filters[k].length > 0);
    if (keys.length === 0) return rows.slice();
    return rows.filter(r => keys.every(k => !filters[k].includes(detailCellValue(r, k))));
}

// Distinct values for one column with the number of rows behind each and whether it is
// currently ticked. "(Blank)" sorts last.
export function detailFilterOptions(rows = [], filters = {}, key) {
    const excluded = filters[key] || [];
    const seen = new Map();
    filterDetailRows(rows, filters, key).forEach(r => {
        const v = detailCellValue(r, key);
        seen.set(v, (seen.get(v) || 0) + 1);
    });
    return [...seen.entries()]
        .sort((a, b) => (a[0] === DETAIL_BLANK ? 1 : b[0] === DETAIL_BLANK ? -1 : a[0].localeCompare(b[0])))
        .map(([value, count]) => ({ value, count, checked: !excluded.includes(value) }));
}

// Tick a value back in, or untick it to exclude it. A column with nothing excluded is
// dropped from the filter set entirely, so "unfiltered" has exactly one representation.
export function toggleDetailFilter(filters = {}, key, value) {
    const cur = filters[key] || [];
    const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value];
    const out = { ...filters };
    if (next.length === 0) delete out[key]; else out[key] = next;
    return out;
}

// The "(Select All)" row. Ticking it clears the column; unticking it excludes everything,
// which is how you go from twenty values to the two you actually want.
export function setDetailColumnAll(filters = {}, key, values = [], selectAll = true) {
    const out = { ...filters };
    if (selectAll || values.length === 0) delete out[key];
    else out[key] = [...new Set(values)];
    return out;
}

export function aggregateRevenueOps({
    events = [],
    yearType = 'FY',
    yearLabel,
    // FY/CY is a multi-select: picking more than one year concatenates their columns end to
    // end (see buildPeriodScope). yearLabel (singular) still works for a single year.
    yearLabels,
    viewMode = 'month',
    currency = 'INR',
    offices = [],
    regions = [],
    pocs = [],
    months = [],
    // Which stages to break out as their own table. This is a SPLIT, not a filter: the
    // grand total always covers every stage, and each selected stage is an extra table
    // beneath it. Empty means no split, so only the grand total is shown.
    stages = [],
    // Which period columns to show, by key. Empty means all of them.
    periods = []
} = {}) {
    const scope = buildPeriodScope({ yearType, yearLabel, yearLabels, viewMode, months, periods });
    // scopedColumns is also the list the period picker offers, so it can only ever offer a
    // column that would really appear.
    const { columns } = scope;
    const filters = { yearType, yearLabel, yearLabels, offices, regions, pocs, months };
    const amountOf = (e) => (currency === 'USD' ? e.usd : e.inr);

    const blank = () => {
        const cells = {};
        columns.forEach(c => { cells[c.key] = 0; });
        return { cells, total: 0, undated: 0 };
    };
    // Other Charges is not one of the seven headline REVENUE_METRICS rows -- it starts
    // collapsed and is expanded on request (see RevenueOperationsModal) -- but it is bucketed
    // through this exact same machinery so its own cells, undated and totals come for free.
    const newGroup = () => {
        const g = {};
        REVENUE_METRICS.forEach(m => { g[m.key] = blank(); });
        g[OTHER_CHARGES_METRIC.key] = blank();
        return g;
    };

    const byStage = new Map();
    const totals = newGroup();
    let undatedSeen = false;

    events.forEach(e => {
        const col = scopeColumnFor(e, scope, filters);
        if (col === undefined) return;
        const value = amountOf(e);
        if (!value) {
            // Still register the stage so an all-zero row is not invented or hidden.
            if (!byStage.has(e.stage)) byStage.set(e.stage, newGroup());
            return;
        }

        if (!byStage.has(e.stage)) byStage.set(e.stage, newGroup());
        const g = byStage.get(e.stage);

        if (col) {
            g[e.metric].cells[col.key] += value;
            totals[e.metric].cells[col.key] += value;
        } else {
            // In-year but outside every column: should not happen, but the amount is kept
            // visible rather than dropped, so a total can never quietly lose money.
            g[e.metric].undated += value;
            totals[e.metric].undated += value;
            undatedSeen = true;
        }
        g[e.metric].total += value;
        totals[e.metric].total += value;
    });

    const stageOrder = (a, b) => {
        if (a === UNSPECIFIED_STAGE) return 1;
        if (b === UNSPECIFIED_STAGE) return -1;
        return a.localeCompare(b);
    };
    const stagesPresent = [...byStage.keys()].sort(stageOrder);
    // A selected stage with nothing in it still gets its table, all dashes, so that picking
    // it visibly does something instead of appearing to be ignored.
    const split = (stages || []).slice().sort(stageOrder)
        .map(name => ({ stage: name, metrics: byStage.get(name) || newGroup() }));

    return {
        columns,
        periodOptions: scope.scopedColumns.map(c => ({ value: c.key, label: c.head, sub: c.sub })),
        showUndated: undatedSeen,
        stagesPresent,
        groups: split,
        totals
    };
}

// Distinct filter values, taken from the events so the lists always match what the table
// can actually show.
export function revenueOpsFilterOptions(events = []) {
    const offices = new Set(), regions = new Set(), pocs = new Set(), stages = new Set();
    const fys = new Set(), cys = new Set();
    events.forEach(e => {
        if (e.office) offices.add(e.office);
        if (e.region) regions.add(e.region);
        if (e.poc) pocs.add(e.poc);
        if (e.stage) stages.add(e.stage);
        if (e.date) { fys.add(getFY(e.date)); cys.add(getCY(e.date)); }
    });
    const byYearDesc = (a, b) => String(b).localeCompare(String(a));
    return {
        offices: [...offices].sort(),
        regions: [...regions].sort(),
        pocs: [...pocs].sort(),
        stages: [...stages].sort(),
        fys: [...fys].sort(byYearDesc),
        cys: [...cys].sort(byYearDesc)
    };
}
