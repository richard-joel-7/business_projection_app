import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Table2, ChevronDown } from "lucide-react";
import { MultiSelect } from "./ui/MultiSelect";
import RevenueOpsDetailModal from "./RevenueOpsDetailModal";
import { getFY, getCY, MONTHS_SHORT, MONTHS_SHORT_FY, defaultOfficesFrom, sameValues } from "../lib/utils";
import {
    REVENUE_METRICS,
    OTHER_CHARGES_METRIC,
    buildRevenueOpsEvents,
    aggregateRevenueOps,
    revenueOpsFilterOptions,
    revenueOpsCellRows
} from "../lib/revenueOps";

// Other Charges' own accent -- it is a derived breakdown, not one of the seven headline
// metrics, so its toggle and its row are tinted to read as "explanatory" rather than as an
// eighth equally-weighted row.
const OTHER_CHARGES_COLOR = 'rgba(251, 146, 60, 0.8)'; // #fb923c at 80% opacity

const VIEW_MODES = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' }
];

// The metrics fall into a billable half and a finance half. They are separated by a
// hairline rather than by colour: per-metric tints made a dense grid harder to read, not
// easier, so every row now shares one neutral treatment.
const FINANCE_BLOCK_START = REVENUE_METRICS.findIndex(m => m.key === 'billed');

export default function RevenueOperationsModal({ projects, finances, displayCurrency, onClose, embedded = false }) {
    const [viewMode, setViewMode] = useState('month');
    const [yearType, setYearType] = useState('FY');
    const [currency, setCurrency] = useState(displayCurrency === 'USD' ? 'USD' : 'INR');
    // null means "not yet defaulted" -- filled in below, once the offices in the data are
    // known, to PhantomFX's own three delivery offices.
    const [selectedOffices, setSelectedOffices] = useState(null);
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedPocs, setSelectedPocs] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    // Empty means no stage split: the grand total table on its own, which is the default.
    // Choosing stages appends one table per stage beneath it.
    const [selectedStages, setSelectedStages] = useState([]);
    // Which period columns to show. Only offered in week view, where a year is 52 columns.
    const [selectedPeriods, setSelectedPeriods] = useState([]);
    // The cell whose rows are being inspected: { metricKey, columnKey, columnLabel, stage }.
    // columnKey null means the metric's Total column.
    const [detail, setDetail] = useState(null);
    // Empty means "not yet touched" -- defaulted below to the current year. FY/CY pills are
    // a multi-select, so this can hold more than one year once the user picks additional
    // ones; see activeYears/toggleYear.
    const [yearLabels, setYearLabels] = useState([]);
    // Other Charges starts collapsed everywhere; one toggle controls it for the grand total
    // and every stage group at once, rather than tracking it per block.
    const [showOtherCharges, setShowOtherCharges] = useState(false);

    const events = useMemo(
        () => buildRevenueOpsEvents({ projects, finances }),
        [projects, finances]
    );
    const options = useMemo(() => revenueOpsFilterOptions(events), [events]);

    useEffect(() => {
        if (selectedOffices === null && options.offices.length > 0) {
            setSelectedOffices(defaultOfficesFrom(options.offices));
        }
    }, [options.offices, selectedOffices]);
    const offices = selectedOffices || [];

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

    // The columns in scope depend on year, view and month, so a stale week key is dropped
    // rather than silently emptying the table.
    const periodOptions = useMemo(() => aggregateRevenueOps({
        events,
        yearType,
        yearLabels: activeYears,
        viewMode,
        currency,
        offices,
        regions: selectedRegions,
        pocs: selectedPocs,
        months: selectedMonths
    }).periodOptions, [events, yearType, activeYears, viewMode, currency, offices, selectedRegions, selectedPocs, selectedMonths]);

    const activePeriods = useMemo(() => {
        const valid = new Set(periodOptions.map(o => o.value));
        return selectedPeriods.filter(k => valid.has(k));
    }, [selectedPeriods, periodOptions]);

    const grid = useMemo(() => aggregateRevenueOps({
        events,
        yearType,
        yearLabels: activeYears,
        viewMode,
        currency,
        offices,
        regions: selectedRegions,
        pocs: selectedPocs,
        months: selectedMonths,
        stages: selectedStages,
        periods: activePeriods
    }), [events, yearType, activeYears, viewMode, currency, offices, selectedRegions, selectedPocs, selectedMonths, selectedStages, activePeriods]);

    // Recomputed through revenueOpsCellRows, which shares its scope test with the grid, so
    // the list always adds up to the figure that was clicked.
    const detailRows = useMemo(() => detail ? revenueOpsCellRows({
        events,
        metric: detail.metricKey,
        columnKey: detail.columnKey,
        stage: detail.stage,
        currency,
        yearType,
        yearLabels: activeYears,
        viewMode,
        offices,
        regions: selectedRegions,
        pocs: selectedPocs,
        months: selectedMonths,
        periods: activePeriods
    }) : [], [detail, events, currency, yearType, activeYears, viewMode, offices, selectedRegions, selectedPocs, selectedMonths, activePeriods]);

    const symbol = currency === 'INR' ? '₹' : '$';
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    const money = (n) => `${symbol}${n.toLocaleString(locale)}`;

    // Every non-zero figure opens the rows behind it. A zero has nothing to show, so it
    // stays a plain dash rather than a dead button.
    const figure = (v, metric, stage, columnKey, columnLabel) => {
        const n = Math.round(v || 0);
        if (n === 0) return <span className="text-gray-600">-</span>;
        return (
            <button
                type="button"
                onClick={() => setDetail({ metricKey: metric.key, columnKey, columnLabel, stage })}
                title="Show the rows behind this figure"
                className="underline decoration-dotted decoration-transparent underline-offset-4 hover:text-primary hover:decoration-primary/60 transition-colors"
            >
                {money(n)}
            </button>
        );
    };

    const monthChoices = yearType === 'FY' ? MONTHS_SHORT_FY : MONTHS_SHORT;
    const officesIsDefault = selectedOffices === null
        || sameValues(selectedOffices, defaultOfficesFrom(options.offices));
    const hasFilters = !officesIsDefault || selectedRegions.length || selectedPocs.length
        || selectedMonths.length || selectedStages.length || activePeriods.length;
    const clearFilters = () => {
        setSelectedOffices(defaultOfficesFrom(options.offices));
        setSelectedRegions([]);
        setSelectedPocs([]);
        setSelectedMonths([]);
        setSelectedStages([]);
        setSelectedPeriods([]);
    };

    // Metric and Total are frozen against horizontal scrolling. Total pins at the metric
    // column's right edge, so both widths are fixed rather than content-driven.
    const COL_METRIC = 'w-[230px] min-w-[230px] max-w-[230px]';
    const COL_TOTAL = 'w-[150px] min-w-[150px] max-w-[150px]';

    const toggleClass = (on) =>
        `px-3 py-1 text-xs font-bold rounded-md transition-colors ${on ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`;

    // A single metric line, reused for the stage groups and the grand total. `toggle` puts a
    // small expand/collapse arrow beside the label (Receipts only, for Other Charges); `tint`
    // colours the whole row Other Charges' own accent instead of the usual white/grey, so it
    // reads as a derived breakdown rather than an eighth headline row.
    const MetricRow = ({ metric, data, emphasise, divider, stage = null, toggle = null, tint = false }) => (
        <tr className={`border-b border-white/5 ${divider ? 'border-t border-t-white/[0.14]' : ''} ${emphasise ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'} transition-colors`}>
            <th
                scope="row"
                title={metric.hint}
                style={tint ? { color: OTHER_CHARGES_COLOR } : undefined}
                className={`sticky left-0 z-10 text-left px-4 py-2 whitespace-nowrap border-r border-white/10 ${COL_METRIC} ${tint ? 'bg-[#0A0A0A] font-medium' : (emphasise ? 'bg-[#101010] font-bold text-white' : 'bg-[#0A0A0A] font-medium text-gray-300')}`}
            >
                <span className="inline-flex items-center gap-1.5">
                    {metric.label}
                    {toggle && (
                        <button
                            type="button"
                            onClick={toggle.onClick}
                            title="Show/hide Other Charges (TDS + Exchange Diff + Bank Charges)"
                            className="text-gray-500 hover:text-white transition-colors"
                        >
                            <ChevronDown size={12} className={`transition-transform ${toggle.open ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </span>
            </th>
            <td
                style={tint ? { color: OTHER_CHARGES_COLOR } : undefined}
                className={`sticky left-[230px] z-10 px-4 py-2 text-right tabular-nums whitespace-nowrap border-r border-white/10 font-bold ${COL_TOTAL} ${tint ? 'bg-[#0A0A0A]' : (emphasise ? 'bg-[#101010] text-white' : 'bg-[#0A0A0A] text-gray-100')}`}
            >
                {figure(data.total, metric, stage, null, `${yearsDisplay} total`)}
            </td>
            {grid.columns.map(c => (
                <td key={c.key} style={tint ? { color: OTHER_CHARGES_COLOR } : undefined} className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${tint ? '' : 'text-gray-400'}`}>
                    {figure(data.cells[c.key], metric, stage, c.key, `${c.head} ${c.sub}`)}
                </td>
            ))}
            {grid.showUndated && (
                <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap text-amber-300">
                    {Math.round(data.undated || 0) === 0
                        ? <span className="text-gray-600">-</span>
                        : money(Math.round(data.undated))}
                </td>
            )}
        </tr>
    );

    return (
        <div className={embedded ? "" : "fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"}>
            <motion.div
                initial={embedded ? { opacity: 0, y: 10 } : { opacity: 0, scale: 0.95, y: 20 }}
                animate={embedded ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                exit={embedded ? { opacity: 0, y: -10 } : { opacity: 0, scale: 0.95, y: 20 }}
                transition={embedded ? { duration: 0.2 } : undefined}
                className={`glass-panel rounded-2xl w-full border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] flex flex-col ${embedded ? '' : 'max-w-[96rem] my-8 max-h-[92vh]'}`}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-dark-900 shrink-0 gap-4">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white leading-tight mb-1 flex items-center gap-3">
                            <Table2 className="text-primary" />
                            Revenue Operations
                        </h2>
                        <div className="text-sm text-gray-400">
                            {activeYears.length > 0
                                ? `${yearsDisplay} · ${VIEW_MODES.find(v => v.key === viewMode).label}ly · ${currency}`
                                : 'No dated records available'}
                        </div>
                    </div>
                    {!embedded && (
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg shrink-0">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Controls -- its own stacking context (relative + z-index), raised above the
                    Table below, so an open filter dropdown always paints over the table rather
                    than getting tucked behind it once the filters stack to one column on
                    mobile. */}
                <div className="relative z-30 px-6 pt-5 pb-4 border-b border-white/10 bg-dark-900/60 shrink-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View */}
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

                        {/* FY / CY */}
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

                        {/* Year -- a multi-select: click to add, click an active one again to
                            drop it. Unpicking the last one snaps back to the current year. */}
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

                        {/* Currency */}
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
                        uniform one) -- with the row wrapping to one column on mobile, a
                        uniform z-index lets whichever filter is LATER in the DOM paint over an
                        EARLIER filter's open dropdown; descending z-index keeps an earlier
                        filter's dropdown on top of every filter below it, regardless of layout. */}
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${viewMode === 'week' ? 'xl:grid-cols-6' : 'xl:grid-cols-5'}`}>
                        <div className="relative z-[60]">
                            <MultiSelect
                                label="Stage Split"
                                options={options.stages}
                                value={selectedStages}
                                onChange={setSelectedStages}
                                placeholder="None"
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

                {/* Table -- position:sticky only ever "sticks" against a REAL, bounded scroll
                    container. Embedded (the only way this is used today, as an Executive Hub
                    tab) has no bounded height of its own otherwise, so max-h here is what makes
                    the header row actually freeze (same pattern FinancePage.jsx's own table
                    already relies on), and keeps the filters permanently visible above while
                    only the row data scrolls. The standalone popup path is already bounded a
                    different way (max-h-[92vh] on the modal itself, flex-1 filling it), so it
                    keeps its own original sizing. */}
                <div className={embedded ? "max-h-[60vh] overflow-auto custom-scrollbar bg-dark-900/50" : "flex-1 overflow-auto custom-scrollbar bg-dark-900/50"}>
                    {activeYears.length === 0 || grid.columns.length === 0 || grid.stagesPresent.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500">
                            Nothing to show for this selection.
                        </div>
                    ) : (
                        <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-dark-800 border-b-2 border-white/10">
                                    <th className={`sticky left-0 z-30 bg-dark-800 text-left px-4 py-3 font-bold text-gray-300 uppercase tracking-wider text-[10px] border-r border-white/10 ${COL_METRIC}`}>
                                        Metric
                                    </th>
                                    <th className={`sticky left-[230px] z-30 bg-dark-800 px-4 py-3 text-right font-bold text-white uppercase tracking-wider text-[10px] border-r border-white/10 whitespace-nowrap ${COL_TOTAL}`}>
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
                                {/* The grand total always leads; a stage split is extra detail below it. */}
                                <tr className="border-y border-white/20">
                                    <th
                                        colSpan={2}
                                        className="sticky left-0 z-20 text-left px-4 py-2 bg-[#1A1A1A] text-white font-bold text-[11px] uppercase tracking-wider whitespace-nowrap"
                                    >
                                        All Stages
                                    </th>
                                    <th
                                        colSpan={grid.columns.length + (grid.showUndated ? 1 : 0)}
                                        className="bg-white/[0.07]"
                                    ></th>
                                </tr>
                                {REVENUE_METRICS.map((m, i) => (
                                    <React.Fragment key={m.key}>
                                        <MetricRow
                                            metric={m}
                                            data={grid.totals[m.key]}
                                            emphasise
                                            divider={i === FINANCE_BLOCK_START}
                                            toggle={m.key === 'receipts'
                                                ? { open: showOtherCharges, onClick: () => setShowOtherCharges(v => !v) }
                                                : null}
                                        />
                                        {m.key === 'receipts' && showOtherCharges && (
                                            <MetricRow metric={OTHER_CHARGES_METRIC} data={grid.totals[OTHER_CHARGES_METRIC.key]} tint />
                                        )}
                                    </React.Fragment>
                                ))}

                                {grid.groups.map(group => (
                                    <React.Fragment key={group.stage}>
                                        <tr className="border-y border-primary/20">
                                            <th
                                                colSpan={2}
                                                className="sticky left-0 z-20 text-left px-4 py-2 bg-[#0E1A14] text-primary font-bold text-[11px] uppercase tracking-wider whitespace-nowrap"
                                            >
                                                {group.stage}
                                            </th>
                                            <th
                                                colSpan={grid.columns.length + (grid.showUndated ? 1 : 0)}
                                                className="bg-primary/10"
                                            ></th>
                                        </tr>
                                        {REVENUE_METRICS.map((m, i) => (
                                            <React.Fragment key={m.key}>
                                                <MetricRow
                                                    metric={m}
                                                    data={group.metrics[m.key]}
                                                    divider={i === FINANCE_BLOCK_START}
                                                    stage={group.stage}
                                                    toggle={m.key === 'receipts'
                                                        ? { open: showOtherCharges, onClick: () => setShowOtherCharges(v => !v) }
                                                        : null}
                                                />
                                                {m.key === 'receipts' && showOtherCharges && (
                                                    <MetricRow metric={OTHER_CHARGES_METRIC} data={group.metrics[OTHER_CHARGES_METRIC.key]} stage={group.stage} tint />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>

            {detail && (
                <RevenueOpsDetailModal
                    key={`${detail.metricKey}|${detail.columnKey}|${detail.stage}`}
                    metric={[...REVENUE_METRICS, OTHER_CHARGES_METRIC].find(m => m.key === detail.metricKey)}
                    periodLabel={detail.columnLabel}
                    stage={detail.stage}
                    currency={currency}
                    rows={detailRows}
                    onClose={() => setDetail(null)}
                />
            )}
        </div>
    );
}
