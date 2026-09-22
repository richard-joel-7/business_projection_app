import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Copy, Check, ListTree } from "lucide-react";
import { PROJECTION_DETAIL_COLUMNS } from "../lib/businessProjection";
import { formatDayMonthYear } from "../lib/utils";

// The rows behind a single Business Projection cell. Opened by clicking the figure, same
// gesture and visual language as Revenue Operations' own detail modal: a header with the
// period/stage/currency it was clicked from, an optional-columns strip (just Biz PoC here),
// a copy-as-TSV button, and a total row that must add up to the figure that was clicked.
export default function BusinessProjectionDetailModal({ periodLabel, stage, block, currency, rows, onClose }) {
    const [revealed, setRevealed] = useState([]);
    const [isCopied, setIsCopied] = useState(false);

    const optional = PROJECTION_DETAIL_COLUMNS.filter(c => c.optional);
    const columns = PROJECTION_DETAIL_COLUMNS.filter(c => !c.optional || revealed.includes(c.key));

    const symbol = currency === 'INR' ? '₹' : '$';
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    const money = (v) => `${symbol}${Math.round(v || 0).toLocaleString(locale)}`;

    const total = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows]);

    const toggleOptional = (key) => setRevealed(prev =>
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

    const display = (col, row) => {
        if (col.type === 'date') return formatDayMonthYear(row.date) || '-';
        if (col.type === 'money') return money(row.amount);
        return row[col.key] || '-';
    };
    // Excel wants a bare number, so the copied amount carries no symbol or grouping.
    const plain = (col, row) => {
        if (col.type === 'date') return formatDayMonthYear(row.date);
        if (col.type === 'money') return String(Math.round(row.amount || 0));
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
            ...rows.map(r => columns.map(c => plain(c, r)).join('\t'))
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

    // Rendered through a portal straight onto <body>: BusinessProjectionTable's own root
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
                className="glass-panel rounded-2xl w-full max-w-3xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] my-8 flex flex-col max-h-[88vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-dark-900 shrink-0 gap-4">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-white leading-tight mb-1 flex items-center gap-3">
                            <ListTree className="text-primary shrink-0" size={20} />
                            <span className="truncate">Business Projection</span>
                        </h2>
                        <div className="text-sm text-gray-400 truncate">
                            {periodLabel} · {stage || 'All Stages'}{block ? ` · ${block}` : ''} · {currency}
                            <span className="text-gray-600"> · </span>
                            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
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

                {/* Optional columns */}
                {optional.length > 0 && (
                    <div className="px-6 py-3 border-b border-white/10 bg-dark-900/60 shrink-0 flex flex-wrap items-center gap-2">
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
                    </div>
                )}

                {/* Rows */}
                <div className="flex-1 overflow-auto custom-scrollbar bg-dark-900/50">
                    {rows.length === 0 ? (
                        <div className="p-10 text-center text-sm text-gray-500">
                            Nothing behind this figure.
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
                                            {c.label}{c.type === 'money' ? ` (${currency})` : ''}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                                        {columns.map(c => (
                                            <td
                                                key={c.key}
                                                title={c.type === 'text' ? (r[c.key] || '-') : undefined}
                                                className={`px-4 py-2 whitespace-nowrap ${c.type === 'money'
                                                    ? 'text-right tabular-nums text-gray-100 font-medium'
                                                    : 'text-left text-gray-400'} ${c.key === 'block' ? 'max-w-[16rem] truncate' : ''}`}
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
                                            {c.type === 'money' ? money(total) : (i === 0 ? 'Total' : '')}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
