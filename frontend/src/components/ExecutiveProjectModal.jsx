import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Briefcase, Play, DollarSign, Clock, BarChart2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../lib/api";
import { parseDate } from "../lib/utils";

export default function ExecutiveProjectModal({ project, finances, onClose }) {
    const [activeTab, setActiveTab] = useState('business');
    const [displayCurrency, setDisplayCurrency] = useState('Home');
    const [projections, setProjections] = useState([]);
    const [loading, setLoading] = useState(false);
    
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
        if (project.projections && Array.isArray(project.projections)) {
            setProjections(project.projections);
        } else {
            setProjections([]);
        }
    }, [project]);

    const exchangeRates = {
        "USD": 90, "EUR": 107, "GBP": 123, "AUD": 63, "CAD": 66, "YEN": 12.9, "INR": 1
    };

    const convertAmount = (amount, fromCurrency, toCurrency) => {
        if (!amount) return 0;
        const fromRate = exchangeRates[fromCurrency] || exchangeRates["USD"];
        const toRate = exchangeRates[toCurrency] || exchangeRates["USD"];
        // Convert to INR first, then to target
        const inrAmount = amount * fromRate;
        return inrAmount / toRate;
    };

    const getDisplayAmount = (amount, originalCurrency) => {
        if (displayCurrency === 'Home') {
            return convertAmount(amount, originalCurrency, project.Home_Currency || 'USD');
        } else if (displayCurrency === 'INR') {
            return convertAmount(amount, originalCurrency, 'INR');
        } else if (displayCurrency === 'USD') {
            return convertAmount(amount, originalCurrency, 'USD');
        }
        return amount;
    };

    const getDisplayCurrencyStr = () => {
        if (displayCurrency === 'Home') return project.Home_Currency || 'USD';
        return displayCurrency;
    };

    // Calculate aggregated finance stats
    const aggregatedFinances = useMemo(() => {
        let totalProdApproved = 0;
        let totalBilledInr = 0;
        let totalReceiptInr = 0;

        const processedInvoices = new Set();
        const processedReceipts = new Set();

        if (project.billables && Array.isArray(project.billables)) {
            project.billables.forEach(billable => {
                const isApproved = String(billable['Approved_to_Finance'] || '').toLowerCase() === 'true';
                if (isApproved) {
                    const billableHomeAmt = parseFloat(String(billable['Amount_in_Home_Currency'] || billable['Billable_Amount_in_Home_Currency'] || billable['Amount_in_USD'] || 0).replace(/[^0-9.-]+/g, "")) || 0;
                    totalProdApproved += billableHomeAmt;
                }

                const financeMatch = finances.find(f => f.Billable_id === billable['Billable_id']);
                if (financeMatch && financeMatch.finances) {
                    financeMatch.finances.forEach(inv => {
                        if (inv.Billing_type === 'Credit Note') return;
                        
                        // We do NOT deduplicate billed amount because it's proportionally split across billables.
                        const billedInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                        totalBilledInr += billedInr;

                        if (inv.Receipts) {
                            inv.Receipts.forEach(rec => {
                                // Receipts are NOT split, so they are duplicated across backend rows. We MUST deduplicate them here.
                                if (rec.Receipt_id && !processedReceipts.has(rec.Receipt_id)) {
                                    processedReceipts.add(rec.Receipt_id);
                                    const receiptInr = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                    totalReceiptInr += receiptInr;
                                }
                            });
                        }
                    });
                }
            });
        }

        const homeCurr = project.Home_Currency || 'USD';
        const rateHomeToInr = exchangeRates[homeCurr] || exchangeRates["USD"];

        let displayProdApproved = 0;
        let displayBilled = 0;
        let displayReceipt = 0;

        if (displayCurrency === 'Home') {
            displayProdApproved = totalProdApproved;
            displayBilled = totalBilledInr / rateHomeToInr;
            displayReceipt = totalReceiptInr / rateHomeToInr;
        } else if (displayCurrency === 'INR') {
            displayProdApproved = totalProdApproved * rateHomeToInr;
            displayBilled = totalBilledInr;
            displayReceipt = totalReceiptInr;
        } else if (displayCurrency === 'USD') {
            displayProdApproved = (totalProdApproved * rateHomeToInr) / exchangeRates['USD'];
            displayBilled = totalBilledInr / exchangeRates['USD'];
            displayReceipt = totalReceiptInr / exchangeRates['USD'];
        }

        const displayBillable = Math.max(0, displayProdApproved - displayBilled);
        const displayOutstanding = Math.max(0, displayBilled - displayReceipt);

        return {
            displayProdApproved,
            displayBilled,
            displayBillable,
            displayReceipt,
            displayOutstanding,
            maxVal: Math.max(displayProdApproved, displayBilled, displayBillable, displayReceipt, displayOutstanding, 1)
        };

    }, [project, finances, displayCurrency]);


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
            if (displayCurrency === 'Home') return convertAmt(amount, originalCurrency, project.Home_Currency || 'USD');
            if (displayCurrency === 'INR') return convertAmt(amount, originalCurrency, 'INR');
            if (displayCurrency === 'USD') return convertAmt(amount, originalCurrency, 'USD');
            return amount;
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
                // Try to find the date key dynamically in case of whitespace or different casing
                let dateRaw = null;
                const projKeys = Object.keys(proj);
                const dateKey = projKeys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('month'));
                if (dateKey) dateRaw = proj[dateKey];
                // fallback to hardcoded
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

        // Projected Billable from Billable History
        if (project.billableHistory && Array.isArray(project.billableHistory)) {
            project.billableHistory.forEach(bh => {
                const isNewType = String(bh.Type || bh.type || '').trim().toLowerCase() === 'new';
                if (isNewType) {
                    const bhAmt = parseFloat(String(bh.Billable_Amount_in_Home_Currency || bh.Amount_in_USD || 0).replace(/[^0-9.-]+/g, ""));
                    addEvent(bh.Billable_date, 'billable', bhAmt, project.Home_Currency || 'USD');
                }
            });
        }

        // Finances & Bins
        const processedReceipts = new Set();
        
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

        const grouped = {};
        
        if (timeGrouping === 'month') {
            const months = calendarType === 'FY' ? 
                ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'] : 
                ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                
            months.forEach(m => {
                grouped[m] = { displayDate: m, proj: null, prod: null, billed: null, receipt: null, billable: null };
            });
        } else {
            // Generate standard weeks using a generic leap year (2024)
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
            // Safe parse date avoiding UTC timezone shifts
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

        // Map events onto the generic timeline
        Object.keys(events).forEach(dateStr => {
            if (!isYearSelected(dateStr)) return;
            
            const pt = events[dateStr];
            
            // Safe parse date avoiding UTC timezone shifts
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
        
        // After all data is populated, calculate Billable across the timeline
        // The billable amounts have already been perfectly isolated to their respective months via the 'Status' check above.
        // We just need to convert the grouped object into an array.
        const finalGrouped = Object.values(grouped);

        return finalGrouped;
    }, [projections, project, finances, displayCurrency, timeGrouping, calendarType, selectedYears]);

    // Available years for filtering based on actual chart data (before filtering)
    const availableYears = useMemo(() => {
        const years = new Set(['All']);
        
        // Use raw events to determine available years so filter options don't disappear when selected
        // We can re-run a simplified version of the timeline builder here
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
    }, [projections, project, finances, calendarType]);

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

    const renderBusinessTab = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-white mb-4">Projections Overview</h3>
            {loading ? (
                <div className="text-gray-500 text-center py-8">Loading projections...</div>
            ) : projections.length > 0 ? (
                <div className="bg-dark-800/50 rounded-xl border border-white/10 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Amount ({getDisplayCurrencyStr()})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projections.map((proj, idx) => {
                                // determine projection currency
                                const projKeys = Object.keys(proj);
                                let amountRaw = 0;
                                const amtKey = projKeys.find(k => k.toLowerCase().includes('amount'));
                                if (amtKey) amountRaw = proj[amtKey];
                                if (!amountRaw) amountRaw = proj['Amount in USD'] || proj.Amount_in_USD || proj.amount || 0;
                                const amount = parseFloat(String(amountRaw).replace(/[^0-9.-]+/g, ""));
                                
                                let curr = 'USD';
                                const currKey = projKeys.find(k => k.toLowerCase().includes('currency'));
                                if (currKey) curr = proj[currKey];
                                
                                const displayAmt = getDisplayAmount(amount, curr);
                                
                                let dateRaw = null;
                                const dateKey = projKeys.find(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('month'));
                                if (dateKey) dateRaw = proj[dateKey];
                                if (!dateRaw) dateRaw = proj.Revenue_date || proj.revenue_date || proj.month || proj.date || proj.Revenue_Date || '-';
                                
                                let displayDate = dateRaw;
                                if (dateRaw && dateRaw !== '-') {
                                    const d = parseDate(dateRaw);
                                    if (d && !isNaN(d.getTime())) {
                                        displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                    }
                                }

                                return (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-sm text-gray-300">{displayDate}</td>
                                        <td className="p-4 text-sm font-mono text-white text-right">{Math.round(displayAmt).toLocaleString('en-US')}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-gray-500 text-center py-8 bg-dark-800/30 rounded-xl border border-white/5">No projections found for this project.</div>
            )}
        </div>
    );

    const renderProductionTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Work Order & Bins</h3>
                {project.Work_Order ? (
                    <a href={project.Work_Order} target="_blank" rel="noreferrer" className="px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg text-sm font-semibold transition-colors border border-blue-500/20">
                        View Work Order
                    </a>
                ) : (
                    <span className="text-sm text-gray-500">No Work Order Link</span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {project.billables && project.billables.length > 0 ? project.billables.map((bin, idx) => {
                    const binAmount = parseFloat(String(bin.Amount_in_Home_Currency || bin.Billable_Amount_in_Home_Currency || bin.Amount_in_USD || 0).replace(/[^0-9.-]+/g, ""));
                    const displayAmt = getDisplayAmount(binAmount, project.Home_Currency || 'USD');
                    const isApproved = String(bin.Approved_to_Finance || '').toLowerCase() === 'true';
                    
                    return (
                        <div key={idx} className="bg-dark-800/50 rounded-xl border border-white/10 p-5 flex flex-col hover:border-white/20 transition-colors relative">
                            {/* Approved Badge */}
                            <div className="absolute top-4 right-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                    isApproved 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                    {isApproved ? 'Approved' : 'Not Approved'}
                                </span>
                            </div>
                            
                            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full pr-24">
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Bin Number</label>
                                                <div className="text-white font-bold">{bin.Bin_number || bin.Bin_Number || '-'}</div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Type</label>
                                                <div className="text-gray-300">{bin.Type || bin.type || '-'}</div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Status</label>
                                                <div className={`font-medium ${
                                                    (bin.Hold_Billing === true || String(bin.Hold_Billing).toLowerCase() === 'true') ? 'text-yellow-400' :
                                                    String(bin.Status || bin.status || '').toLowerCase() === 'billed' ? 'text-emerald-400' :
                                                    String(bin.Status || bin.status || '').toLowerCase() === 'billable' ? 'text-blue-400' :
                                                    'text-gray-300'
                                                }`}>
                                                    {(bin.Hold_Billing === true || String(bin.Hold_Billing).toLowerCase() === 'true') ? 'Hold' : (bin.Status || bin.status || '-')}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">Billable Date</label>
                                                <div className="text-gray-300">{bin.Billable_date || bin.billable_date || '-'}</div>
                                            </div>
                                            <div className="md:col-span-4 border-t border-white/10 pt-4 mt-2 flex justify-between items-center">
                                                 <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Bin Value ({getDisplayCurrencyStr()})</label>
                                                 <div className="font-mono text-emerald-400 font-bold text-lg">{Math.round(displayAmt).toLocaleString('en-US')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                )
                }) : (
                    <div className="text-gray-500 text-center py-8 bg-dark-800/30 rounded-xl border border-white/5">No bins found.</div>
                )}
            </div>
        </div>
    );

    // Calculate grouped invoices for breakdown
    const groupedInvoices = useMemo(() => {
        const groups = {};
        const pending = [];

        if (project.billables && Array.isArray(project.billables)) {
            project.billables.forEach(bin => {
                const financeMatch = finances.find(f => f.Billable_id === bin.Billable_id);
                if (!financeMatch || !financeMatch.finances || financeMatch.finances.length === 0) return;

                financeMatch.finances.forEach(inv => {
                    if (inv.Billing_type === 'Credit Note') return;
                    
                    const invBilledInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                    
                    if (inv.Invoice_Number) {
                        if (!groups[inv.Invoice_Number]) {
                            groups[inv.Invoice_Number] = {
                                Invoice_Number: inv.Invoice_Number,
                                bins: [],
                                dates: new Set(),
                                billedInr: 0,
                                receiptInr: 0,
                                receiptIds: new Set()
                            };
                        }
                        const group = groups[inv.Invoice_Number];
                        if (bin.Bin_number || bin.Bin_Number) group.bins.push(bin.Bin_number || bin.Bin_Number);
                        if (inv.Billed_date && inv.Billed_date !== '-') group.dates.add(inv.Billed_date);
                        group.billedInr += invBilledInr;

                        if (inv.Receipts) {
                            inv.Receipts.forEach(r => {
                                if (r.Receipt_id && !group.receiptIds.has(r.Receipt_id)) {
                                    group.receiptIds.add(r.Receipt_id);
                                    group.receiptInr += parseFloat(String(r.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                }
                            });
                        }
                    } else {
                        // Pending invoices
                        let recInr = 0;
                        const rIds = new Set();
                        if (inv.Receipts) {
                            inv.Receipts.forEach(r => {
                                if (r.Receipt_id && !rIds.has(r.Receipt_id)) {
                                    rIds.add(r.Receipt_id);
                                    recInr += parseFloat(String(r.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                }
                            });
                        }
                        pending.push({
                            Invoice_Number: 'Pending',
                            bins: [bin.Bin_number || bin.Bin_Number].filter(Boolean),
                            dates: (inv.Billed_date && inv.Billed_date !== '-') ? new Set([inv.Billed_date]) : new Set(),
                            billedInr: invBilledInr,
                            receiptInr: recInr
                        });
                    }
                });
            });
        }
        
        return [...Object.values(groups), ...pending].map(g => ({
            ...g,
            bins: [...new Set(g.bins)],
            dates: [...g.dates]
        }));
    }, [project, finances]);

    const renderFinanceTab = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-bold text-white mb-4">Financial Summary</h3>
            
            {/* Project Overall Finance Summary */}
            <div className="bg-dark-800/80 rounded-xl border border-white/10 p-6">
                <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                    <BarChart2 size={16} className="text-primary" /> Overall Summary ({getDisplayCurrencyStr()})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {[
                        { label: 'Total Billable', value: aggregatedFinances.displayProdApproved, color: 'bg-blue-500' },
                        { label: 'Yet to Bill', value: aggregatedFinances.displayBillable, color: 'bg-cyan-500' },
                        { label: 'Billed', value: aggregatedFinances.displayBilled, color: 'bg-emerald-500' },
                        { label: 'Receipt', value: aggregatedFinances.displayReceipt, color: 'bg-purple-500' },
                        { label: 'Outstanding', value: aggregatedFinances.displayOutstanding, color: aggregatedFinances.displayOutstanding > 0 ? 'bg-red-500' : 'bg-gray-500' }
                    ].map((stat, i) => (
                        <div key={i} className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] text-gray-400 uppercase font-semibold">{stat.label}</span>
                                <span className="text-sm font-mono text-white font-bold">{Math.round(stat.value).toLocaleString('en-US')}</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${stat.color} transition-all duration-500`} 
                                    style={{ width: `${(stat.value / aggregatedFinances.maxVal) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Individual Finance IDs */}
            <div className="space-y-4">
                <h4 className="text-sm font-bold text-white mt-8 mb-4">Invoices & Receipts Breakdown</h4>
                {groupedInvoices.length > 0 ? groupedInvoices.map((inv, idx) => {
                    const rateHomeToInr = exchangeRates[project.Home_Currency || 'USD'] || exchangeRates["USD"];
                    
                    let dispBilled = 0;
                    let dispReceipt = 0;

                    if (displayCurrency === 'Home') {
                        dispBilled = inv.billedInr / rateHomeToInr;
                        dispReceipt = inv.receiptInr / rateHomeToInr;
                    } else if (displayCurrency === 'INR') {
                        dispBilled = inv.billedInr;
                        dispReceipt = inv.receiptInr;
                    } else if (displayCurrency === 'USD') {
                        dispBilled = inv.billedInr / exchangeRates['USD'];
                        dispReceipt = inv.receiptInr / exchangeRates['USD'];
                    }

                    const dispOut = Math.max(0, dispBilled - dispReceipt);

                    return (
                        <div key={idx} className="bg-dark-800/30 rounded-xl border border-white/5 p-4 flex flex-col md:flex-row justify-between gap-4 hover:border-white/10 transition-colors">
                            <div className="flex-1">
                                <div className="text-xs text-gray-500 font-bold uppercase mb-1">Invoice: <span className="text-white">{inv.Invoice_Number}</span></div>
                                <div className="text-sm text-gray-400">
                                    <span className="font-medium text-gray-300">Bins:</span> {inv.bins.length > 0 ? inv.bins.join(', ') : '-'} | <span className="font-medium text-gray-300">Date:</span> {inv.dates.length > 0 ? inv.dates.join(', ') : '-'}
                                </div>
                            </div>
                            <div className="flex gap-6 items-center shrink-0">
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Billed</div>
                                    <div className="font-mono text-emerald-400 font-bold">{Math.round(dispBilled).toLocaleString('en-US')}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Receipt</div>
                                    <div className="font-mono text-purple-400 font-bold">{Math.round(dispReceipt).toLocaleString('en-US')}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Outstanding</div>
                                    <div className={`font-mono font-bold ${dispOut > 0 ? 'text-red-400' : 'text-gray-400'}`}>{Math.round(dispOut).toLocaleString('en-US')}</div>
                                </div>
                            </div>
                        </div>
                    )
                }) : (
                    <div className="text-gray-500 text-center py-8 bg-dark-800/30 rounded-xl border border-white/5">No invoices found for this project.</div>
                )}
            </div>
        </div>
    );

    const renderTimelineTab = () => (
        <div className="space-y-4 flex flex-col h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <h3 className="text-lg font-bold text-white">Project Timeline</h3>
                
                {/* Timeline Filters */}
                <div className="flex flex-wrap items-center gap-3 bg-dark-800/50 p-2 rounded-xl border border-white/5">
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
    );


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
                            {project.Block_Name || project.DealName || 'Untitled Project'}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span className="font-medium text-gray-300">{project.Client || 'Unknown Client'}</span>
                            <span className="w-1 h-1 rounded-full bg-white/20"></span>
                            <span>{project.Contracting_Office || 'Unknown Office'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        {/* Currency Toggle inside Modal */}
                        <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-lg p-1">
                            {['Home', 'USD', 'INR'].map((cur) => {
                                const displayLabel = cur === 'Home' ? `Home (${project.Home_Currency || 'N/A'})` : cur;
                                return (
                                <button
                                    key={cur}
                                    type="button"
                                    onClick={() => setDisplayCurrency(cur)}
                                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                        displayCurrency === cur 
                                            ? 'bg-primary text-white shadow-md' 
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {displayLabel}
                                </button>
                                );
                            })}
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4 flex gap-2 border-b border-white/10 shrink-0 overflow-x-auto custom-scrollbar">
                    {[
                        { id: 'business', label: 'Business', icon: <Briefcase size={16} /> },
                        { id: 'production', label: 'Production', icon: <Play size={16} /> },
                        { id: 'finance', label: 'Finance', icon: <DollarSign size={16} /> },
                        { id: 'timeline', label: 'Timeline Overview', icon: <Clock size={16} /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-3 text-sm font-bold rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
                                activeTab === tab.id 
                                    ? 'bg-white/10 text-white border-t border-x border-white/10' 
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-dark-900/50">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'business' && renderBusinessTab()}
                            {activeTab === 'production' && renderProductionTab()}
                            {activeTab === 'finance' && renderFinanceTab()}
                            {activeTab === 'timeline' && renderTimelineTab()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
