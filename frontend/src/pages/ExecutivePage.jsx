import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/Input";
import { MultiSelect } from "../components/ui/MultiSelect";
import api from "../lib/api";
import { Search, ArrowLeft, LogOut, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ExecutiveProjectModal from "../components/ExecutiveProjectModal";
import GlobalTimelineModal from "../components/GlobalTimelineModal";
import { parseDate, getFY, getCY } from "../lib/utils";

export default function ExecutivePage() {
    const { user, logout } = useAuth();
    const { projects: bizProjects, fetchProjects: fetchBizProjects } = useData();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const parseAmount = (value) => {
        return parseFloat(String(value ?? "").replace(/[^0-9.-]+/g, "")) || 0;
    };

    const [projects, setProjects] = useState([]);
    const [finances, setFinances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [logoSrc, setLogoSrc] = useState("pixoo-black-logo.png");
    const [selectedProject, setSelectedProject] = useState(null);
    const [isGlobalTimelineOpen, setIsGlobalTimelineOpen] = useState(false);
    
    // New states for Executive Hub Filters
    const [yearType, setYearType] = useState("FY"); // "FY" or "CY"
    const [selectedFYs, setSelectedFYs] = useState([]);
    const [selectedOffices, setSelectedOffices] = useState([]);

    const fetchExecutiveData = async () => {
        try {
            setLoading(true);
            setError("");
            const userRoles = String(user?.role || "").split(",").map(r => r.trim().toLowerCase());
            const fetchAsAdmin = user?.isAdmin || userRoles.includes("executive");
            
            // Fetch both production projects and finances concurrently
            const [prodData, finData] = await Promise.all([
                api.getProductionProjects(user?.email, fetchAsAdmin, user?.role),
                api.getFinances()
            ]);

            if (Array.isArray(prodData)) setProjects(prodData);
            else setProjects([]);

            if (Array.isArray(finData)) setFinances(finData);
            else setFinances([]);

        } catch (err) {
            console.error("Failed to fetch executive data", err);
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchExecutiveData();
            fetchBizProjects();
        }
        const cachedLogo = localStorage.getItem('app_logo');
        if (cachedLogo) {
            setLogoSrc(cachedLogo);
        }
    }, [user]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    const [displayCurrency, setDisplayCurrency] = useState("Home");

    const exchangeRates = {
        "USD": 90, "EUR": 107, "GBP": 123, "AUD": 63, "CAD": 66, "YEN": 12.9, "INR": 1
    };
    const usdToInrRate = 90;

    const aggregatedProjects = useMemo(() => {
        const groups = {};
        projects.forEach(p => {
            const id = p['Block_id'];
            const key = id ? String(id).trim() : Math.random().toString();
            
            const bizP = bizProjects.find(bp => String(bp['Project ID'] || bp['Block_id']).trim() === String(id).trim());
            const projections = bizP ? (bizP.projections || []) : [];

            if (!groups[key]) {
                groups[key] = { 
                    ...p, 
                    projections,
                    'Home_Amount': parseAmount(p['Home_Amount'] || p['Value in Home Currency'] || 0),
                    'Close_Date': p['DealclosingDate'] || p['Close_Date'] || '1970-01-01'
                };
            }
        });

        // Now calculate financial summary for each unique block
        return Object.values(groups).map(project => {
            let totalBillable = 0;
            let totalBilledHome = 0;
            let totalBilledInr = 0;
            let totalReceiptHome = 0;
            let totalReceiptInr = 0;
            let totalOtherChargesHome = 0;
            let totalOutstandingInr = 0;
            let totalOutstandingHome = 0;

            const processedReceipts = new Set();
            const processedInvoices = new Set();

            // Go through the project's billables
            if (project.billables && Array.isArray(project.billables)) {
                project.billables.forEach(billable => {
                    const isApproved = String(billable['Approved_to_Finance'] || '').toLowerCase() === 'true';
                    let billableHomeAmt = 0;
                    if (isApproved) {
                        billableHomeAmt = parseAmount(billable['Amount_in_Home_Currency'] || billable['Billable_Amount_in_Home_Currency'] || billable['Amount_in_USD'] || 0); // fallback
                        totalBillable += billableHomeAmt;
                    }

                    // Find corresponding finance data
                    const billableId = billable['Billable_id'];
                    const financeMatch = finances.find(f => f.Billable_id === billableId);
                    if (financeMatch && financeMatch.finances) {
                        financeMatch.finances.forEach(inv => {
                            if (inv.Billing_type === 'Credit Note') return;
                            
                            // As requested: if an invoice is raised, consider Billable_home_amount as billed_home_amount
                            // This specifically adds THIS billable's portion to the total billed home amount.
                            if (inv.Invoice_Number) {
                                totalBilledHome += billableHomeAmt;
                            }
                            
                            const billedInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                            const exchangeRate = parseFloat(String(inv.Exchange_Rate).replace(/[^0-9.-]+/g, "")) || 1;
                            const exchangeDiff = parseFloat(String(inv.Exchange_Diff).replace(/[^\d.-]/g, '')) || 0;
                            const bankCharges = parseFloat(String(inv.Bank_Charges).replace(/[^0-9.-]+/g, "")) || 0;
                            const tds = parseFloat(String(inv.TDS).replace(/[^0-9.-]+/g, "")) || 0;
                            const totalGstInr = parseFloat(String(inv['Total Amount + GST (INR)']).replace(/[^0-9.-]+/g, "")) || 0;
                            const gstReceived = parseFloat(String(inv.GST_Received).replace(/[^0-9.-]+/g, "")) || 0;
                            
                            const deductionsInr = bankCharges + tds;
                            
                            // We deduplicate INR amounts because inv.Billed_Amount_in_Inr is the total for the entire invoice!
                            // If multiple billables are merged, we only want to add the invoice's total INR amount once.
                            if (!processedInvoices.has(inv.Finance_id || inv.Invoice_Number)) {
                                processedInvoices.add(inv.Finance_id || inv.Invoice_Number);
                                totalBilledInr += billedInr;
                                
                                let avgReceiptExchangeRate = 0;
                                if (inv.Receipts && inv.Receipts.length > 0) {
                                    let totalRates = 0;
                                    let validRatesCount = 0;
                                    inv.Receipts.forEach(r => {
                                        const rate = parseFloat(String(r.Exchange_rate).replace(/[^0-9.-]+/g, ""));
                                        if (rate > 0) {
                                            totalRates += rate;
                                            validRatesCount++;
                                        }
                                    });
                                    if (validRatesCount > 0) {
                                        avgReceiptExchangeRate = totalRates / validRatesCount;
                                    }
                                }
                                
                                const divisorRate = avgReceiptExchangeRate > 0 ? avgReceiptExchangeRate : exchangeRate;
                                const invOtherChargesHome = divisorRate > 0 ? (deductionsInr / divisorRate) : deductionsInr;
                                totalOtherChargesHome += invOtherChargesHome;
                                
                                let invReceiptTotalInr = 0;
                                let invReceiptTotalHome = 0;
                                inv.Receipts?.forEach(r => {
                                    invReceiptTotalHome += parseFloat(String(r.Receipt_Home_Amount || r['Receipt_Home Amount']).replace(/[^0-9.-]+/g, "")) || 0;
                                    invReceiptTotalInr += parseFloat(String(r.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                });
                                
                                const baseInr = totalGstInr > 0 ? totalGstInr : billedInr;
                                const invOutstandingInr = baseInr - gstReceived - invReceiptTotalInr - tds - exchangeDiff - bankCharges;
                                totalOutstandingInr += invOutstandingInr;
                            }

                            if (inv.Receipts) {
                                inv.Receipts.forEach(rec => {
                                    if (rec.Receipt_id && !processedReceipts.has(rec.Receipt_id)) {
                                        processedReceipts.add(rec.Receipt_id);
                                        const receiptInr = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                        const receiptHome = parseFloat(String(rec.Receipt_Home_Amount || rec['Receipt_Home Amount'] || 0).replace(/[^0-9.-]+/g, "")) || 0;
                                        
                                        totalReceiptInr += receiptInr;
                                        totalReceiptHome += receiptHome;
                                    }
                                });
                            }
                        });
                    }
                });
            }

            const outstandingInr = totalOutstandingInr;
            totalOutstandingHome = totalBilledHome - totalReceiptHome - totalOtherChargesHome;
            if (Math.abs(totalOutstandingHome) < 0.01) {
                totalOutstandingHome = 0;
            }
            const outstandingHome = totalOutstandingHome;
            
            let paymentStatus = 'Partially Paid';
            if (totalBilledInr === 0) paymentStatus = 'Not Paid';
            else if (totalReceiptInr === 0) paymentStatus = 'Not Paid';
            else if (outstandingInr <= 0.05) paymentStatus = 'Paid';

            // Convert to correct display currency
            let displayAwarded = 0;
            let displayProdApproved = 0;
            let displayBilled = 0;
            let displayBillable = 0;
            let displayReceipt = 0;
            let displayOtherCharges = 0;
            let displayOutstanding = 0;
            let displayCurrStr = "";

            const homeCurr = project['Home_Currency'] || project['Currency'] || project['Home Currency'] || '';
            const rateHomeToInr = exchangeRates[homeCurr] || exchangeRates["USD"];

            if (displayCurrency === "Home") {
                displayAwarded = project.Home_Amount;
                displayProdApproved = totalBillable;
                displayBilled = totalBilledHome;
                displayReceipt = totalReceiptHome;
                displayOtherCharges = totalOtherChargesHome;
                displayOutstanding = outstandingHome;
                displayCurrStr = homeCurr;
            } else if (displayCurrency === "INR") {
                displayAwarded = project.Home_Amount * rateHomeToInr;
                displayProdApproved = totalBillable * rateHomeToInr;
                displayBilled = totalBilledInr;
                displayReceipt = totalReceiptInr;
                displayOtherCharges = totalOtherChargesHome * rateHomeToInr;
                displayOutstanding = outstandingInr;
                displayCurrStr = "INR";
            } else if (displayCurrency === "USD") {
                const homeToUsd = rateHomeToInr / exchangeRates["USD"];
                displayAwarded = project.Home_Amount * homeToUsd;
                displayProdApproved = totalBillable * homeToUsd;
                displayBilled = totalBilledInr / exchangeRates["USD"];
                displayReceipt = totalReceiptInr / exchangeRates["USD"];
                displayOtherCharges = (totalOtherChargesHome * rateHomeToInr) / exchangeRates["USD"];
                displayOutstanding = outstandingInr / exchangeRates["USD"];
                displayCurrStr = "USD";
            }
            
            // New derived metric: Billable = Production Approved - Billed Amount
            displayBillable = Math.max(0, displayProdApproved - displayBilled);

            return {
                ...project,
                summary: {
                    displayAwarded,
                    displayProdApproved,
                    displayBillable,
                    displayBilled,
                    displayReceipt,
                    displayOtherCharges,
                    displayOutstanding,
                    displayCurrStr,
                    paymentStatus,
                    maxVal: Math.max(displayProdApproved, displayBilled, displayBillable, displayReceipt, displayOutstanding, displayOtherCharges, 1)
                }
            };
        });
    }, [projects, bizProjects, finances, displayCurrency]);

    const filterOptions = useMemo(() => {
        const offices = new Set();
        const fys = new Set();

        aggregatedProjects.forEach(p => {
            const office = p['Contracting_Office'] || p['Office'];
            if (office) offices.add(office);

            const dateStr = p['Close_Date'];
            if (dateStr && dateStr !== '1970-01-01') {
                const d = parseDate(dateStr);
                if (d) {
                    fys.add(yearType === 'CY' ? getCY(d) : getFY(d));
                }
            }
        });

        return {
            offices: [...offices].sort(),
            fys: [...fys].sort()
        };
    }, [aggregatedProjects, yearType]);

    const filteredProjects = useMemo(() => {
        let filtered = aggregatedProjects;
        if (debouncedSearch) {
            const term = debouncedSearch.toLowerCase();
            filtered = filtered.filter(p => {
                return String(p['DealName'] || "").toLowerCase().includes(term) ||
                       String(p['Block_Name'] || "").toLowerCase().includes(term) ||
                       String(p['Client'] || "").toLowerCase().includes(term) ||
                       String(p['BizPoC'] || "").toLowerCase().includes(term) ||
                       String(p['Region'] || "").toLowerCase().includes(term) ||
                       String(p['Contracting_Office'] || "").toLowerCase().includes(term);
            });
        }
        
        if (selectedOffices.length > 0) {
            filtered = filtered.filter(p => selectedOffices.includes(p['Contracting_Office'] || p['Office']));
        }
        
        if (selectedFYs.length > 0) {
            filtered = filtered.filter(p => {
                const dateStr = p['Close_Date'];
                if (!dateStr || dateStr === '1970-01-01') return false;
                const d = parseDate(dateStr);
                if (!d) return false;
                const fy = yearType === 'CY' ? getCY(d) : getFY(d);
                return selectedFYs.includes(fy);
            });
        }
        
        // Sort by Close_Date desc
        return filtered.sort((a, b) => {
            const dateA = new Date(a.Close_Date).getTime() || 0;
            const dateB = new Date(b.Close_Date).getTime() || 0;
            return dateB - dateA;
        });
    }, [aggregatedProjects, debouncedSearch, selectedOffices, selectedFYs, yearType]);

    if (loading && projects.length === 0) {
        return (
            <div className="min-h-screen bg-dark-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-400 font-medium">Loading Executive Hub...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans">
            {/* Navbar */}
            <header className="border-b border-white/10 bg-dark-800/50 backdrop-blur-md sticky top-0 z-[100]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto md:h-16 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/admin-dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white group relative" title="Back to Hub">
                                <ArrowLeft size={20} />
                            </button>
                            <div className="p-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                                <img src={logoSrc} alt="PhantomFX" className="h-6" onError={(e) => e.target.style.display = 'none'} />
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                <span className="text-white">Executive </span>
                                <span className="text-primary" style={{ textShadow: '0 0 15px rgba(52, 211, 153, 0.4)' }}>Hub</span>
                            </h1>
                        </div>
                        {/* Mobile Logout */}
                        <button onClick={handleLogout} className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                            <LogOut size={20} />
                        </button>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 w-full md:w-auto justify-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs font-medium text-gray-300">Welcome, <span className="text-white font-bold">{user?.name || user?.email?.split('@')[0]}</span></span>
                        </div>
                        <button onClick={handleLogout} className="hidden md:block p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Actions Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="relative w-full md:w-1/3 group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search projects..."
                            className="pl-12 bg-dark-800/50 border-white/5 focus:bg-dark-800 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <button
                            onClick={() => setIsGlobalTimelineOpen(true)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-dark-800/80 hover:bg-dark-700 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all shadow-lg hover:border-primary/50"
                        >
                            <BarChart2 size={16} className="text-primary" />
                            <span className="text-sm font-medium">Holistic Timeline</span>
                        </button>
                        
                        <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-xl p-1.5 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setDisplayCurrency("Home")}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg transition-all ${displayCurrency === "Home"
                                ? "bg-primary text-white shadow-lg"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            <span className="text-xs font-medium">Home</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisplayCurrency("USD")}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg transition-all ${displayCurrency === "USD"
                                ? "bg-primary text-white shadow-lg"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            <span className="text-xs font-medium">USD</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisplayCurrency("INR")}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg transition-all ${displayCurrency === "INR"
                                ? "bg-primary text-white shadow-lg"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            <span className="text-xs font-medium">INR</span>
                        </button>
                        </div>
                    </div>

                    <div className="flex-1 w-full flex flex-col sm:flex-row items-center justify-end gap-3">
                        <div className="w-full sm:w-1/2 md:w-auto md:min-w-[150px] glass-panel p-2 rounded-xl border border-white/10 bg-white/5 relative z-[60]">
                            <MultiSelect
                                options={filterOptions.offices.map(o => ({ value: o, label: o }))}
                                value={selectedOffices}
                                onChange={setSelectedOffices}
                                placeholder="Select Office"
                                label="Office"
                            />
                        </div>
                        
                        <div className="w-full sm:w-1/2 md:w-auto md:min-w-[180px] glass-panel p-2 rounded-xl border border-white/10 bg-white/5 relative z-[50]">
                            <div className="flex justify-between items-center mb-1 gap-2">
                                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{yearType}</label>
                                <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-lg p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => { setYearType("FY"); setSelectedFYs([]); }}
                                        className={`flex items-center justify-center px-2 py-0.5 rounded-md transition-all ${yearType === "FY" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                                    >
                                        <span className="text-[10px] font-bold">FY</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setYearType("CY"); setSelectedFYs([]); }}
                                        className={`flex items-center justify-center px-2 py-0.5 rounded-md transition-all ${yearType === "CY" ? "bg-primary text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                                    >
                                        <span className="text-[10px] font-bold">CY</span>
                                    </button>
                                </div>
                            </div>
                            <MultiSelect
                                options={filterOptions.fys.map(fy => ({ value: fy, label: fy }))}
                                value={selectedFYs}
                                onChange={setSelectedFYs}
                                placeholder={`Select ${yearType}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Grid Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.length > 0 ? (
                        filteredProjects.map((p, index) => (
                            <motion.div
                                key={p['Block_id'] || index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => setSelectedProject(p)}
                                className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl hover:border-primary/50 transition-all bg-dark-800/80 flex flex-col h-full cursor-pointer group"
                            >
                                <div className="px-5 py-4 border-b border-white/10 flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white leading-tight mb-0.5">
                                            {p['Block_Name'] || p['DealName'] || 'Untitled Project'}
                                        </h3>
                                        <div className="text-xs text-gray-400 font-medium">
                                            {p['Client'] || 'Unknown Client'}
                                        </div>
                                    </div>
                                    {p['deal_stage'] && (
                                        <div className="flex flex-col gap-1 items-end">
                                            <div className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap shrink-0 bg-white/5 text-gray-300 border-white/10">
                                                {p['deal_stage']}
                                            </div>
                                            {p['Contracting_Office'] && (
                                                <div className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap shrink-0 bg-white/5 text-gray-300 border-white/10">
                                                    {p['Contracting_Office']}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="px-5 py-4 flex-1 flex flex-col gap-4">
                                    {/* Awarded Amount */}
                                    <div className="flex justify-between items-end pb-3 border-b border-white/5">
                                        <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Awarded Amount</span>
                                        <span className="text-lg font-mono text-white font-bold">
                                            {p.summary.displayCurrStr} {Math.round(p.summary.displayAwarded || 0).toLocaleString('en-US')}
                                        </span>
                                    </div>

                                    {/* Financial Summary Bars - 2x2 Grid */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-2">
                                        {[
                                            { label: 'Total Billable', value: p.summary.displayProdApproved, color: 'bg-blue-500' },
                                            { label: 'Yet to Bill', value: p.summary.displayBillable, color: 'bg-cyan-500' },
                                            { label: 'Billed', value: p.summary.displayBilled, color: 'bg-emerald-500' },
                                            { label: 'Outstanding', value: p.summary.displayOutstanding, color: p.summary.displayOutstanding > 0 ? 'bg-red-500' : 'bg-gray-500' },
                                            { 
                                                label: 'Receipt', 
                                                value: p.summary.displayReceipt, 
                                                color: 'bg-purple-500',
                                                stackedValue: p.summary.displayOtherCharges,
                                                stackedColor: 'bg-orange-500',
                                                stackedLabel: 'Other Charges',
                                                colSpan: 2
                                            }
                                        ].map((stat, i) => (
                                            <div key={i} className={`flex flex-col gap-1.5 ${stat.colSpan === 2 ? 'col-span-2' : ''}`}>
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider flex items-center gap-1">
                                                        {stat.label}
                                                        {stat.stackedValue > 0 && (
                                                            <span className="text-[8px] text-orange-400/80 bg-orange-400/10 px-1 py-0.5 rounded ml-1 whitespace-nowrap">
                                                                + {stat.stackedLabel}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className="text-xs font-mono text-gray-200 font-medium">
                                                            {p.summary.displayCurrStr} {stat.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </span>
                                                        {stat.stackedValue > 0 && (
                                                            <span className="text-[10px] font-mono text-orange-400" title="Other Charges">
                                                                (+{Math.round(stat.stackedValue).toLocaleString('en-US')})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex">
                                                    <div 
                                                        className={`h-full ${stat.color} transition-all duration-500`} 
                                                        style={{ width: `${(stat.value / p.summary.maxVal) * 100}%` }}
                                                    ></div>
                                                    {stat.stackedValue > 0 && (
                                                        <div 
                                                            className={`h-full ${stat.stackedColor} transition-all duration-500`} 
                                                            style={{ width: `${(stat.stackedValue / p.summary.maxVal) * 100}%` }}
                                                        ></div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="p-3 border-t border-white/5 bg-dark-900/50 flex justify-between items-center text-[10px] text-gray-500">
                                    <span>Region: {p['Region'] || '-'}</span>
                                    <span>Close Date: {p['Close_Date'] !== '1970-01-01' ? p['Close_Date'] : '-'}</span>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center">
                            <div className="text-gray-500 mb-2">No projects found.</div>
                            {search && <div className="text-sm text-gray-600">Try adjusting your search filters.</div>}
                        </div>
                    )}
                </div>
            </main>

            <AnimatePresence>
                {selectedProject && (
                    <ExecutiveProjectModal 
                        project={aggregatedProjects.find(p => p.Block_id === selectedProject.Block_id) || selectedProject} 
                        finances={finances} 
                        onClose={() => setSelectedProject(null)} 
                    />
                )}
                {isGlobalTimelineOpen && (
                    <GlobalTimelineModal 
                        projects={aggregatedProjects} 
                        finances={finances} 
                        displayCurrency={displayCurrency}
                        onClose={() => setIsGlobalTimelineOpen(false)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
}