import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/Input";
import api from "../lib/api";
import { Search, ArrowLeft, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export default function ExecutivePage() {
    const { user, logout } = useAuth();
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
            if (!groups[key]) {
                groups[key] = { 
                    ...p, 
                    'Home_Amount': parseAmount(p['Home_Amount'] || p['Value in Home Currency'] || 0),
                    'Close_Date': p['DealclosingDate'] || p['Close_Date'] || '1970-01-01'
                };
            }
        });

        // Now calculate financial summary for each unique block
        return Object.values(groups).map(project => {
            let totalBillable = 0;
            let totalBilled = 0;
            let totalReceipt = 0;

            // Go through the project's billables
            if (project.billables && Array.isArray(project.billables)) {
                project.billables.forEach(billable => {
                    const billableId = billable['Billable_id'];
                    const billableHomeAmt = parseAmount(billable['Amount_in_Home_Currency'] || billable['Billable_Amount_in_Home_Currency'] || billable['Amount_in_USD'] || 0); // fallback
                    totalBillable += billableHomeAmt;

                    // Find corresponding finance data
                    const financeMatch = finances.find(f => f.Billable_id === billableId);
                    if (financeMatch && financeMatch.finances) {
                        financeMatch.finances.forEach(inv => {
                            if (inv.Billing_type === 'Credit Note') return;
                            const billedInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                            totalBilled += billedInr;

                            if (inv.Receipts) {
                                inv.Receipts.forEach(rec => {
                                    const receiptInr = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                    totalReceipt += receiptInr;
                                });
                            }
                        });
                    }
                });
            }

            const outstanding = totalBilled - totalReceipt;
            
            let paymentStatus = 'Partially Paid';
            if (totalBilled === 0) paymentStatus = 'Not Paid';
            else if (totalReceipt === 0) paymentStatus = 'Not Paid';
            else if (totalReceipt >= totalBilled || outstanding <= 0) paymentStatus = 'Paid';

            // Convert to correct display currency
            let displayAwarded = 0;
            let displayBillable = 0;
            let displayBilled = 0;
            let displayReceipt = 0;
            let displayOutstanding = 0;
            let displayCurrStr = "";

            const homeCurr = project['Home_Currency'] || project['Currency'] || project['Home Currency'] || '';
            const rateHomeToInr = exchangeRates[homeCurr] || exchangeRates["USD"];

            if (displayCurrency === "Home") {
                displayAwarded = project.Home_Amount;
                displayBillable = totalBillable;
                // Billed, Receipt, Outstanding are in INR. Convert back to Home:
                displayBilled = totalBilled / rateHomeToInr;
                displayReceipt = totalReceipt / rateHomeToInr;
                displayOutstanding = outstanding / rateHomeToInr;
                displayCurrStr = homeCurr;
            } else if (displayCurrency === "INR") {
                displayAwarded = project.Home_Amount * rateHomeToInr;
                displayBillable = totalBillable * rateHomeToInr;
                // Billed, Receipt, Outstanding are already in INR
                displayBilled = totalBilled;
                displayReceipt = totalReceipt;
                displayOutstanding = outstanding;
                displayCurrStr = "INR";
            } else if (displayCurrency === "USD") {
                const homeToUsd = rateHomeToInr / exchangeRates["USD"];
                displayAwarded = project.Home_Amount * homeToUsd;
                displayBillable = totalBillable * homeToUsd;
                // Billed, Receipt, Outstanding are in INR. Convert to USD:
                displayBilled = totalBilled / exchangeRates["USD"];
                displayReceipt = totalReceipt / exchangeRates["USD"];
                displayOutstanding = outstanding / exchangeRates["USD"];
                displayCurrStr = "USD";
            }

            return {
                ...project,
                summary: {
                    displayAwarded,
                    displayBillable,
                    displayBilled,
                    displayReceipt,
                    displayOutstanding,
                    displayCurrStr,
                    paymentStatus,
                    maxVal: Math.max(displayBillable, displayBilled, displayReceipt, displayOutstanding, 1)
                }
            };
        });
    }, [projects, finances, displayCurrency]);

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
        
        // Sort by Close_Date desc
        return filtered.sort((a, b) => {
            const dateA = new Date(a.Close_Date).getTime() || 0;
            const dateB = new Date(b.Close_Date).getTime() || 0;
            return dateB - dateA;
        });
    }, [aggregatedProjects, debouncedSearch]);

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
                    <div className="relative w-full max-w-xl group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search projects by name, client, region..."
                            className="pl-12 bg-dark-800/50 border-white/5 focus:bg-dark-800 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-xl p-1.5 w-full md:w-auto mt-4 md:mt-0">
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

                {/* Grid Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.length > 0 ? (
                        filteredProjects.map((p, index) => (
                            <motion.div
                                key={p['Block_id'] || index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl hover:border-primary/30 transition-all bg-dark-800/80 flex flex-col h-full"
                            >
                                <div className="p-5 border-b border-white/10 flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-white leading-tight mb-1">
                                            {p['Block_Name'] || p['DealName'] || 'Untitled Project'}
                                        </h3>
                                        <div className="text-sm text-gray-400 font-medium">
                                            {p['Client'] || 'Unknown Client'}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col gap-5">
                                    {/* Awarded Amount */}
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Awarded Amount</span>
                                        <span className="text-xl font-mono text-white font-bold">
                                            {p.summary.displayCurrStr} {Math.round(p.summary.displayAwarded || 0).toLocaleString('en-US')}
                                        </span>
                                    </div>

                                    {/* Financial Summary Bars */}
                                    <div className="space-y-4 mt-auto">
                                        {[
                                            { label: 'Billable Amount', value: p.summary.displayBillable, color: 'bg-blue-500' },
                                            { label: 'Billed Amount', value: p.summary.displayBilled, color: 'bg-emerald-500' },
                                            { label: 'Receipt', value: p.summary.displayReceipt, color: 'bg-purple-500' },
                                            { label: 'Outstanding', value: p.summary.displayOutstanding, color: p.summary.displayOutstanding > 0 ? 'bg-red-500' : 'bg-gray-500' }
                                        ].map((stat, i) => (
                                            <div key={i} className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">{stat.label}</span>
                                                    <span className="text-xs font-mono text-gray-200 font-medium">
                                                        {p.summary.displayCurrStr} {stat.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${stat.color} transition-all duration-500`} 
                                                        style={{ width: `${(stat.value / p.summary.maxVal) * 100}%` }}
                                                    ></div>
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
        </div>
    );
}