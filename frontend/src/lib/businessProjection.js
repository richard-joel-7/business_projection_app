import { parseDate, getFY, getCY, getMonthShort, USD_TO_INR } from "./utils";
import { getYearRange, buildPeriodColumns, buildPeriodScope, normalizeYears } from "./periods";

// Business Projection: the sales pipeline, bucketed by Deal Stage and by period, built from
// the same Projects + Projections payload the Business Projections Hub already fetches
// (useData()'s `projects`, i.e. api.getDashboardProjects()). Pure module, mirroring
// revenueOps.js's shape, so this table can be tested against real data without rendering
// anything and so a fix to period logic (see ./periods) benefits both tables at once.
//
// Money: Amount_in_USD is the value the Projections sheet actually stores for a pipeline
// line (Amount_in_Inr is not even sent to the frontend by getDashboardProjects), so USD is
// authoritative here and INR is derived at the fixed rate -- the same convention this app
// already uses for every other Business Projections Hub figure. This is a deliberate
// difference from Revenue Operations, where INR is authoritative: that table reports real
// invoiced money with its own recorded exchange rate, this one reports a USD-native forecast.
//
// A projection row whose Change Type is "Delete" is excluded, matching the rule already
// applied throughout Dashboard.jsx (a pending-deletion placeholder is not live pipeline).

export const UNSPECIFIED_STAGE = 'Unspecified';

const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(n) ? n : 0;
};
const text = (v) => String(v ?? '').trim();
const toInr = (usd) => usd * USD_TO_INR;

// Display order for the Deal Stage rows: most-certain revenue first, least-certain (and
// Lost) last. Any deal_stage value this list does not name still appears -- sorted
// alphabetically after the named ones -- so a new or unexpected stage is never dropped.
const STAGE_ORDER = [
    'Awarded - Delivered',
    'Awarded - Contracted',
    'Verbal Award',
    'Near Win',
    'Qualified Opportunity',
    'Greenlit/Potential',
    'Hold',
    'Lost'
];
const stageRank = (s) => {
    const i = STAGE_ORDER.indexOf(s);
    return i === -1 ? STAGE_ORDER.length : i;
};
export const compareStages = (a, b) => {
    const r = stageRank(a) - stageRank(b);
    if (r !== 0) return r;
    if (a === UNSPECIFIED_STAGE) return 1;
    if (b === UNSPECIFIED_STAGE) return -1;
    return a.localeCompare(b);
};

// --- Event extraction ---------------------------------------------------------------

export function buildProjectionEvents({ projects = [] } = {}) {
    const events = [];
    projects.forEach(p => {
        const dims = {
            stage: text(p['deal_stage']) || UNSPECIFIED_STAGE,
            blockStage: text(p['Block_Stage']),
            region: text(p['Region']) || text(p['Region Type']),
            office: text(p['Office']) || text(p['Contracting_Office']),
            client: text(p['Client']),
            block: text(p['Project Name']),
            blockId: text(p['Project ID']) || text(p['Block_id']),
            closeDate: parseDate(p['Close Date']),
            bizPoc: text(p['Biz Poc']) || text(p['BizPoC'])
        };
        (p.projections || []).forEach(proj => {
            // A pending, unapproved deletion is not live pipeline -- see module doc comment.
            if (text(proj['Change Type']).toLowerCase() === 'delete') return;
            const date = parseDate(proj['Projection date']);
            const usd = num(proj['Amount in USD'] ?? proj['Amount'] ?? proj['Value']);
            events.push({
                date, usd, inr: toInr(usd),
                ...dims,
                projectionId: text(proj['Projection ID'])
            });
        });
    });
    return events;
}

// --- Aggregation ----------------------------------------------------------------------

const inList = (list, value) => !list || list.length === 0 || list.includes(value);

// undefined -> event excluded by a filter (or has no date);  null -> in scope but the period
// picker or the clipped column range does not cover it;  otherwise the matching column.
function scopeColumnFor(e, scope, { yearType, yearLabel, yearLabels, regions, offices, blockStages, months }) {
    if (!inList(regions, e.region)) return undefined;
    if (!inList(offices, e.office)) return undefined;
    if (!inList(blockStages, e.blockStage)) return undefined;
    if (!e.date) return undefined;
    // FY/CY is a multi-select: an event counts if its year is ANY of the ones picked.
    const years = normalizeYears(yearLabel, yearLabels);
    const evYear = yearType === 'CY' ? getCY(e.date) : getFY(e.date);
    if (years.length === 0 || !years.includes(evYear)) return undefined;
    if (months && months.length > 0 && !months.includes(getMonthShort(e.date))) return undefined;
    const col = scope.scopedColumns.find(c => e.date >= c.from && e.date <= c.to);
    if (col && !scope.shown.has(col.key)) return undefined;
    return col || null;
}

export function aggregateBusinessProjection({
    events = [],
    yearType = 'FY',
    yearLabel,
    // FY/CY is a multi-select: picking more than one year concatenates their columns end to
    // end (see buildPeriodScope). yearLabel (singular) still works for a single year.
    yearLabels,
    viewMode = 'month',
    currency = 'USD',
    regions = [],
    offices = [],
    blockStages = [],
    months = [],
    // Deal Stage acts as a ROW filter here (this table's row grouping IS deal_stage), not a
    // data filter: selecting stages narrows which rows appear, rather than narrowing the
    // pool of events every row draws from. Region/Office/Block Stage/Month behave like every
    // other filter in this app instead, narrowing the underlying events.
    dealStages = [],
    periods = []
} = {}) {
    const scope = buildPeriodScope({ yearType, yearLabel, yearLabels, viewMode, months, periods });
    const { columns } = scope;
    const amountOf = (e) => (currency === 'INR' ? e.inr : e.usd);
    const filters = { yearType, yearLabel, yearLabels, regions, offices, blockStages, months };

    const blank = () => {
        const cells = {};
        columns.forEach(c => { cells[c.key] = 0; });
        return { cells, total: 0, undated: 0 };
    };

    const byStage = new Map();
    const grandTotal = blank();
    let undatedSeen = false;

    events.forEach(e => {
        const col = scopeColumnFor(e, scope, filters);
        if (col === undefined) return;
        const value = amountOf(e);

        if (!value) {
            if (!byStage.has(e.stage)) byStage.set(e.stage, blank());
            return;
        }

        if (!byStage.has(e.stage)) byStage.set(e.stage, blank());
        const row = byStage.get(e.stage);

        if (col) {
            row.cells[col.key] += value;
            grandTotal.cells[col.key] += value;
        } else {
            row.undated += value;
            grandTotal.undated += value;
            undatedSeen = true;
        }
        row.total += value;
        grandTotal.total += value;
    });

    const stagesPresent = [...byStage.keys()].sort(compareStages);
    // An explicitly selected stage renders even with nothing in it, so picking it visibly
    // does something instead of appearing to be ignored -- the same courtesy Revenue
    // Operations' stage split gives a selected-but-empty stage.
    const rowStages = dealStages.length > 0
        ? [...new Set([...dealStages])].sort(compareStages)
        : stagesPresent;

    const rows = rowStages.map(stage => ({ stage, ...(byStage.get(stage) || blank()) }));

    return {
        columns,
        periodOptions: scope.scopedColumns.map(c => ({ value: c.key, label: c.head, sub: c.sub })),
        showUndated: undatedSeen,
        stagesPresent,
        rows,
        grandTotal
    };
}

// The rows behind one Business Projection cell, mirroring revenueOpsCellRows: pass
// columnKey null for a Deal Stage row's Total column (which also picks up anything
// undated), and stage null for the grand Total row (every Deal Stage).
export const PROJECTION_DETAIL_COLUMNS = [
    { key: 'date', label: 'Projected Date', type: 'date' },
    { key: 'block', label: 'Block Name', type: 'text' },
    { key: 'amount', label: 'Amount', type: 'money' },
    { key: 'bizPoc', label: 'Biz PoC', type: 'text', optional: true }
];

export function projectionCellRows({
    events = [],
    columnKey = null,
    stage = null,
    // Narrows to one project (see aggregateProjectionBlocks) so its own block-level
    // breakdown can drill into the same rows a stage-level figure would, just for that one
    // block instead of every block in the stage.
    blockId = null,
    currency = 'USD',
    yearType = 'FY',
    yearLabel,
    yearLabels,
    viewMode = 'month',
    regions = [],
    offices = [],
    blockStages = [],
    months = [],
    periods = []
} = {}) {
    const scope = buildPeriodScope({ yearType, yearLabel, yearLabels, viewMode, months, periods });
    const filters = { yearType, yearLabel, yearLabels, regions, offices, blockStages, months };
    const rows = [];

    events.forEach(e => {
        if (stage && e.stage !== stage) return;
        if (blockId && (e.blockId || e.block) !== blockId) return;
        const col = scopeColumnFor(e, scope, filters);
        if (col === undefined) return;
        if (columnKey !== null && (!col || col.key !== columnKey)) return;
        const amount = currency === 'INR' ? e.inr : e.usd;
        if (!amount) return;
        rows.push({
            date: e.date,
            amount,
            block: e.block || '',
            bizPoc: e.bizPoc || ''
        });
    });

    rows.sort((a, b) => (a.date - b.date) || (b.amount - a.amount));
    return rows;
}

// The blocks (projects) behind a Deal Stage row, broken down period by period exactly like
// the Deal Stage row itself -- same columns object, same Total/Undated shape -- just grouped
// by block instead of summed into one stage total, since one project can carry several
// projection lines landing in different months. Sorted by Close Date, most recent first; a
// block with no Close Date yet sorts last rather than dropping out.
export function aggregateProjectionBlocks({
    events = [],
    stage = null,
    yearType = 'FY',
    yearLabel,
    yearLabels,
    viewMode = 'month',
    currency = 'USD',
    regions = [],
    offices = [],
    blockStages = [],
    months = [],
    periods = []
} = {}) {
    const scope = buildPeriodScope({ yearType, yearLabel, yearLabels, viewMode, months, periods });
    const { columns } = scope;
    const amountOf = (e) => (currency === 'INR' ? e.inr : e.usd);
    const filters = { yearType, yearLabel, yearLabels, regions, offices, blockStages, months };

    const blank = () => {
        const cells = {};
        columns.forEach(c => { cells[c.key] = 0; });
        return { cells, total: 0, undated: 0 };
    };

    const byBlock = new Map();
    let undatedSeen = false;

    events.forEach(e => {
        if (stage && e.stage !== stage) return;
        const col = scopeColumnFor(e, scope, filters);
        if (col === undefined) return;
        const value = amountOf(e);
        if (!value) return;
        const key = e.blockId || e.block;
        if (!key) return;
        if (!byBlock.has(key)) {
            byBlock.set(key, { block: e.block || 'Untitled', blockId: key, closeDate: e.closeDate || null, ...blank() });
        }
        const row = byBlock.get(key);
        if (col) {
            row.cells[col.key] += value;
        } else {
            row.undated += value;
            undatedSeen = true;
        }
        row.total += value;
    });

    const rows = [...byBlock.values()];
    rows.sort((a, b) => {
        if (!a.closeDate && !b.closeDate) return b.total - a.total;
        if (!a.closeDate) return 1;
        if (!b.closeDate) return -1;
        return b.closeDate - a.closeDate;
    });

    return { columns, showUndated: undatedSeen, rows };
}

// Distinct filter values, taken from the events so the lists always match what the table
// can actually show.
export function businessProjectionFilterOptions(events = []) {
    const regions = new Set(), offices = new Set(), blockStages = new Set(), dealStages = new Set();
    const fys = new Set(), cys = new Set();
    events.forEach(e => {
        if (e.region) regions.add(e.region);
        if (e.office) offices.add(e.office);
        if (e.blockStage) blockStages.add(e.blockStage);
        dealStages.add(e.stage);
        if (e.date) { fys.add(getFY(e.date)); cys.add(getCY(e.date)); }
    });
    const byYearDesc = (a, b) => String(b).localeCompare(String(a));
    return {
        regions: [...regions].sort(),
        offices: [...offices].sort(),
        blockStages: [...blockStages].sort(),
        dealStages: [...dealStages].sort(compareStages),
        fys: [...fys].sort(byYearDesc),
        cys: [...cys].sort(byYearDesc)
    };
}

export { getYearRange, buildPeriodColumns };
