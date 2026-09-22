import { useState, useMemo, useEffect } from "react";
import { Wallet, Search, X } from "lucide-react";
import { MultiSelect } from "./ui/MultiSelect";
import CashflowDetailModal from "./CashflowDetailModal";
import { getFY, getCY, MONTHS_SHORT, MONTHS_SHORT_FY, defaultOfficesFrom, sameValues } from "../lib/utils";
import {
    buildCashflowEvents,
    aggregateCashflow,
    cashflowFilterOptions,
    cashflowCellRows,
    cashflowKpis,
    COLOR_RECEIVED,
    COLOR_PARTIAL,
    COLOR_UPCOMING,
    COLOR_OVERDUE,
    COLOR_UNDATED,
    COLOR_LABELS,
    UNDATED_KEY
} from "../lib/cashflow";

// Cashflow: when does money actually move for a Project or Client, and has it landed yet?
// Same filter row and frozen-column language as Revenue Operations and Business Projection
// (see those files) so all three tabs read as one system, but its own pure module
// (lib/cashflow.js) so nothing here can disturb either of their own numbers.
// Date and Week are the two modes with a period picker beside them -- and both pickers offer
// weeks to choose from. In Week mode picking a week narrows which single aggregated weekly
// column shows; in Date mode picking a week narrows the year's ~365 daily columns down to
// just that week's 7 days, which is how you see every day of a week without hand-picking
// individual dates.
const VIEW_MODES = [
    { key: 'date', label: 'Date' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' }
];

// Undated is the one entry whose colour is not a Tailwind token: #2E3532, its own shade so
// money with no date to place it on never reads as one of the four dated states. It is dark
// enough that it can only work as the chip's FILL (with the app's normal light text over
// it) rather than as coloured text the way the other four are drawn.
const UNDATED_HEX = '#2E3532';

// A third entry ([tailwind class, hex]) lets a legend item use a plain hex dot instead of a
// Tailwind one, which Undated needs since #2E3532 is not a Tailwind token.
const LEGEND = [
    [COLOR_RECEIVED, 'bg-emerald-400'],
    [COLOR_PARTIAL, 'bg-yellow-400'],
    [COLOR_UPCOMING, 'bg-blue-400'],
    [COLOR_OVERDUE, 'bg-red-400'],
    [COLOR_UNDATED, null, UNDATED_HEX]
];

const GROUP_MODES = [
    { key: 'project', label: 'Project' },
    { key: 'client', label: 'Client' }
];

// Green/blue reused verbatim from the badge classes already established elsewhere in this
// app (Finance Hub's Payment_status badges, and FinancePage's own blue "Invoiced" badge),
// so a coloured cell here means the same thing it means everywhere else.
const COLOR_CLASSES = {
    [COLOR_RECEIVED]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
    [COLOR_PARTIAL]: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
    [COLOR_UPCOMING]: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
};
const colorClass = (color) => COLOR_CLASSES[color] || 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20';

export default function CashflowTable({ finances }) {
    const [groupBy, setGroupBy] = useState('project');
    const [viewMode, setViewMode] = useState('month');
    const [yearType, setYearType] = useState('FY');
    const [currency, setCurrency] = useState('INR');
    // null means "not yet defaulted" -- filled in below, once the offices in the data are
    // known, to PhantomFX's own three delivery offices (same convention as every other
    // Executive Hub tab).
    const [selectedOffices, setSelectedOffices] = useState(null);
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedPocs, setSelectedPocs] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    // Empty means every stage counts. Unlike Revenue Operations' Stage Split, this narrows
    // the one table down rather than adding a table per stage.
    const [selectedStages, setSelectedStages] = useState([]);
    const [selectedPeriods, setSelectedPeriods] = useState([]);
    // Empty means "not yet touched" -- defaulted below to the current year, same as the old
    // single-select did. Once the user picks any year pill, this holds every year they have
    // toggled on; FY/CY pills are a multi-select so more than one can be active together.
    const [yearLabels, setYearLabels] = useState([]);
    // Legend entries selected by clicking them. Empty means every state shows, so the legend
    // still reads as a plain key until it is actually used as a filter; one or more selected
    // isolates the table down to just those.
    const [selectedColors, setSelectedColors] = useState([]);
    // Typed into the box beside the Project/Client header, matched against the row label.
    const [search, setSearch] = useState('');
    // The cell (or KPI card) whose invoices are being inspected:
    // { rowKey, columnKey, columnLabel, kind? }. rowKey null is the table's own Total row;
    // columnKey null is a row's Total column; a KPI card sets both null plus a kind
    // ('receivable' | 'receipt') so the modal lists every leg of that kind, table-wide.
    const [detail, setDetail] = useState(null);

    const events = useMemo(() => buildCashflowEvents({ finances }), [finances]);
    const options = useMemo(() => cashflowFilterOptions(events), [events]);

    useEffect(() => {
        if (selectedOffices === null && options.offices.length > 0) {
            setSelectedOffices(defaultOfficesFrom(options.offices));
        }
    }, [options.offices, selectedOffices]);
    const offices = selectedOffices || [];

    const yearChoices = yearType === 'CY' ? options.cys : options.fys;
    // The validated set actually in effect: whatever of yearLabels is still a real choice
    // (a stale year survives a FY/CY switch otherwise), falling back to the current year --
    // exactly the old single-select's default -- whenever nothing valid is left picked.
    const activeYears = useMemo(() => {
        const valid = yearLabels.filter(y => yearChoices.includes(y));
        if (valid.length > 0) return valid;
        const today = new Date();
        const current = yearType === 'CY' ? getCY(today) : getFY(today);
        if (yearChoices.includes(current)) return [current];
        return yearChoices[0] ? [yearChoices[0]] : [];
    }, [yearLabels, yearChoices, yearType]);
    // Toggles against what is CURRENTLY shown active (activeYears), not the raw state, so
    // the very first click -- while yearLabels is still empty and a year is only active by
    // default -- adds to or removes from what the user actually sees highlighted.
    const toggleYear = (y) => setYearLabels(
        activeYears.includes(y) ? activeYears.filter(x => x !== y) : [...activeYears, y]);
    // "FY-26" alone, or "FY-25 + FY-26" once more than one is active -- used everywhere the
    // old single activeYear string was shown to the user.
    const yearsDisplay = activeYears.join(' + ');

    // The columns in scope depend on year/view/month, so a stale week/date key is dropped
    // rather than silently emptying the table -- same guard the other two tabs use.
    const periodOptions = useMemo(() => aggregateCashflow({
        events, groupBy, yearType, yearLabels: activeYears, viewMode, currency,
        offices, regions: selectedRegions, pocs: selectedPocs, months: selectedMonths
    }).periodOptions, [events, groupBy, yearType, activeYears, viewMode, currency, offices, selectedRegions, selectedPocs, selectedMonths]);

    const activePeriods = useMemo(() => {
        const valid = new Set(periodOptions.map(o => o.value));
        return selectedPeriods.filter(k => valid.has(k));
    }, [selectedPeriods, periodOptions]);

    const grid = useMemo(() => aggregateCashflow({
        events,
        groupBy,
        yearType,
        yearLabels: activeYears,
        viewMode,
        currency,
        offices,
        regions: selectedRegions,
        pocs: selectedPocs,
        months: selectedMonths,
        stages: selectedStages,
        periods: activePeriods,
        selectedColors,
        search
    }), [events, groupBy, yearType, activeYears, viewMode, currency, offices, selectedRegions,
        selectedPocs, selectedMonths, selectedStages, activePeriods, selectedColors, search]);

    // The 4 headline numbers above the table -- same filters and period narrowing as the
    // grid, so they always describe exactly what's on screen, independent of Project/Client
    // grouping (groupBy is deliberately left out; a KPI is one number for the whole table).
    const kpis = useMemo(() => cashflowKpis({
        events,
        yearType,
        yearLabels: activeYears,
        viewMode,
        currency,
        offices,
        regions: selectedRegions,
        pocs: selectedPocs,
        stages: selectedStages,
        months: selectedMonths,
        periods: activePeriods,
        selectedColors,
        groupBy,
        search
    }), [events, yearType, activeYears, viewMode, currency, offices, selectedRegions,
        selectedPocs, selectedStages, selectedMonths, activePeriods, selectedColors, groupBy, search]);

    // Recomputed through cashflowCellRows, which shares its scope test with the grid, so the
    // list always adds up to the figure that was clicked.
    const detailRows = useMemo(() => detail ? cashflowCellRows({
        events,
        groupBy,
        rowKey: detail.rowKey,
        columnKey: detail.columnKey,
        kind: detail.kind || null,
        currency,
        yearType,
        yearLabels: activeYears,
        viewMode,
        offices,
        regions: selectedRegions,
        pocs: selectedPocs,
        stages: selectedStages,
        months: selectedMonths,
        periods: activePeriods,
        selectedColors,
        search
    }) : [], [detail, events, groupBy, currency, yearType, activeYears, viewMode, offices,
        selectedRegions, selectedPocs, selectedStages, selectedMonths, activePeriods,
        selectedColors, search]);

    const symbol = currency === 'INR' ? '₹' : '$';
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    const money = (n) => `${symbol}${Math.round(n || 0).toLocaleString(locale)}`;
    // The Undated column gets its own colour (#2E3532) rather than one of the four dated
    // states, so money with no date to place it on always reads as something to go and fix
    // rather than as received, receivable, partly paid or past due. Clickable like every
    // other figure, isolating just this row's undated legs via UNDATED_KEY.
    const undatedFigure = (v, rowKey, bold) => {
        const n = Math.round(v || 0);
        if (n === 0) return <span className="text-gray-600">-</span>;
        return (
            <button
                type="button"
                onClick={() => setDetail({ rowKey, columnKey: UNDATED_KEY, columnLabel: 'Undated' })}
                title={`${COLOR_LABELS[COLOR_UNDATED]} · no date recorded to place this on · Show the invoices behind this figure`}
                className={`block w-full text-right px-2 py-1 rounded border text-xs tabular-nums text-gray-200 transition-colors hover:brightness-125 ${bold ? 'font-bold' : 'font-semibold'}`}
                style={{
                    backgroundColor: UNDATED_HEX,
                    borderColor: 'rgba(255, 255, 255, 0.14)'
                }}
            >
                {money(n)}
            </button>
        );
    };

    // The Total column is always clickable, in the same plain underlined-money style
    // Revenue Operations and Business Projection use for their own Total column -- unlike a
    // period cell, a whole year of invoices does not reduce to one meaningful colour.
    const totalFigure = (v, rowKey) => {
        const n = Math.round(v || 0);
        if (n === 0) return <span className="text-gray-600">-</span>;
        return (
            <button
                type="button"
                onClick={() => setDetail({ rowKey, columnKey: null, columnLabel: `${yearsDisplay} total` })}
                title="Show the invoices behind this figure"
                className="underline decoration-dotted decoration-transparent underline-offset-4 hover:text-primary hover:decoration-primary/60 transition-colors"
            >
                {money(n)}
            </button>
        );
    };

    // A period cell carries the aggregate colour of every leg landing in it: green once
    // everything in it has actually been received, blue while it is all still ahead of its
    // expected date, red once it is all overdue and unreceived, yellow for anything in
    // between (including a partially received invoice's own two legs). A cell with nothing
    // in it stays a plain dash rather than a dead, colourless button.
    const figure = (v, color, rowKey, columnKey, columnLabel) => {
        const n = Math.round(v || 0);
        if (n === 0 || !color) return <span className="text-gray-600">-</span>;
        return (
            <button
                type="button"
                onClick={() => setDetail({ rowKey, columnKey, columnLabel })}
                title={`${COLOR_LABELS[color] || ''} · Show the invoices behind this figure`}
                className={`block w-full text-right px-2 py-1 rounded border text-xs font-semibold tabular-nums transition-colors ${colorClass(color)}`}
            >
                {money(n)}
            </button>
        );
    };

    const monthChoices = yearType === 'FY' ? MONTHS_SHORT_FY : MONTHS_SHORT;
    const officesIsDefault = selectedOffices === null
        || sameValues(selectedOffices, defaultOfficesFrom(options.offices));
    const hasFilters = !officesIsDefault || selectedRegions.length || selectedPocs.length
        || selectedMonths.length || selectedStages.length || activePeriods.length
        || selectedColors.length || search.trim();
    const clearFilters = () => {
        setSelectedOffices(defaultOfficesFrom(options.offices));
        setSelectedRegions([]);
        setSelectedPocs([]);
        setSelectedMonths([]);
        setSelectedStages([]);
        setSelectedPeriods([]);
        setSelectedColors([]);
        setSearch('');
    };
    // Added on click, removed on a second click -- a plain multi-select isolate filter: with
    // nothing selected everything shows; clicking one or more narrows the table down to just
    // those states.
    const toggleColor = (color) => setSelectedColors(prev =>
        prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);

    const toggleClass = (on) =>
        `px-3 py-1 text-xs font-bold rounded-md transition-colors ${on ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`;

    const rowTypeLabel = groupBy === 'client' ? 'Client' : 'Project';
    // Both Date and Week modes get the Week picker beside them (see VIEW_MODES above).
    const isDateOrWeek = viewMode === 'date' || viewMode === 'week';

    // Row/Total columns are frozen against horizontal scroll, matching the other two tabs.
    // The row column is wider than theirs (280 rather than 220) to seat the search box
    // beside its own heading; every sticky offset below therefore pins at 280px.
    const COL_ROW = 'w-[280px] min-w-[280px] max-w-[280px]';
    const COL_TOTAL = 'w-[140px] min-w-[140px] max-w-[140px]';

    // One Project/Client table: a banner row, one row per project or client, and a bold
    // Total row.
    const Table = ({ title, rows, grandTotal }) => (
        <>
            <tr className="border-y border-white/20">
                <th
                    colSpan={2}
                    className="sticky left-0 z-20 text-left px-4 py-2 font-bold text-[11px] uppercase tracking-wider whitespace-nowrap bg-[#1A1A1A] text-white"
                >
                    {title}
                </th>
                <th
                    colSpan={grid.columns.length + (grid.showUndated ? 1 : 0)}
                    className="bg-white/[0.07]"
                ></th>
            </tr>
            {rows.length === 0 ? (
                <tr>
                    <td colSpan={2 + grid.columns.length + (grid.showUndated ? 1 : 0)} className="px-4 py-6 text-center text-xs text-gray-500">
                        No invoices for this selection.
                    </td>
                </tr>
            ) : rows.map(row => (
                <tr key={row.key} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <th
                        scope="row"
                        className="sticky left-0 z-10 text-left px-4 py-2 whitespace-nowrap border-r border-white/10 bg-[#0A0A0A] font-medium text-gray-300"
                    >
                        {row.key}
                    </th>
                    <td className="sticky left-[280px] z-10 px-4 py-2 text-right tabular-nums whitespace-nowrap border-r border-white/10 font-bold bg-[#0A0A0A] text-gray-100">
                        {totalFigure(row.total, row.key)}
                    </td>
                    {grid.columns.map(c => (
                        <td key={c.key} className="px-2 py-1.5 text-right whitespace-nowrap">
                            {figure(row.cells[c.key], row.cellColor[c.key], row.key, c.key, `${c.head} ${c.sub}`)}
                        </td>
                    ))}
                    {grid.showUndated && (
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            {undatedFigure(row.undated, row.key)}
                        </td>
                    )}
                </tr>
            ))}
            <tr className="border-t border-t-white/[0.14] bg-white/[0.04]">
                <th className="sticky left-0 z-10 text-left px-4 py-2 whitespace-nowrap border-r border-white/10 bg-[#101010] font-bold text-white">
                    Total
                </th>
                <td className="sticky left-[280px] z-10 px-4 py-2 text-right tabular-nums whitespace-nowrap border-r border-white/10 font-bold bg-[#101010] text-white">
                    {totalFigure(grandTotal.total, null)}
                </td>
                {grid.columns.map(c => (
                    <td key={c.key} className="px-2 py-1.5 text-right whitespace-nowrap">
                        {figure(grandTotal.cells[c.key], grandTotal.cellColor[c.key], null, c.key, `${c.head} ${c.sub}`)}
                    </td>
                ))}
                {grid.showUndated && (
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {undatedFigure(grandTotal.undated, null, true)}
                    </td>
                )}
            </tr>
        </>
    );

    return (
        <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex flex-wrap justify-between items-start bg-dark-900 shrink-0 gap-4">
                <div className="flex-1 min-w-[200px]">
                    <h2 className="text-2xl font-bold text-white leading-tight mb-1 flex items-center gap-3">
                        <Wallet className="text-primary" />
                        Cashflow
                    </h2>
                    <div className="text-sm text-gray-400">
                        {activeYears.length > 0
                            ? `${yearsDisplay} · ${viewMode === 'date' ? 'Daily' : `${VIEW_MODES.find(v => v.key === viewMode).label}ly`} · ${currency} · By ${rowTypeLabel}`
                            : 'No receivables available'}
                    </div>
                </div>
                {/* The legend is also the filter: with nothing selected, every entry shows and
                    the legend reads as a plain key. Clicking one or more isolates the table
                    down to just those states -- click an already-selected entry again to drop
                    it, and Clear Filters (or unselecting the last one) brings everything back. */}
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 shrink-0 max-w-full sm:max-w-xs">
                    {LEGEND.map(([color, dot, hex]) => {
                        const isolated = selectedColors.includes(color);
                        // Dimmed only once a selection is active AND this entry isn't part of
                        // it -- with nothing selected, everything reads as fully shown.
                        const dimmed = selectedColors.length > 0 && !isolated;
                        return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => toggleColor(color)}
                                title={isolated
                                    ? `Showing only ${COLOR_LABELS[color]}${selectedColors.length > 1 ? ' (and the rest selected)' : ''} — click to remove it`
                                    : selectedColors.length > 0
                                        ? `Also show ${COLOR_LABELS[color]}`
                                        : `Show only ${COLOR_LABELS[color]}`}
                                className={`flex items-center gap-1.5 text-[11px] whitespace-nowrap transition-colors ${dimmed
                                    ? 'text-gray-600 line-through'
                                    : 'text-gray-400 hover:text-white'}`}
                            >
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${dot || ''} ${dimmed ? 'opacity-30' : ''}`}
                                    style={hex ? {
                                        backgroundColor: hex,
                                        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.35)'
                                    } : undefined}
                                ></span>
                                {COLOR_LABELS[color]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Controls -- its own stacking context (relative + z-index), raised above the
                Table below, so an open filter dropdown always paints over the table rather
                than getting tucked behind it once the filters stack to one column on
                mobile. */}
            <div className="relative z-30 px-6 pt-5 pb-4 border-b border-white/10 bg-dark-900/60 shrink-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/5">
                        {GROUP_MODES.map(g => (
                            <button key={g.key} onClick={() => setGroupBy(g.key)} className={toggleClass(groupBy === g.key)}>
                                {g.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-white/10 hidden md:block"></div>

                    <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/5">
                        {VIEW_MODES.map(v => (
                            <button
                                key={v.key}
                                onClick={() => { setViewMode(v.key); setSelectedPeriods([]); }}
                                className={toggleClass(viewMode === v.key)}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-white/10 hidden md:block"></div>

                    <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/5">
                        {['FY', 'CY'].map(t => (
                            <button
                                key={t}
                                onClick={() => { setYearType(t); setYearLabels([]); setSelectedMonths([]); setSelectedPeriods([]); }}
                                className={toggleClass(yearType === t)}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Multi-select: click a year to add it to the ones already active, click
                        an active one again to drop it. Unpicking the last one snaps back to
                        the current year (see activeYears) rather than showing nothing. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {yearChoices.map(y => (
                            <button
                                key={y}
                                onClick={() => toggleYear(y)}
                                title={activeYears.includes(y) ? `Remove ${y}` : `Add ${y}`}
                                className={`text-[10px] px-2 py-1 rounded border transition-all ${activeYears.includes(y)
                                    ? 'bg-pink-500 text-white border-pink-500 font-bold'
                                    : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-white/10 hidden md:block"></div>

                    <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/5">
                        {['INR', 'USD'].map(c => (
                            <button key={c} onClick={() => setCurrency(c)} className={toggleClass(currency === c)}>
                                {c}
                            </button>
                        ))}
                    </div>

                    {hasFilters ? (
                        <button
                            onClick={clearFilters}
                            className="ml-auto text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Clear Filters
                        </button>
                    ) : null}
                </div>

                {/* Each filter's wrapper carries a DESCENDING z-index by position -- an
                    earlier filter's open dropdown must paint over every filter below it
                    once the row stacks to one column on mobile. */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${isDateOrWeek ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
                    <div className="relative z-[60]">
                        <MultiSelect
                            label="Stage"
                            options={options.stages}
                            value={selectedStages}
                            onChange={setSelectedStages}
                            placeholder="All Stages"
                        />
                    </div>
                    <div className="relative z-[55]">
                        <MultiSelect
                            label="Office"
                            options={options.offices}
                            value={offices}
                            onChange={setSelectedOffices}
                            placeholder="All Offices"
                        />
                    </div>
                    <div className="relative z-50">
                        <MultiSelect
                            label="Region"
                            options={options.regions}
                            value={selectedRegions}
                            onChange={setSelectedRegions}
                            placeholder="All Regions"
                        />
                    </div>
                    <div className="relative z-[45]">
                        <MultiSelect
                            label="Biz PoC"
                            options={options.pocs}
                            value={selectedPocs}
                            onChange={setSelectedPocs}
                            placeholder="All PoCs"
                        />
                    </div>
                    <div className="relative z-40">
                        <MultiSelect
                            label="Month"
                            options={monthChoices}
                            value={selectedMonths}
                            onChange={setSelectedMonths}
                            placeholder="All Months"
                            maintainOrder={true}
                        />
                    </div>
                    {isDateOrWeek && (
                        <div className="relative z-[35]">
                            <MultiSelect
                                label="Week"
                                options={periodOptions}
                                value={activePeriods}
                                onChange={setSelectedPeriods}
                                placeholder="All Weeks"
                                maintainOrder={true}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* KPIs -- same filters and period narrowing as the table below, so these four
                numbers always describe exactly what's on screen. Each card opens the same
                detail modal as a cell click, listing every leg of that kind, table-wide. */}
            <div className="px-6 py-4 border-b border-white/10 bg-dark-900/40 shrink-0">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Receivable (Count)', value: kpis.receivableCount.toLocaleString(locale), accent: 'border-l-blue-500/60', kind: 'receivable' },
                        { label: 'Total Receivable', value: money(kpis.receivableAmount), accent: 'border-l-blue-500/60', kind: 'receivable' },
                        { label: 'Total Receipt (Count)', value: kpis.receiptCount.toLocaleString(locale), accent: 'border-l-emerald-500/60', kind: 'receipt' },
                        { label: 'Total Receipt', value: money(kpis.receiptAmount), accent: 'border-l-emerald-500/60', kind: 'receipt' }
                    ].map(card => (
                        <button
                            key={card.label}
                            type="button"
                            onClick={() => setDetail({
                                rowKey: null, columnKey: null,
                                columnLabel: activeYears.length > 0 ? `${yearsDisplay} · Full Year` : 'Full Year',
                                kind: card.kind
                            })}
                            title="Show the invoices behind this figure"
                            className={`text-left bg-white/5 border border-white/10 border-l-2 ${card.accent} rounded-xl px-4 py-3 hover:bg-white/10 transition-colors`}
                        >
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                {card.label}
                            </div>
                            <div className="text-lg font-bold text-white tabular-nums">{card.value}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Table -- position:sticky only ever "sticks" against a REAL, bounded scroll
                container; without max-h here this div grows to fit every row and the page
                itself does the scrolling, which leaves the header with nothing to stick
                against (same reason FinancePage.jsx's own table bounds itself the same way,
                at max-h-[600px], before its sticky thead works). This also keeps the filters
                and KPI cards above permanently visible while only the row data scrolls. */}
            <div className="max-h-[60vh] overflow-auto custom-scrollbar bg-dark-900/50">
                {activeYears.length === 0 || grid.columns.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-500">
                        Nothing to show for this selection.
                    </div>
                ) : (
                    <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-dark-800 border-b-2 border-white/10">
                                {/* The row heading doubles as the table's own search box:
                                    it matches the visible row label (project or client,
                                    whichever is grouped by), and narrows the rows, the
                                    Total row, the cell colours and the four KPI cards
                                    together, so they can never disagree. */}
                                <th className={`sticky left-0 z-30 bg-dark-800 text-left px-4 py-3 font-bold text-gray-300 uppercase tracking-wider text-[10px] border-r border-white/10 ${COL_ROW}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="shrink-0">{rowTypeLabel}</span>
                                        <span className="flex-1 min-w-0 flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-md px-2 py-1 focus-within:border-primary/50 transition-colors">
                                            <Search size={11} className="text-gray-500 shrink-0" />
                                            <input
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder="Search"
                                                title={`Filter the table by ${rowTypeLabel.toLowerCase()} name`}
                                                className="w-full min-w-0 bg-transparent text-[11px] font-medium normal-case tracking-normal text-white placeholder-gray-500 outline-none"
                                            />
                                            {search && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearch('')}
                                                    title="Clear search"
                                                    className="text-gray-500 hover:text-white shrink-0 transition-colors"
                                                >
                                                    <X size={11} />
                                                </button>
                                            )}
                                        </span>
                                    </div>
                                </th>
                                <th className={`sticky left-[280px] z-30 bg-dark-800 px-4 py-3 text-right font-bold text-white uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap ${COL_TOTAL}`}>
                                    Total ({currency})
                                </th>
                                {grid.columns.map(c => (
                                    <th key={c.key} title={c.label} className="px-4 py-3 text-right font-bold text-gray-300 uppercase tracking-wider text-[10px] whitespace-nowrap min-w-[104px]">
                                        <div>{c.head}</div>
                                        <div className="text-[9px] font-medium text-gray-500 normal-case">{c.sub}</div>
                                    </th>
                                ))}
                                {/* Headed like every other column -- #2E3532 is far too dark
                                    to read as text on this background, so the Undated colour
                                    is carried by its cells and its legend dot instead. */}
                                {grid.showUndated && (
                                    <th
                                        title="In the selected year but with no date recorded to place it on a period"
                                        className="px-4 py-3 text-right font-bold text-gray-300 uppercase tracking-wider text-[10px] whitespace-nowrap"
                                    >
                                        Undated
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            <Table title={`All ${rowTypeLabel}s`} rows={grid.rows} grandTotal={grid.grandTotal} />
                        </tbody>
                    </table>
                )}
            </div>

            {detail && (
                <CashflowDetailModal
                    key={`${detail.rowKey}|${detail.columnKey}|${detail.kind || ''}`}
                    periodLabel={detail.columnLabel}
                    entityLabel={detail.rowKey || `All ${rowTypeLabel}s`}
                    currency={currency}
                    rows={detailRows}
                    onClose={() => setDetail(null)}
                />
            )}
        </div>
    );
}
