import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, BarChart2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../lib/api";
import { parseDate } from "../lib/utils";

export default function GlobalTimelineModal({ projects, finances, displayCurrency, onClose }) {
    const [projections, setProjections] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Internal currency state for this modal
    const [localCurrency, setLocalCurrency] = useState(displayCurrency === 'Home' ? 'USD' : displayCurrency);

    // Timeline view state
    const [timeGrouping, setTimeGrouping] = useState('month'); // 'week' or 'month'
    const [calendarType, setCalendarType] = useState('FY'); // 'CY' or 'FY'
    const [selectedYears, setSelectedYears] = useState(['All']);
    
    // For hiding/showing chart lines
    const [hiddenLines, setHiddenLines] = useState({
        proj: false,
        prod: false,
        billable: false,
        billed: false,
        receipt: false
    });

    useEffect(() => {
        if (!projects || projects.length === 0) return;
        const allProjections = [];
        projects.forEach(p => {
            if (p.projections && Array.isArray(p.projections)) {
                allProjections.push(...p.projections);
            }
        });
        setProjections(allProjections);
    }, [projects]);

    const exchangeRates = {
        "USD": 90, "EUR": 107, "GBP": 123, "AUD": 63, "CAD": 66, "YEN": 12.9, "INR": 1
    };

    // Calculate Chart Data for Timeline
    const chartData = useMemo(() => {
        const events = {};

        const convertAmt = (amount, fromCurrency, toCurrency) => {
            if (!amount) return 0;
            const fromRate = exchangeRates[fromCurrency] || exchangeRates["USD"];
            const toRate = exchangeRates[toCurrency] || exchangeRates["USD"];
            return (amount * fromRate) / toRate;
        };

        const getLocalDisplayAmount = (amount, originalCurrency) => {
            return convertAmt(amount, originalCurrency, localCurrency);
        };

        const addEvent = (dateStr, type, amount, currency) => {
            if (!dateStr || dateStr === '1970-01-01' || dateStr === '-') return;
            try {
                const d = parseDate(dateStr);
                if (!d || isNaN(d.getTime())) return;
                
                // Format to YYYY-MM-DD to avoid timezone shifts
                const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                if (!events[formatted]) {
                    events[formatted] = {};
                }
                const converted = getLocalDisplayAmount(amount, currency);
                if (Number.isFinite(converted)) {
                    if (events[formatted][type] === undefined) events[formatted][type] = 0;
                    events[formatted][type] += converted;
                }
            } catch(e) {}
        };

        // Projections
        if (Array.isArray(projections)) {
            projections.forEach(proj => {
                let dateRaw = null;
                const projKeys = Object.keys(proj);
                const dateKey = projKeys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('month'));
                if (dateKey) dateRaw = proj[dateKey];
                if (!dateRaw) dateRaw = proj.Revenue_date || proj.revenue_date || proj.month || proj.date || proj['Projection Date'] || proj.Revenue_Date;
                
                let amountRaw = 0;
                const amtKey = projKeys.find(k => k.toLowerCase().includes('amount'));
                if (amtKey) amountRaw = proj[amtKey];
                if (!amountRaw) amountRaw = proj['Amount in USD'] || proj.Amount_in_USD || proj.amount || 0;
                
                const amount = parseFloat(String(amountRaw).replace(/[^0-9.-]+/g, ""));
                
                let curr = 'USD';
                const currKey = projKeys.find(k => k.toLowerCase().includes('currency'));
                if (currKey) curr = proj[currKey];
                
                addEvent(dateRaw, 'proj', amount, curr);
            });
        }

        // Projected Billable from Billable History across all projects
        if (Array.isArray(projects)) {
            projects.forEach(project => {
                if (project.billableHistory && Array.isArray(project.billableHistory)) {
                    project.billableHistory.forEach(bh => {
                        const isNewType = String(bh.Type || bh.type || '').trim().toLowerCase() === 'new';
                        if (isNewType) {
                            const bhAmt = parseFloat(String(bh.Billable_Amount_in_Home_Currency || bh.Amount_in_USD || 0).replace(/[^0-9.-]+/g, ""));
                            addEvent(bh.Billable_date, 'billable', bhAmt, project.Home_Currency || 'USD');
                        }
                    });
                }
            });
        }

        // Finances & Bins across all projects
        const processedReceipts = new Set();

        if (Array.isArray(projects)) {
            projects.forEach(project => {
                if (project.billables && Array.isArray(project.billables)) {
                    project.billables.forEach(bin => {
                        const prodAmt = parseFloat(String(bin.Amount_in_Home_Currency || bin.Billable_Amount_in_Home_Currency || bin.Amount_in_USD || 0).replace(/[^0-9.-]+/g, ""));
                        
                        const isHold = bin.Hold_Billing === true || String(bin.Hold_Billing).toLowerCase() === 'true';
                        
                        if (!isHold) {
                            // Total Billable (Approved_to_Finance = true)
                            const isApprovedToFinance = String(bin.Approved_to_Finance || '').toLowerCase() === 'true';
                            if (isApprovedToFinance) {
                                addEvent(bin.Billable_date, 'prod', prodAmt, project.Home_Currency || 'USD');
                            }
                        }

                        const financeMatch = finances.find(f => f.Billable_id === bin.Billable_id);
                        if (financeMatch && financeMatch.finances) {
                            financeMatch.finances.forEach(inv => {
                                if (inv.Billing_type === 'Credit Note') return;
                                const billedAmt = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                                
                                addEvent(inv.Billed_date, 'billed', billedAmt, 'INR');

                                if (inv.Receipts) {
                                    inv.Receipts.forEach(rec => {
                                        if (rec.Receipt_id && !processedReceipts.has(rec.Receipt_id)) {
                                            processedReceipts.add(rec.Receipt_id);
                                            const recAmt = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                            const recKeys = Object.keys(rec);
                                            const dateKey = recKeys.find(k => k.toLowerCase().includes('date'));
                                            const dateStr = dateKey ? rec[dateKey] : (rec.Receipt_date || rec.Receipt_Date || rec.receipt_date);
                                            
                                            addEvent(dateStr, 'receipt', recAmt, 'INR');
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        const grouped = {};
        
        if (timeGrouping === 'month') {
            const months = calendarType === 'FY' ? 
                ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'] : 
                ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                
            months.forEach(m => {
                grouped[m] = { displayDate: m, proj: null, prod: null, billed: null, receipt: null, billable: null };
            });
        } else {
            let curr = calendarType === 'FY' ? new Date(2024, 3, 1) : new Date(2024, 0, 1);
            const end = calendarType === 'FY' ? new Date(2025, 2, 31) : new Date(2024, 11, 31);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            while (curr <= end) {
                const monthStr = monthNames[curr.getMonth()];
                const weekOfMonth = Math.ceil(curr.getDate() / 7);
                const label = `${monthStr} W${weekOfMonth}`;
                if (!grouped[label]) {
                    grouped[label] = { displayDate: label, proj: null, prod: null, billed: null, receipt: null, billable: null };
                }
                curr.setDate(curr.getDate() + 1);
            }
        }

        const isYearSelected = (dateStr) => {
            if (selectedYears.includes('All')) return true;
            const [yyyy, mm, dd] = dateStr.split('-');
            const d = new Date(yyyy, mm - 1, dd);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            let ptYear;
            if (calendarType === 'FY') {
                ptYear = month >= 4 ? `${year}-${(year+1).toString().slice(2)}` : `${year-1}-${year.toString().slice(2)}`;
            } else {
                ptYear = year.toString();
            }
            return selectedYears.includes(ptYear);
        };

        Object.keys(events).forEach(dateStr => {
            if (!isYearSelected(dateStr)) return;
            
            const pt = events[dateStr];
            const [yyyy, mm, dd] = dateStr.split('-');
            const d = new Date(yyyy, mm - 1, dd);
            
            let key;
            if (timeGrouping === 'month') {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                key = monthNames[d.getMonth()];
            } else {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthStr = monthNames[d.getMonth()];
                const weekOfMonth = Math.ceil(d.getDate() / 7);
                key = `${monthStr} W${weekOfMonth}`;
            }

            if (grouped[key]) {
                if (pt.proj !== undefined) {
                    if (grouped[key].proj === null) grouped[key].proj = 0;
                    grouped[key].proj += pt.proj;
                }
                if (pt.prod !== undefined) {
                    if (grouped[key].prod === null) grouped[key].prod = 0;
                    grouped[key].prod += pt.prod;
                }
                if (pt.billed !== undefined) {
                    if (grouped[key].billed === null) grouped[key].billed = 0;
                    grouped[key].billed += pt.billed;
                }
                if (pt.receipt !== undefined) {
                    if (grouped[key].receipt === null) grouped[key].receipt = 0;
                    grouped[key].receipt += pt.receipt;
                }
                if (pt.billable !== undefined) {
                    if (grouped[key].billable === null) grouped[key].billable = 0;
                    grouped[key].billable += pt.billable;
                }
            }
        });
        
        return Object.values(grouped);
    }, [projections, projects, finances, localCurrency, timeGrouping, calendarType, selectedYears]);

    // Available years for filtering
    const availableYears = useMemo(() => {
        const years = new Set(['All']);
        const dates = [];

        if (Array.isArray(projections)) {
            projections.forEach(proj => {
                let dateRaw = null;
                const projKeys = Object.keys(proj);
                const dateKey = projKeys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('month'));
                if (dateKey) dateRaw = proj[dateKey];
                if (!dateRaw) dateRaw = proj.Revenue_date || proj.revenue_date || proj.month || proj.date || proj['Projection Date'] || proj.Revenue_Date;
                
                if (dateRaw && dateRaw !== '-') {
                    const d = parseDate(dateRaw);
                    if (d && !isNaN(d.getTime())) dates.push(d);
                }
            });
        }

        if (Array.isArray(projects)) {
            projects.forEach(project => {
                if (project.billables && Array.isArray(project.billables)) {
                    project.billables.forEach(bin => {
                        if (bin.Billable_date && bin.Billable_date !== '-') {
                            const d = parseDate(bin.Billable_date);
                            if (d && !isNaN(d.getTime())) dates.push(d);
                        }
                        const financeMatch = finances.find(f => f.Billable_id === bin.Billable_id);
                        if (financeMatch && financeMatch.finances) {
                            financeMatch.finances.forEach(inv => {
                                if (inv.Billed_date && inv.Billed_date !== '-') {
                                    const d = parseDate(inv.Billed_date);
                                    if (d && !isNaN(d.getTime())) dates.push(d);
                                }
                                if (inv.Receipts) {
                                    inv.Receipts.forEach(rec => {
                                        const recKeys = Object.keys(rec);
                                        const dateKey = recKeys.find(k => k.toLowerCase().includes('date'));
                                        const receiptDateRaw = dateKey ? rec[dateKey] : (rec.Receipt_date || rec.Receipt_Date || rec.receipt_date);
                                        
                                        if (receiptDateRaw && receiptDateRaw !== '-') {
                                            const d = parseDate(receiptDateRaw);
                                            if (d && !isNaN(d.getTime())) dates.push(d);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        dates.forEach(d => {
            if (isNaN(d.getTime())) return;
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            
            if (calendarType === 'FY') {
                const fy = month >= 4 ? `${year}-${(year+1).toString().slice(2)}` : `${year-1}-${year.toString().slice(2)}`;
                years.add(fy);
            } else {
                years.add(year.toString());
            }
        });

        return Array.from(years).sort().reverse();
    }, [projections, projects, finances, calendarType]);

    const handleYearToggle = (year) => {
        setSelectedYears(prev => {
            if (year === 'All') return ['All'];
            const newSelection = prev.filter(y => y !== 'All');
            if (newSelection.includes(year)) {
                const filtered = newSelection.filter(y => y !== year);
                return filtered.length === 0 ? ['All'] : filtered;
            } else {
                return [...newSelection, year];
            }
        });
    };

    const targetCurrency = localCurrency;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass-panel rounded-2xl w-full max-w-5xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] my-8 flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-start bg-dark-900 shrink-0 gap-4">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white leading-tight mb-1 flex items-center gap-3">
                            <BarChart2 className="text-primary" />
                            Holistic Timeline Overview
                        </h2>
                        <div className="text-sm text-gray-400">
                            Aggregated metrics across all projects ({targetCurrency})
                        </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-dark-900/50">
                    <div className="space-y-4 flex flex-col h-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {loading && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>}
                                Aggregated Timeline
                            </h3>
                            
                            {/* Timeline Filters */}
                            <div className="flex flex-wrap items-center gap-3 bg-dark-800/50 p-2 rounded-xl border border-white/5">
                                {/* Currency Toggle */}
                                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1">
                                    <button
                                        onClick={() => setLocalCurrency('USD')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${localCurrency === 'USD' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        USD
                                    </button>
                                    <button
                                        onClick={() => setLocalCurrency('INR')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${localCurrency === 'INR' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        INR
                                    </button>
                                </div>

                                <div className="w-px h-6 bg-white/10 hidden md:block"></div>

                                {/* Time Grouping Toggle */}
                                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1">
                                    <button
                                        onClick={() => setTimeGrouping('week')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeGrouping === 'week' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Week
                                    </button>
                                    <button
                                        onClick={() => setTimeGrouping('month')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${timeGrouping === 'month' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Month
                                    </button>
                                </div>

                                <div className="w-px h-6 bg-white/10 hidden md:block"></div>

                                {/* CY/FY Toggle */}
                                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1">
                                    <button
                                        onClick={() => { setCalendarType('CY'); setSelectedYears(['All']); }}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${calendarType === 'CY' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        CY
                                    </button>
                                    <button
                                        onClick={() => { setCalendarType('FY'); setSelectedYears(['All']); }}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${calendarType === 'FY' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        FY
                                    </button>
                                </div>

                                <div className="w-px h-6 bg-white/10 hidden md:block"></div>

                                {/* Year Pills */}
                                <div className="flex flex-wrap items-center gap-1">
                                    {availableYears.map(year => (
                                        <button
                                            key={year}
                                            onClick={() => handleYearToggle(year)}
                                            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors border ${
                                                selectedYears.includes(year)
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-transparent text-gray-500 border-white/5 hover:bg-white/5 hover:text-gray-300'
                                            }`}
                                        >
                                            {year}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-dark-800/50 rounded-xl border border-white/10 p-4 md:p-6 flex flex-col lg:flex-row gap-6 min-h-[400px]">
                            {/* Chart Area */}
                            <div className="flex-1 w-full lg:w-auto min-h-[350px]">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                            <XAxis dataKey="displayDate" stroke="#ffffff50" tick={{ fill: '#ffffff80', fontSize: 12 }} />
                                            <YAxis stroke="#ffffff50" tick={{ fill: '#ffffff80', fontSize: 12 }} tickFormatter={(val) => val >= 1000 ? (val/1000).toFixed(0) + 'k' : val} />
                                            <Tooltip 
                                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#ffffff20', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value, name) => [Math.round(value).toLocaleString('en-US'), name]}
                                    cursor={{ stroke: '#ffffff10' }}
                                />
                                {!hiddenLines.proj && <Line type="monotone" dataKey="proj" name="Business Projection" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} connectNulls={true} isAnimationActive={true} animationDuration={800} />}
                                {!hiddenLines.billable && <Line type="monotone" dataKey="billable" name="Projected Billable" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} connectNulls={true} isAnimationActive={true} animationDuration={800} />}
                                {!hiddenLines.prod && <Line type="monotone" dataKey="prod" name="Total Billable" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} activeDot={{ r: 5 }} connectNulls={true} isAnimationActive={true} animationDuration={800} />}
                                {!hiddenLines.billed && <Line type="monotone" dataKey="billed" name="Billed" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} connectNulls={true} isAnimationActive={true} animationDuration={800} />}
                                {!hiddenLines.receipt && <Line type="monotone" dataKey="receipt" name="Receipt" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} activeDot={{ r: 5 }} connectNulls={true} isAnimationActive={true} animationDuration={800} />}
                            </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">No timeline data available.</div>
                                )}
                            </div>

                            {/* Custom Legend */}
                            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3 border-l border-white/10 pl-0 lg:pl-6">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Toggle Metrics</div>
                                {[
                                    { id: 'proj', label: 'Business Projection', color: '#f59e0b' },
                                    { id: 'billable', label: 'Projected Billable', color: '#3b82f6' },
                                    { id: 'prod', label: 'Total Billable', color: '#06b6d4' },
                                    { id: 'billed', label: 'Billed', color: '#10b981' },
                                    { id: 'receipt', label: 'Receipt', color: '#8b5cf6' },
                                ].map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setHiddenLines(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                        className={`flex items-center gap-3 p-2.5 rounded-lg transition-all border text-left ${
                                            hiddenLines[item.id] 
                                                ? 'bg-transparent border-white/5 opacity-40' 
                                                : 'bg-white/5 border-white/10 shadow-sm'
                                        } hover:bg-white/10`}
                                    >
                                        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: hiddenLines[item.id] ? '#555' : item.color }}></div>
                                        <span className={`text-xs font-bold ${hiddenLines[item.id] ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                            {item.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
