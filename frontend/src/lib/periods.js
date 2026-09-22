import { MONTHS_SHORT } from "./utils";

// Financial/calendar year period columns (Week / Month / Quarter), shared by every table in
// this app that buckets money by time -- Revenue Operations and Business Projection both use
// this, so a fix made once (e.g. how a week column is labelled) applies everywhere at once.

// 'FY-26' -> 1 Apr 2026 to 31 Mar 2027;  'CY-26' -> 1 Jan 2026 to 31 Dec 2026.
export function getYearRange(yearType, yearLabel) {
    const yy = parseInt(String(yearLabel || '').slice(-2), 10);
    if (!Number.isFinite(yy)) return null;
    const y = 2000 + yy;
    return yearType === 'CY'
        ? { start: new Date(y, 0, 1), end: new Date(y, 11, 31) }
        : { start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31) };
}

const startOfWeek = (d) => {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() - ((out.getDay() + 6) % 7)); // Monday
    return out;
};
const isoKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "06 Sep" -- day and month, zero padded so a column of them lines up.
const dayMon = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]}`;

// A day span, in the shortest form that stays unambiguous: "06 Sep" for a single day,
// "07 - 13 Sep" inside one month, "31 Aug - 06 Sep" across two.
const spanHead = (a, b) => {
    if (a.getTime() === b.getTime()) return dayMon(a);
    return (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
        ? `${String(a.getDate()).padStart(2, '0')} - ${dayMon(b)}`
        : `${dayMon(a)} - ${dayMon(b)}`;
};

// The year, or both years when a span crosses new year.
const spanSub = (a, b) => a.getFullYear() === b.getFullYear()
    ? String(a.getFullYear())
    : `${a.getFullYear()} / ${b.getFullYear()}`;

// One column per calendar day between two dates, inclusive. Exported so Cashflow can expand
// a single selected week into its own seven daily columns without this module knowing
// anything about weeks-to-days at all -- it just builds days for whatever range it is given.
export function buildDayColumns(from, to) {
    const cols = [];
    const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    while (cur <= end) {
        const d = new Date(cur);
        cols.push({
            key: isoKey(d),
            label: `${dayMon(d)} ${d.getFullYear()}`,
            head: dayMon(d),
            sub: String(d.getFullYear()),
            from: d, to: d
        });
        cur.setDate(cur.getDate() + 1);
    }
    return cols;
}

export function buildPeriodColumns({ yearType = 'FY', yearLabel, viewMode = 'month' } = {}) {
    const range = getYearRange(yearType, yearLabel);
    if (!range) return [];
    const { start, end } = range;
    const cols = [];

    if (viewMode === 'month') {
        const cur = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cur <= end) {
            const from = new Date(cur.getFullYear(), cur.getMonth(), 1);
            const to = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
            cols.push({
                key: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`,
                label: `${MONTHS_SHORT[from.getMonth()]} ${from.getFullYear()}`,
                sub: String(from.getFullYear()),
                head: MONTHS_SHORT[from.getMonth()],
                from, to
            });
            cur.setMonth(cur.getMonth() + 1);
        }
    } else if (viewMode === 'quarter') {
        for (let i = 0; i < 4; i++) {
            const from = new Date(start.getFullYear(), start.getMonth() + i * 3, 1);
            const to = new Date(start.getFullYear(), start.getMonth() + i * 3 + 3, 0);
            cols.push({
                // Year-qualified so two years selected at once (see buildPeriodScope) never
                // collide on a bare "Q1" -- month/week/date keys are already date-based and
                // don't need this.
                key: `${yearLabel}-Q${i + 1}`,
                label: `Q${i + 1} ${yearLabel}`,
                sub: `${MONTHS_SHORT[from.getMonth()]} - ${MONTHS_SHORT[to.getMonth()]}`,
                head: `Q${i + 1}`,
                from, to
            });
        }
    } else if (viewMode === 'date') {
        // One column per calendar day across the whole year -- added purely alongside the
        // three above rather than replacing the week fallback below.
        cols.push(...buildDayColumns(start, end));
    } else {
        let cur = startOfWeek(start);
        while (cur <= end) {
            const to = new Date(cur);
            to.setDate(to.getDate() + 6);
            // A week is named by the span it covers, not by its first day.
            cols.push({
                key: isoKey(cur),
                label: `${dayMon(cur)} ${cur.getFullYear()} - ${dayMon(to)} ${to.getFullYear()}`,
                head: spanHead(cur, to),
                sub: spanSub(cur, to),
                from: new Date(cur), to
            });
            cur = new Date(cur);
            cur.setDate(cur.getDate() + 7);
        }
    }
    return cols;
}

// Quarter labels carry the year in their existing label, so reuse it rather than re-deriving.
const yearLabelOf = (col) => String(col.label || '').replace(/^Q\d\s*/, '');

// Every column is labelled by the days it actually counts, never by the days its calendar
// period nominally covers. Without this the heading promises more than the figure beneath
// it: under Month = Sep the week "31 Aug - 06 Sep" counts only 01 - 06 Sep, and the first
// week of a financial year starts before the year does. Only the LABEL is narrowed here --
// the arithmetic is untouched, because out-of-scope events are already excluded by the year
// and month tests the caller applies separately. That keeps each month additive: Aug + Sep
// still equals Aug & Sep, which widening the values to whole weeks would have broken by
// counting a boundary day in both months.
export function clipColumnsToScope(columns, range, months, viewMode) {
    const out = [];
    columns.forEach(col => {
        const kept = [];
        let span = 0;
        const cur = new Date(col.from.getFullYear(), col.from.getMonth(), col.from.getDate());
        while (cur <= col.to) {
            span++;
            const inYear = cur >= range.start && cur <= range.end;
            const inMonth = !months || months.length === 0 || months.includes(MONTHS_SHORT[cur.getMonth()]);
            if (inYear && inMonth) kept.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }
        if (kept.length === 0) return;              // counts nothing, so it earns no column
        if (kept.length === span) { out.push(col); return; }   // wholly in scope, leave alone

        const first = kept[0], last = kept[kept.length - 1];
        const clipped = { ...col, from: first, to: last, partial: true };
        if (viewMode === 'week') {
            clipped.head = spanHead(first, last);
            clipped.sub = spanSub(first, last);
            clipped.label = `${dayMon(first)} ${first.getFullYear()} - ${dayMon(last)} ${last.getFullYear()}`
                + ` (part of the week ${col.head} ${col.sub})`;
        } else if (viewMode === 'quarter') {
            // Name the months still in scope. A gap means the Month filter skipped one, so
            // they are listed rather than implied as a range.
            const idx = [...new Set(kept.map(d => d.getMonth()))];
            const gapless = idx.every((m, i) => i === 0 || m === idx[i - 1] + 1);
            clipped.sub = idx.length === 1
                ? MONTHS_SHORT[idx[0]]
                : gapless
                    ? `${MONTHS_SHORT[idx[0]]} - ${MONTHS_SHORT[idx[idx.length - 1]]}`
                    : idx.map(m => MONTHS_SHORT[m]).join(', ');
            clipped.label = `${col.head} ${yearLabelOf(col)} (${clipped.sub} only)`;
        }
        out.push(clipped);
    });
    return out;
}

// Accepts either the original singular `yearLabel` or a plural `yearLabels` array (every
// table's FY/CY pills are now a multi-select) and normalizes to one list of years to build
// columns for. Kept as its own helper because every one of the three scopeColumnFor
// functions across revenueOps.js/cashflow.js/businessProjection.js needs the identical
// normalization to test year membership the same way this module builds columns for it.
export function normalizeYears(yearLabel, yearLabels) {
    if (yearLabels && yearLabels.length > 0) return yearLabels;
    return yearLabel ? [yearLabel] : [];
}

// The column layout for one selection: every column the year/month scope allows
// (scopedColumns, also what a period picker should offer), and the subset actually shown
// once a period picker has narrowed it further (columns). Dimension-specific filtering
// (which office, which stage, ...) is the caller's own concern -- this function only knows
// about time.
//
// Multiple years selected at once (yearLabels) simply concatenate their columns end to end,
// sorted chronologically -- picking FY-25 and FY-26 together shows both years' worth of
// columns in one table, Apr-25 through Mar-27, rather than either replacing the other.
export function buildPeriodScope({ yearType = 'FY', yearLabel, yearLabels, viewMode = 'month', months = [], periods = [] } = {}) {
    const years = normalizeYears(yearLabel, yearLabels);
    const scopedColumns = years
        .flatMap(yl => {
            const range = getYearRange(yearType, yl);
            return range ? clipColumnsToScope(buildPeriodColumns({ yearType, yearLabel: yl, viewMode }), range, months, viewMode) : [];
        })
        .sort((a, b) => a.from - b.from);
    const columns = periods && periods.length > 0
        ? scopedColumns.filter(c => periods.includes(c.key))
        : scopedColumns;
    return { scopedColumns, columns, shown: new Set(columns.map(c => c.key)) };
}
