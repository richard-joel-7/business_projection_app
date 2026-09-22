import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Copy, Check, ListTree, Filter, Search } from "lucide-react";
import {
    REVENUE_DETAIL_COLUMNS,
    detailCellValue,
    filterDetailRows,
    detailFilterOptions,
    toggleDetailFilter,
    setDetailColumnAll
} from "../lib/revenueOps";

// Every value starts ticked, so an unticked box has to be as visible as a ticked one.
const Box = ({ checked }) => (
    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked
        ? 'bg-primary border-primary'
        : 'border-white/25 bg-transparent'}`}>
        {checked && <Check size={10} className="text-white" />}
    </span>
);
import { formatDayMonthYear } from "../lib/utils";

// The rows behind a single Revenue Operations cell. Opened by clicking the figure, so the
// list it shows must add up to exactly that figure -- the total line at the bottom is there
// to make that visible rather than a matter of trust.
//
// Text columns carry a per-column value filter, the way a spreadsheet does. Filtering is a
// view over the rows: it narrows the table, the total, the row count and what Copy puts on
// the clipboard, all from the same filtered set, so those four can never disagree.
export default function RevenueOpsDetailModal({ metric, periodLabel, stage, currency, rows, onClose }) {
    // Optional columns start hidden and are revealed on request, one toggle each.
    const [revealed, setRevealed] = useState([]);
    // { [columnKey]: [kept values] }. A column absent from here is unfiltered.
    const [filters, setFilters] = useState({});
    // Only one header filter is open at a time. The panel is positioned from the button's
    // own rect because the table scrolls inside an overflow container that would clip it.
    const [openFilter, setOpenFilter] = useState(null);
    const [anchor, setAnchor] = useState(null);
    const [search, setSearch] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    const allColumns = REVENUE_DETAIL_COLUMNS[metric.key] || [];
    const optional = allColumns.filter(c => c.optional);
    const columns = allColumns.filter(c => !c.optional || revealed.includes(c.key));

    const symbol = currency === 'INR' ? '₹' : '$';
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    const money = (v) => `${symbol}${Math.round(v || 0).toLocaleString(locale)}`;

    // Filtering, the option lists and the total all come off the same helpers in lib, so the
    // table, the row count, the total and what Copy writes can never disagree.
    const filteredRows = useMemo(() => filterDetailRows(rows, filters), [rows, filters]);
    const total = useMemo(() => filteredRows.reduce((s, r) => s + (r.amount || 0), 0), [filteredRows]);
    const activeFilters = Object.keys(filters).filter(k => filters[k].length > 0);

    const toggleValue = (key, value) => setFilters(prev => toggleDetailFilter(prev, key, value));
    const clearColumn = (key) => setFilters(prev => setDetailColumnAll(prev, key, [], true));
    const setAll = (key, values, selectAll) =>
        setFilters(prev => setDetailColumnAll(prev, key, values, selectAll));

    const openFor = (key, event) => {
        if (openFilter === key) { setOpenFilter(null); return; }
        setAnchor(event.currentTarget.getBoundingClientRect());
        setOpenFilter(key);
        setSearch('');
    };

    // Hiding an optional column drops its filter too, so nothing is narrowed invisibly.
    const toggleOptional = (key) => setRevealed(prev => {
        const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
        if (!next.includes(key)) clearColumn(key);
        return next;
    });

    // Read by the column's own key, not a fixed field, so a metric can show more than one
    // date or money figure -- Receipts lists both the Billed date it is bucketed by and the
    // Receipt date the money actually landed on, and Other Charges' optional TDS/Exchange
    // Diff/Bank Charges columns sit beside its own headline amount rather than repeating it.
    const display = (col, row) => {
        if (col.type === 'date') return formatDayMonthYear(row[col.key]) || '-';
        if (col.type === 'money') return money(row[col.key]);
        return row[col.key] || '-';
    };
    // Excel wants a bare number, so the copied amount carries no symbol or grouping.
    const plain = (col, row) => {
        if (col.type === 'date') return formatDayMonthYear(row[col.key]);
        if (col.type === 'money') return String(Math.round(row[col.key] || 0));
        return row[col.key] || '';
    };

    const legacyCopy = (tsv, done) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = tsv;
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            done();
        } catch (err) {
            /* clipboard unavailable; the button simply does not confirm */
        }
    };
    const handleCopy = () => {
        const tsv = [
            columns.map(c => c.label).join('\t'),
            ...filteredRows.map(r => columns.map(c => plain(c, r)).join('\t'))
        ].join('\n');
        const done = () => { setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); };
        // Apps Script serves the app inside a sandboxed iframe, where the async clipboard
        // API is not always granted, so fall back to a detached textarea.
        try {
            navigator.clipboard.writeText(tsv).then(done).catch(() => legacyCopy(tsv, done));
        } catch (err) {
            legacyCopy(tsv, done);
        }
    };

    const panelOptions = openFilter ? detailFilterOptions(rows, filters, openFilter) : [];
    const shownOptions = search
        ? panelOptions.filter(o => o.value.toLowerCase().includes(search.toLowerCase()))
        : panelOptions;

    // Rendered through a portal straight onto <body>: RevenueOperationsModal's own root
    // carries .glass-panel (backdrop-blur), and a backdrop-filter ancestor -- like a CSS
    // transform -- becomes the containing block for any `position: fixed` descendant. Left
    // inline, this overlay centred itself inside that tall table's own box instead of the
    // viewport, which is why it could open far down the page instead of visibly on screen.
    return createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass-panel rounded-2xl w-full max-w-5xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] my-8 flex flex-col max-h-[88vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-dark-900 shrink-0 gap-4">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-white leading-tight mb-1 flex items-center gap-3">
                            <ListTree className="text-primary shrink-0" size={20} />
                            <span className="truncate">{metric.label}</span>
                        </h2>
                        <div className="text-sm text-gray-400 truncate">
                            {periodLabel} · {stage || 'All Stages'} · {currency}
                            <span className="text-gray-600"> · </span>
                            {activeFilters.length > 0
                                ? `${filteredRows.length} of ${rows.length} rows`
                                : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={handleCopy}
                            title="Copy as a tab separated table, ready to paste into Excel"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium text-gray-300 hover:text-white"
                        >
                            {isCopied ? (
                                <>
                                    <Check className="w-4 h-4 text-green-400" />
                                    <span className="text-green-400">Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Optional columns and any active filters */}
                {(optional.length > 0 || activeFilters.length > 0) && (
                    <div className="px-6 py-3 border-b border-white/10 bg-dark-900/60 shrink-0 flex flex-wrap items-center gap-2">
                        {optional.length > 0 && (
                            <>
                                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-1">
                                    Extra Columns
                                </span>
                                {optional.map(c => (
                                    <button
                                        key={c.key}
                                        onClick={() => toggleOptional(c.key)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${revealed.includes(c.key)
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'}`}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </>
                        )}
                        {activeFilters.length > 0 && (
                            <button
                                onClick={() => setFilters({})}
                                className="ml-auto text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1 rounded-lg transition-colors"
                            >
                                Clear {activeFilters.length === 1 ? 'Filter' : 'Filters'}
                            </button>
                        )}
                    </div>
                )}

                {/* Rows */}
                <div
                    className="flex-1 overflow-auto custom-scrollbar bg-dark-900/50"
                    onScroll={() => setOpenFilter(null)}
                >
                    {filteredRows.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500">
                            {rows.length === 0 ? 'Nothing behind this figure.' : 'No rows match these column filters.'}
                        </div>
                    ) : (
                        <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-dark-800 border-b-2 border-white/10">
                                    {columns.map(c => (
                                        <th
                                            key={c.key}
                                            className={`px-4 py-3 font-bold text-gray-300 uppercase tracking-wider text-[10px] whitespace-nowrap ${c.type === 'money' ? 'text-right' : 'text-left'}`}
                                        >
                                            <span className={`inline-flex items-center gap-1.5 ${c.type === 'money' ? 'flex-row-reverse' : ''}`}>
                                                <span>{c.label}{c.type === 'money' ? ` (${currency})` : ''}</span>
                                                {c.type === 'text' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => openFor(c.key, e)}
                                                        title={`Filter by ${c.label}`}
                                                        className={`p-0.5 rounded transition-colors ${(filters[c.key] || []).length > 0
                                                            ? 'text-primary bg-primary/15'
                                                            : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                                                    >
                                                        <Filter size={11} />
                                                    </button>
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((r, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                        {columns.map(c => (
                                            <td
                                                key={c.key}
                                                title={c.type === 'text' ? detailCellValue(r, c.key) : undefined}
                                                className={`px-4 py-2 whitespace-nowrap ${c.type === 'money'
                                                    ? 'text-right tabular-nums text-gray-100 font-medium'
                                                    : 'text-left text-gray-400'} ${c.key === 'block' || c.key === 'client' ? 'max-w-[16rem] truncate' : ''}`}
                                            >
                                                {display(c, r)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="sticky bottom-0">
                                <tr className="bg-[#101010] border-t-2 border-white/10">
                                    {columns.map((c, i) => (
                                        <td
                                            key={c.key}
                                            className={`px-4 py-3 whitespace-nowrap font-bold ${c.type === 'money'
                                                ? 'text-right tabular-nums text-white'
                                                : 'text-left text-gray-300'}`}
                                        >
                                            {c.type === 'money'
                                                ? money(total)
                                                : (i === 0 ? (activeFilters.length > 0 ? 'Filtered Total' : 'Total') : '')}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </motion.div>

            {/* Header filter panel. Fixed, so the table's own overflow cannot clip it. */}
            {openFilter && anchor && (
                <>
                    <div className="fixed inset-0 z-[1150]" onClick={() => setOpenFilter(null)}></div>
                    <div
                        className="fixed z-[1200] w-64 bg-[#0A0A0A] border border-white/20 rounded-lg shadow-2xl ring-1 ring-white/10 overflow-hidden"
                        style={{
                            top: Math.min(anchor.bottom + 6, window.innerHeight - 300),
                            left: Math.max(8, Math.min(anchor.left - 8, window.innerWidth - 268))
                        }}
                    >
                        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-dark-900">
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                                {(allColumns.find(c => c.key === openFilter) || {}).label}
                            </span>
                            {(filters[openFilter] || []).length > 0 && (
                                <button
                                    onClick={() => clearColumn(openFilter)}
                                    className="text-[10px] font-medium text-primary hover:underline"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                        {panelOptions.length > 8 && (
                            <div className="px-2 py-2 border-b border-white/10 flex items-center gap-2">
                                <Search size={12} className="text-gray-500 shrink-0" />
                                <input
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search"
                                    className="w-full bg-transparent text-xs text-white placeholder-gray-500 outline-none"
                                />
                            </div>
                        )}
                        <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                            {/* Ticked when the column excludes nothing. Unticking it clears every
                                box, so a couple of values can then be ticked back on. */}
                            {!search && (
                                <button
                                    type="button"
                                    onClick={() => setAll(openFilter, panelOptions.map(o => o.value),
                                        (filters[openFilter] || []).length > 0)}
                                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 border-b border-white/10 transition-colors"
                                >
                                    <Box checked={(filters[openFilter] || []).length === 0} />
                                    <span className="text-xs font-medium text-gray-200">(Select All)</span>
                                </button>
                            )}
                            {shownOptions.length === 0 ? (
                                <div className="px-3 py-3 text-[11px] text-gray-500">No matches.</div>
                            ) : shownOptions.map(o => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => toggleValue(openFilter, o.value)}
                                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors"
                                >
                                    <Box checked={o.checked} />
                                    <span className={`text-xs truncate flex-1 ${o.checked ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                                        {o.value}
                                    </span>
                                    <span className="text-[10px] text-gray-500 tabular-nums shrink-0">{o.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>,
        document.body
    );
}
