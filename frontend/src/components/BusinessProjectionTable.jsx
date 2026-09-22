import { useState, useMemo, useEffect, Fragment } from "react";
import { PieChart, ChevronDown, ChevronRight } from "lucide-react";
import { MultiSelect } from "./ui/MultiSelect";
import BusinessProjectionDetailModal from "./BusinessProjectionDetailModal";
import { getFY, getCY, MONTHS_SHORT, MONTHS_SHORT_FY, USD_TO_INR, defaultOfficesFrom, sameValues } from "../lib/utils";
import {
    buildProjectionEvents,
    aggregateBusinessProjection,
    businessProjectionFilterOptions,
    projectionCellRows,
    aggregateProjectionBlocks
} from "../lib/businessProjection";

// Sentinel row key for the grand Total row's own block breakdown -- distinct from any real
// deal_stage value, which aggregateProjectionBlocks treats as "every stage" when passed null.
const GRAND_TOTAL_KEY = '__grand_total__';

const VIEW_MODES = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' }
];

// Block Stage opens with everything ticked except Loss and Omitted: those two are almost
// always opted out when reviewing pipeline, so hiding them by default saves that click on
// every visit while staying one click away when they are actually wanted.
const BLOCK_STAGE_OPT_OUT = /^(loss|omitted)$/i;
const defaultBlockStages = (all) => all.filter(s => !BLOCK_STAGE_OPT_OUT.test(s));

// The sales pipeline, bucketed by Deal Stage and by period. Lives inline in the Executive
// Hub's Business Projection tab -- same filter-row and frozen-column language as Revenue
// Operations, so the two tables read as one system rather than two different tools.
export default function BusinessProjectionTable({ projects }) {
    const [viewMode, setViewMode] = useState('month');
    const [yearType, setYearType] = useState('FY');
    // The Projections sheet stores its pipeline amounts in USD, but INR is the toggle every
    // Business Projections Hub table opens on -- matching Revenue Operations -- so INR is the
    // default here too even though USD stays the sheet-native figure underneath.
    const [currency, setCurrency] = useState('INR');
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    // Deal Stage starts with nothing picked, same as every other filter in this app: empty
    // means "show everything", checking a value narrows it. Office and Block Stage are the
    // exceptions -- null means "not yet defaulted", filled in below once the options in the
    // data are known.
    const [selectedDealStages, setSelectedDealStages] = useState([]);
    const [selectedOffices, setSelectedOffices] = useState(null);
    const [selectedBlockStages, setSelectedBlockStages] = useState(null);
    const [selectedPeriods, setSelectedPeriods] = useState([]);
    // Empty means "not yet touched" -- defaulted below to the current year. FY/CY pills are
    // a multi-select, so this can hold more than one year once the user picks additional
    // ones; see activeYears/toggleYear.
    const [yearLabels, setYearLabels] = useState([]);
    // The cell whose rows are being inspected: { stage, columnKey, columnLabel }. stage null
    // is the grand Total row; columnKey null is a row's Total column.
    const [detail, setDetail] = useState(null);
    // Deal Stage rows (and the grand Total row, keyed by GRAND_TOTAL_KEY) currently expanded
    // to show their one-row-per-block breakdown underneath.
    const [expandedStages, setExpandedStages] = useState(new Set());
    const toggleStage = (key) => setExpandedStages(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    const events = useMemo(() => buildProjectionEvents({ projects }), [projects]);
    const options = useMemo(() => businessProjectionFilterOptions(events), [events]);

    useEffect(() => {
        if (selectedOffices === null && options.offices.length > 0) {
            setSelectedOffices(defaultOfficesFrom(options.offices));
        }
    }, [options.offices, selectedOffices]);
    const offices = selectedOffices || [];

    useEffect(() => {
        if (selectedBlockStages === null && options.blockStages.length > 0) {
            setSelectedBlockStages(defaultBlockStages(options.blockStages));
        }
    }, [options.blockStages, selectedBlockStages]);
    const blockStages = selectedBlockStages || [];

    const yearChoices = yearType === 'CY' ? options.cys : options.fys;
    // The validated set actually in effect: whatever of yearLabels is still a real choice (a
    // stale year survives a FY/CY switch otherwise), falling back to the current year --
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
    // "FY-26" alone, or "FY-25 + FY-26" once more than one is active.
    const yearsDisplay = activeYears.join(' + ');

    // The columns in scope depend on year/view/month, so a stale week key is dropped rather
    // than silently emptying the table -- same guard Revenue Operations uses.
    const periodOptions = useMemo(() => aggregateBusinessProjection({
        events, yearType, yearLabels: activeYears, viewMode, currency,
        regions: selectedRegions, offices, months: selectedMonths
    }).periodOptions, [events, yearType, activeYears, viewMode, currency, selectedRegions, offices, selectedMonths]);

    const activePeriods = useMemo(() => {
        const valid = new Set(periodOptions.map(o => o.value));
        return selectedPeriods.filter(k => valid.has(k));
    }, [selectedPeriods, periodOptions]);

    const grid = useMemo(() => aggregateBusinessProjection({
        events,
        yearType,
        yearLabels: activeYears,
        viewMode,
        currency,
        regions: selectedRegions,
        offices,
        blockStages,
        months: selectedMonths,
        dealStages: selectedDealStages,
        periods: activePeriods
    }), [events, yearType, activeYears, viewMode, currency, selectedRegions, offices,
        blockStages, selectedMonths, selectedDealStages, activePeriods]);

    // Recomputed through projectionCellRows, which shares its scope test with the grid, so
    // the list always adds up to the figure that was clicked.
    const detailRows = useMemo(() => detail ? projectionCellRows({
        events,
        columnKey: detail.columnKey,
        stage: detail.stage,
        blockId: detail.blockId,
        currency,
        yearType,
        yearLabels: activeYears,
        viewMode,
        regions: selectedRegions,
        offices,
        blockStages,
        months: selectedMonths,
        periods: activePeriods
    }) : [], [detail, events, currency, yearType, activeYears, viewMode, selectedRegions,
        offices, blockStages, selectedMonths, activePeriods]);

    // Recomputed straight off the current filters whenever a stage row is expanded -- the
    // same period columns as the stage row itself (same inputs to buildPeriodScope), just
    // grouped by block instead of summed into the stage total.
    const blocksFor = (stage) => aggregateProjectionBlocks({
        events,
        stage,
        yearType,
        yearLabels: activeYears,
        viewMode,
        currency,
        regions: selectedRegions,
        offices,
        blockStages,
        months: selectedMonths,
        periods: activePeriods
    });

    const symbol = currency === 'INR' ? '₹' : '$';
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    const money = (n) => `${symbol}${Math.round(n || 0).toLocaleString(locale)}`;
    // Undated is a real anomaly rather than something to drill into (see aggregation note),
    // so it stays plain text -- same treatment Revenue Operations gives its own Undated cell.
    const cell = (v) => {
        const n = Math.round(v || 0);
        return n === 0 ? <span className="text-gray-600">-</span> : money(n);
    };
    // Every non-zero figure opens the rows behind it, same gesture as Revenue Operations. A
    // zero has nothing to show, so it stays a plain dash rather than a dead button. blockId/
    // blockLabel narrow a click from a block-breakdown row to just that one project, same as
    // a stage-row click already narrows to just that stage.
    const figure = (v, stage, columnKey, columnLabel, blockId = null, blockLabel = null) => {
        const n = Math.round(v || 0);
        if (n === 0) return <span className="text-gray-600">-</span>;
        return (
            <button
                type="button"
                onClick={() => setDetail({ stage, columnKey, columnLabel, blockId, blockLabel })}
                title="Show the rows behind this figure"
                className="underline decoration-dotted decoration-transparent underline-offset-4 hover:text-primary hover:decoration-primary/60 transition-colors"
            >
                {money(n)}
            </button>
        );
    };

    // How many <td>s a row spans, so the "no projects" message under an empty expanded row
    // can stretch across the whole table regardless of how many period columns are in view.
    const totalCols = 2 + grid.columns.length + (grid.showUndated ? 1 : 0);
    // The block-level breakdown rows shown under an expanded Deal Stage (or grand Total) row
    // -- rendered as ordinary rows of the SAME table (not a nested one), so its Block/Total/
    // period columns share the exact column tracks, sticky positioning and click-through the
    // stage row above it already has, and "Sept - TOBT" / "Aug - TOBT" show up as separate,
    // independently clickable figures on TOBT's own row.
    const blockSection = (stage, stageKey) => {
        const rows = blocksFor(stage).rows;
        if (rows.length === 0) {
            return (
                <tr className="bg-black/20 border-b border-white/5">
                    <td colSpan={totalCols} className="px-4 py-3 text-xs text-gray-500">
                        No projects behind this total.
                    </td>
                </tr>
            );
        }
        return rows.map((b, i) => (
            <tr key={`${stageKey}-${b.blockId}-${i}`} className="bg-black/20 border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <td
                    className={`sticky left-0 z-10 text-left pl-9 pr-4 py-1.5 whitespace-nowrap border-r border-white/10 bg-[#0A0A0A] text-gray-400 truncate ${COL_STAGE}`}
                    title={b.block}
                >
                    {b.block}
                </td>
                <td className="sticky left-[220px] z-10 px-4 py-1.5 text-right tabular-nums whitespace-nowrap border-r border-white/10 font-bold bg-[#0A0A0A] text-gray-200">
                    {figure(b.total, stage, null, `${yearsDisplay} total`, b.blockId, b.block)}
                </td>
                {grid.columns.map(c => (
                    <td key={c.key} className="px-4 py-1.5 text-right tabular-nums whitespace-nowrap text-gray-500">
                        {figure(b.cells[c.key], stage, c.key, `${c.head} ${c.sub}`, b.blockId, b.block)}
                    </td>
                ))}
                {grid.showUndated && (
                    <td className="px-4 py-1.5 text-right tabular-nums whitespace-nowrap text-amber-300/80">
                        {cell(b.undated)}
                    </td>
                )}
            </tr>
        ));
    };

    const monthChoices = yearType === 'FY' ? MONTHS_SHORT_FY : MONTHS_SHORT;
    const officesIsDefault = selectedOffices === null
        || sameValues(selectedOffices, defaultOfficesFrom(options.offices));
    const blockStagesIsDefault = selectedBlockStages === null
        || sameValues(selectedBlockStages, defaultBlockStages(options.blockStages));
    const hasFilters = selectedRegions.length || !officesIsDefault || selectedMonths.length
        || selectedDealStages.length || !blockStagesIsDefault || activePeriods.length;
    const clearFilters = () => {
        setSelectedRegions([]);
        setSelectedOffices(defaultOfficesFrom(options.offices));
        setSelectedMonths([]);
        setSelectedDealStages([]);
        setSelectedBlockStages(defaultBlockStages(options.blockStages));
        setSelectedPeriods([]);
    };

    const toggleClass = (on) =>
        `px-3 py-1 text-xs font-bold rounded-md transition-colors ${on ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`;

    // Metric/Total-equivalent columns are frozen against horizontal scroll, matching Revenue
    // Operations' frozen "Metric" + "Total" columns.
    const COL_STAGE = 'w-[220px] min-w-[220px] max-w-[220px]';
    const COL_TOTAL = 'w-[140px] min-w-[140px] max-w-[140px]';

    return (
        <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-dark-900 shrink-0 gap-4">
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white leading-tight mb-1 flex items-center gap-3">
                        <PieChart className="text-primary" />
                        Business Projection
                    </h2>
                    <div className="text-sm text-gray-400">
                        {activeYears.length > 0
                            ? `${yearsDisplay} · ${VIEW_MODES.find(v => v.key === viewMode).label}ly · ${currency}`
                            : 'No dated pipeline available'}
                        <span className="text-gray-600"> · </span>
                        Fixed FX: 1 USD = ₹{USD_TO_INR}
                    </div>
                </div>
            </div>

            {/* Controls -- its own stacking context (relative + z-index), raised above the
                Table below, so an open filter dropdown always paints over the table rather
                than getting tucked behind it once the filters stack to one column on mobile. */}
            <div className="relative z-30 px-6 pt-5 pb-4 border-b border-white/10 bg-dark-900/60 shrink-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
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

                {/* Each filter's wrapper carries a DESCENDING z-index by position (not a
                    uniform one) -- with the row wrapping to one column on mobile, a uniform
                    z-index lets whichever filter is LATER in the DOM paint over an EARLIER
                    filter's open dropdown; descending z-index keeps an earlier filter's
                    dropdown on top of every filter below it, regardless of layout. */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${viewMode === 'week' ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
                    <div className="relative z-[60]">
                        <MultiSelect
                            label="Deal Stage"
                            options={options.dealStages}
                            value={selectedDealStages}
                            onChange={setSelectedDealStages}
                            placeholder="All Stages"
                            maintainOrder={true}
                        />
                    </div>
                    <div className="relative z-[55]">
                        <MultiSelect
                            label="Block Stage"
                            options={options.blockStages}
                            value={blockStages}
                            onChange={setSelectedBlockStages}
                            placeholder="All Block Stages"
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
                            label="Contracting Office"
                            options={options.offices}
                            value={offices}
                            onChange={setSelectedOffices}
                            placeholder="All Offices"
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
                    {viewMode === 'week' && (
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

            {/* Table -- see the identical note in CashflowTable.jsx: position:sticky needs a
                REAL, bounded scroll container to stick against; max-h here (matching the same
                pattern FinancePage.jsx's own table already relies on) is what makes the header
                row below actually freeze, and keeps the filters permanently visible above
                while only the row data scrolls. */}
            <div className="max-h-[60vh] overflow-auto custom-scrollbar bg-dark-900/50">
                {activeYears.length === 0 || grid.columns.length === 0 || grid.rows.length === 0 ? (
                    <div className="p-10 text-center text-sm text-gray-500">
                        No pipeline for this selection.
                    </div>
                ) : (
                    <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-dark-800 border-b-2 border-white/10">
                                <th className={`sticky left-0 z-30 bg-dark-800 text-left px-4 py-3 font-bold text-gray-300 uppercase tracking-wider text-[10px] border-r border-white/10 ${COL_STAGE}`}>
                                    Deal Stage
                                </th>
                                <th className={`sticky left-[220px] z-30 bg-dark-800 px-4 py-3 text-right font-bold text-white uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap ${COL_TOTAL}`}>
                                    Total ({currency})
                                </th>
                                {grid.columns.map(c => (
                                    <th key={c.key} title={c.label} className="px-4 py-3 text-right font-bold text-gray-300 uppercase tracking-wider text-[10px] whitespace-nowrap min-w-[104px]">
                                        <div>{c.head}</div>
                                        <div className="text-[9px] font-medium text-gray-500 normal-case">{c.sub}</div>
                                    </th>
                                ))}
                                {grid.showUndated && (
                                    <th title="In the selected year but outside every period column" className="px-4 py-3 text-right font-bold text-amber-300 uppercase tracking-wider text-[10px] whitespace-nowrap">
                                        Undated
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {grid.rows.map(row => (
                                <Fragment key={row.stage}>
                                    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                        <th
                                            scope="row"
                                            className="sticky left-0 z-10 text-left px-4 py-2 whitespace-nowrap border-r border-white/10 bg-[#0A0A0A] font-medium text-gray-300"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleStage(row.stage)}
                                                title="Show the projects behind this stage"
                                                className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                                            >
                                                {expandedStages.has(row.stage)
                                                    ? <ChevronDown size={13} className="text-gray-500 shrink-0" />
                                                    : <ChevronRight size={13} className="text-gray-500 shrink-0" />}
                                                <span>{row.stage}</span>
                                            </button>
                                        </th>
                                        <td className="sticky left-[220px] z-10 px-4 py-2 text-right tabular-nums whitespace-nowrap border-r border-white/10 font-bold bg-[#0A0A0A] text-gray-100">
                                            {figure(row.total, row.stage, null, `${yearsDisplay} total`)}
                                        </td>
                                        {grid.columns.map(c => (
                                            <td key={c.key} className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-gray-400">
                                                {figure(row.cells[c.key], row.stage, c.key, `${c.head} ${c.sub}`)}
                                            </td>
                                        ))}
                                        {grid.showUndated && (
                                            <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-amber-300">
                                                {cell(row.undated)}
                                            </td>
                                        )}
                                    </tr>
                                    {expandedStages.has(row.stage) && blockSection(row.stage, row.stage)}
                                </Fragment>
                            ))}

                            <Fragment>
                                <tr className="border-t border-t-white/[0.14] bg-white/[0.04]">
                                    <th className="sticky left-0 z-10 text-left px-4 py-2 whitespace-nowrap border-r border-white/10 bg-[#101010] font-bold text-white">
                                        <button
                                            type="button"
                                            onClick={() => toggleStage(GRAND_TOTAL_KEY)}
                                            title="Show the projects behind the grand total"
                                            className="inline-flex items-center gap-1.5 hover:text-gray-200 transition-colors"
                                        >
                                            {expandedStages.has(GRAND_TOTAL_KEY)
                                                ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
                                                : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
                                            <span>Total</span>
                                        </button>
                                    </th>
                                    <td className="sticky left-[220px] z-10 px-4 py-2 text-right tabular-nums whitespace-nowrap border-r border-white/10 font-bold bg-[#101010] text-white">
                                        {figure(grid.grandTotal.total, null, null, `${yearsDisplay} total`)}
                                    </td>
                                    {grid.columns.map(c => (
                                        <td key={c.key} className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-white font-bold">
                                            {figure(grid.grandTotal.cells[c.key], null, c.key, `${c.head} ${c.sub}`)}
                                        </td>
                                    ))}
                                    {grid.showUndated && (
                                        <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-amber-300 font-bold">
                                            {cell(grid.grandTotal.undated)}
                                        </td>
                                    )}
                                </tr>
                                {expandedStages.has(GRAND_TOTAL_KEY) && blockSection(null, GRAND_TOTAL_KEY)}
                            </Fragment>
                        </tbody>
                    </table>
                )}
            </div>

            {detail && (
                <BusinessProjectionDetailModal
                    key={`${detail.stage}|${detail.columnKey}|${detail.blockId || ''}`}
                    periodLabel={detail.columnLabel}
                    stage={detail.stage}
                    block={detail.blockLabel}
                    currency={currency}
                    rows={detailRows}
                    onClose={() => setDetail(null)}
                />
            )}
        </div>
    );
}
