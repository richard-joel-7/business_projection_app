import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { MultiSelect } from "../components/ui/MultiSelect";
import api from "../lib/api";
import { LogOut, Search, Edit2, AlertTriangle, ArrowLeft, X, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import FinanceModal from "../components/FinanceModal";
import MergeSelectionModal from "../components/MergeSelectionModal";
import { parseDate, getFY, getCY } from "../lib/utils";

import { Calendar, TrendingUp } from "lucide-react";

export default function FinancePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [logoSrc, setLogoSrc] = useState("pixoo-black-logo.png");
    const [finances, setFinances] = useState([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState(""); 
    const [pastDueOnly, setPastDueOnly] = useState(false);
    const [dateContext, setDateContext] = useState("billed"); // 'billed', 'receipt'
    const [selectedOffices, setSelectedOffices] = useState([]);
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedFYs, setSelectedFYs] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [timelineFilter, setTimelineFilter] = useState('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
    const [yearType, setYearType] = useState("FY"); // "FY" or "CY"
    const [displayCurrency, setDisplayCurrency] = useState("USD");
    
    const userRoles = String(user?.role || "").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
    const showHubBack = user?.isAdmin || userRoles.length > 1 || userRoles.includes("executive");
    const isExecutive = userRoles.includes("executive") && !user?.isAdmin;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [isMergeFinanceModalOpen, setIsMergeFinanceModalOpen] = useState(false);
    const [selectedMergeBillables, setSelectedMergeBillables] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);

    const tableContainerRef = useRef(null);

    useEffect(() => {
        fetchData();
        const fetchLogo = async () => {
            try {
                const cachedLogo = localStorage.getItem('app_logo');
                if (cachedLogo) {
                    setLogoSrc(cachedLogo);
                    return;
                }
                const result = await api.getLogoImage();
                if (result && result.data) {
                    const logoDataUrl = `data:${result.mimeType};base64,${result.data}`;
                    setLogoSrc(logoDataUrl);
                    localStorage.setItem('app_logo', logoDataUrl);
                }
            } catch (err) {}
        };
        fetchLogo();
    }, []);

    const fetchData = async () => {
        try {
            setError("");
            setLoading(true);
            const finData = await api.getFinances();
            setFinances(Array.isArray(finData) ? finData : []);
        } catch (err) {
            console.error("Failed to fetch data", err);
            setError("Failed to load finance data.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const handleEdit = (item) => {
        if (item.originalItems && item.originalItems.length > 1) {
            setSelectedMergeBillables(item.originalItems);
            setIsMergeFinanceModalOpen(true);
        } else {
            // For single items, just use the original item if it was grouped
            setEditingItem(item.originalItems ? item.originalItems[0] : item);
            setIsModalOpen(true);
        }
    };

    const handleSave = async (payload) => {
        setSaving(true);
        try {
            if (payload && payload.action === 'unmerge') {
                // unmerge already happened via api call in modal, just refresh
                await fetchData();
            } else {
                await api.saveFinance(payload);
                await fetchData();
            }
            setIsModalOpen(false);
            setEditingItem(null);
            setIsMergeFinanceModalOpen(false);
            setSelectedMergeBillables([]);
        } catch (err) {
            console.error("Failed to save", err);
            setError("Failed to save finance data");
        } finally {
            setSaving(false);
        }
    };

    const isDateWithinTimeline = (date, timeline) => {
        if (!date) return false;
        const now = new Date();
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(todayStart.getDate() + 1);

        if (timeline === 'today') {
            return target >= todayStart && target < tomorrowStart;
        }

        if (timeline === 'week') {
            const day = todayStart.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const weekStart = new Date(todayStart);
            weekStart.setDate(todayStart.getDate() + diffToMonday);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            return target >= weekStart && target < weekEnd;
        }

        if (timeline === 'month') {
            const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
            const nextMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);
            return target >= monthStart && target < nextMonthStart;
        }

        if (timeline === 'quarter') {
            const quarterStartMonth = Math.floor(todayStart.getMonth() / 3) * 3;
            const quarterStart = new Date(todayStart.getFullYear(), quarterStartMonth, 1);
            const nextQuarterStart = new Date(todayStart.getFullYear(), quarterStartMonth + 3, 1);
            return target >= quarterStart && target < nextQuarterStart;
        }

        if (timeline === 'fy' || timeline === 'year') {
            if (yearType === 'CY') {
                const cyStartYear = todayStart.getFullYear();
                const cyStart = new Date(cyStartYear, 0, 1);
                const nextCyStart = new Date(cyStartYear + 1, 0, 1);
                return target >= cyStart && target < nextCyStart;
            } else {
                const currentMonth = todayStart.getMonth();
                const fyStartYear = currentMonth >= 3 ? todayStart.getFullYear() : todayStart.getFullYear() - 1;
                const fyStart = new Date(fyStartYear, 3, 1);
                const nextFyStart = new Date(fyStartYear + 1, 3, 1);
                return target >= fyStart && target < nextFyStart;
            }
        }

        if (timeline === 'pastweek') {
            const day = todayStart.getDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            const currentWeekStart = new Date(todayStart);
            currentWeekStart.setDate(todayStart.getDate() + diffToMonday);
            const previousWeekStart = new Date(currentWeekStart);
            previousWeekStart.setDate(currentWeekStart.getDate() - 7);
            return target >= previousWeekStart && target < currentWeekStart;
        }

        if (timeline === 'pastmonth') {
            const currentMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
            const previousMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
            return target >= previousMonthStart && target < currentMonthStart;
        }

        if (timeline === 'overdue') {
            return target < todayStart;
        }

        return true;
    };

    const filterOptions = useMemo(() => {
        const offices = new Set();
        const regions = new Set();
        const fys = new Set();
        const months = new Set();

        finances.forEach(item => {
            if (item.Office) offices.add(item.Office);
            if (item.Region) regions.add(item.Region);
            
            const invoices = item.finances || [];
            const hasInvoice = invoices.some(f => !!f.Invoice_Number);

            if (dateContext === 'billed') {
                if (hasInvoice) {
                    invoices.forEach(inv => {
                        const targetDateStr = inv.Billed_date;
                        if (targetDateStr) {
                            const date = parseDate(targetDateStr);
                            if (date) {
                                fys.add(yearType === 'CY' ? getCY(date) : getFY(date));
                                months.add(date.toLocaleString('default', { month: 'short' }));
                            }
                        }
                    });
                } else {
                    const targetDateStr = item.Billable_date;
                    if (targetDateStr) {
                        const date = parseDate(targetDateStr);
                        if (date) {
                            fys.add(yearType === 'CY' ? getCY(date) : getFY(date));
                            months.add(date.toLocaleString('default', { month: 'short' }));
                        }
                    }
                }
            } else {
                invoices.forEach(inv => {
                    if (inv.Receipts && inv.Receipts.length > 0) {
                        inv.Receipts.forEach(r => {
                            const targetDateStr = r.Receipt_date;
                            if (targetDateStr) {
                                const date = parseDate(targetDateStr);
                                if (date) {
                                    fys.add(yearType === 'CY' ? getCY(date) : getFY(date));
                                    months.add(date.toLocaleString('default', { month: 'short' }));
                                }
                            }
                        });
                    }
                });
            }
        });

        const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec"];

        return {
            offices: [...offices].sort(),
            regions: [...regions].sort(),
            fys: [...fys].sort(),
            months: [...months].sort((a, b) => {
                const indexA = monthsOrder.indexOf(a);
                const indexB = monthsOrder.indexOf(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            })
        };
    }, [finances, dateContext, yearType]);

    const filteredData = useMemo(() => {
        return finances.filter(item => {
            // Status Filter
            const invoices = item.finances || [];
            const hasInvoice = invoices.some(f => !!f.Invoice_Number);
            
            if (statusFilter === 'billed' && !hasInvoice) return false;
            if (statusFilter === 'non_billed' && hasInvoice) return false;

            // Payment Status Filter
            if (paymentStatusFilter && paymentStatusFilter !== 'all') {
                const hasMatchingPaymentStatus = invoices.some(inv => {
                    let pStatus = inv.Payment_status;
                    if (!pStatus) {
                        let invReceiptTotalHome = 0;
                        if (inv.Receipts) {
                            inv.Receipts.forEach(r => invReceiptTotalHome += parseFloat(String(r.Receipt_Home_Amount || r['Receipt_Home Amount']).replace(/[^0-9.-]+/g, "")) || 0);
                        }
                        const invBilledHome = parseFloat(String(inv.Billable_Amount_in_Home_Currency || item.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
                        
                        if (invBilledHome === 0 || invReceiptTotalHome === 0) pStatus = 'Not Paid';
                        else if (invReceiptTotalHome >= (invBilledHome - 0.05)) pStatus = 'Paid';
                        else pStatus = 'Partially Paid';
                    }
                    return pStatus === paymentStatusFilter;
                });
                
                if (!hasMatchingPaymentStatus) return false;
            }

            // Past Due Filter
            if (pastDueOnly) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                
                const hasPastDue = invoices.some(inv => {
                    if (!inv.Due_date) return false;
                    
                    // Check Payment Status to ignore fully Paid invoices
                    let pStatus = inv.Payment_status;
                    if (!pStatus) {
                        let invReceiptTotalHome = 0;
                        if (inv.Receipts) {
                            inv.Receipts.forEach(r => invReceiptTotalHome += parseFloat(String(r.Receipt_Home_Amount || r['Receipt_Home Amount']).replace(/[^0-9.-]+/g, "")) || 0);
                        }
                        const invBilledHome = parseFloat(String(inv.Billable_Amount_in_Home_Currency || item.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
                        
                        if (invBilledHome === 0 || invReceiptTotalHome === 0) pStatus = 'Not Paid';
                        else if (invReceiptTotalHome >= (invBilledHome - 0.05)) pStatus = 'Paid';
                        else pStatus = 'Partially Paid';
                    }
                    if (pStatus === 'Paid') return false;
                    
                    const d = parseDate(inv.Due_date);
                    if (!d) return false;
                    d.setHours(0, 0, 0, 0);
                    return now > d;
                });
                
                if (!hasPastDue) return false;
            }

            // Office Filter
            if (selectedOffices.length > 0 && !selectedOffices.includes(item.Office)) return false;

            // Region Filter
            if (selectedRegions.length > 0 && !selectedRegions.includes(item.Region)) return false;

            // Search
            if (search) {
                const s = search.toLowerCase();
                const invoices = item.finances || [];
                const invoiceMatches = invoices.some(inv => inv.Invoice_Number && String(inv.Invoice_Number).toLowerCase().includes(s));

                const matches = (
                    (item.BlockName && item.BlockName.toLowerCase().includes(s)) ||
                    (item.Billable_id && item.Billable_id.toLowerCase().includes(s)) ||
                    invoiceMatches
                );
                if (!matches) return false;
            }

            // Timeline & Date Filters
            if (timelineFilter !== 'all' || selectedFYs.length > 0 || selectedMonths.length > 0) {
                const invoices = item.finances || [];
                const hasInvoice = invoices.some(f => !!f.Invoice_Number);
                let hasMatch = false;

                if (dateContext === 'billed') {
                    if (hasInvoice) {
                        hasMatch = invoices.some(inv => {
                            const targetDateStr = inv.Billed_date;
                            if (!targetDateStr) return false;
                            const date = parseDate(targetDateStr);
                            if (!date) return false;

                            if (timelineFilter !== 'all' && !isDateWithinTimeline(date, timelineFilter)) return false;

                            if (selectedFYs.length > 0) {
                                const fy = yearType === 'CY' ? getCY(date) : getFY(date);
                                if (!selectedFYs.includes(fy)) return false;
                            }

                            if (selectedMonths.length > 0) {
                                const monthShort = date.toLocaleString('default', { month: 'short' });
                                if (!selectedMonths.includes(monthShort)) return false;
                            }
                            return true;
                        });
                    } else {
                        const targetDateStr = item.Billable_date;
                        if (targetDateStr) {
                            const date = parseDate(targetDateStr);
                            if (date) {
                                let match = true;
                                if (timelineFilter !== 'all' && !isDateWithinTimeline(date, timelineFilter)) match = false;

                                if (selectedFYs.length > 0) {
                                    const fy = yearType === 'CY' ? getCY(date) : getFY(date);
                                    if (!selectedFYs.includes(fy)) match = false;
                                }

                                if (selectedMonths.length > 0) {
                                    const monthShort = date.toLocaleString('default', { month: 'short' });
                                    if (!selectedMonths.includes(monthShort)) match = false;
                                }
                                hasMatch = match;
                            }
                        }
                    }
                } else {
                    hasMatch = invoices.some(inv => {
                        if (!inv.Receipts || inv.Receipts.length === 0) return false;
                        return inv.Receipts.some(r => {
                            const targetDateStr = r.Receipt_date;
                            if (!targetDateStr) return false;
                            const date = parseDate(targetDateStr);
                            if (!date) return false;

                            if (timelineFilter !== 'all' && !isDateWithinTimeline(date, timelineFilter)) return false;

                            if (selectedFYs.length > 0) {
                                const fy = yearType === 'CY' ? getCY(date) : getFY(date);
                                if (!selectedFYs.includes(fy)) return false;
                            }

                            if (selectedMonths.length > 0) {
                                const monthShort = date.toLocaleString('default', { month: 'short' });
                                if (!selectedMonths.includes(monthShort)) return false;
                            }
                            return true;
                        });
                    });
                }
                if (!hasMatch) return false;
            }

            return true;
        });
    }, [finances, search, statusFilter, selectedOffices, selectedRegions, selectedFYs, selectedMonths, timelineFilter, dateContext, yearType, pastDueOnly, paymentStatusFilter]);

    const aggregatedData = useMemo(() => {
        let grouped = {};
        let ungrouped = [];
        
        filteredData.forEach(item => {
            const invoices = item.finances || [];
            // Group by the first Invoice_Number found, if any
            const invNum = invoices.find(f => f.Invoice_Number)?.Invoice_Number;
            
            if (invNum) {
                if (!grouped[invNum]) {
                    grouped[invNum] = { ...item, originalItems: [item] };
                } else {
                    const existing = grouped[invNum];
                    existing.originalItems.push(item);
                    
                    // Aggregate amounts
                    const addAmount = (field) => {
                        const val1 = parseFloat(String(existing[field] || '0').replace(/[^0-9.-]+/g, "")) || 0;
                        const val2 = parseFloat(String(item[field] || '0').replace(/[^0-9.-]+/g, "")) || 0;
                        existing[field] = String(val1 + val2);
                    };
                    addAmount('Billable_Amount_in_Home_Currency');
                    addAmount('Billable_Amount_in_Inr');
                    
                    // Comma separate identifiers for display
                    existing.Billable_id = `${existing.Billable_id}, ${item.Billable_id}`;
                    if (item.Bin_number && !String(existing.Bin_number).includes(String(item.Bin_number))) {
                        existing.Bin_number = `${existing.Bin_number}, ${item.Bin_number}`;
                    }
                }
            } else {
                ungrouped.push(item);
            }
        });
        
        return [...Object.values(grouped), ...ungrouped];
    }, [filteredData]);

    const kpis = useMemo(() => {
        let totalBillables = 0;
        let totalBillableAmount = 0;
        let totalBilledAmount = 0;
        let totalReceiptsCount = 0;
        let totalReceiptAmount = 0;
        
        const processedReceipts = new Set();
        const processedInvoices = new Set();
        
        filteredData.forEach(item => {
            const invoices = item.finances || [];
            const hasInvoice = invoices.some(f => !!f.Invoice_Number);
            
            if (dateContext === 'billed') {
                let itemTotalAmount = 0;
                if (invoices.length > 0) {
                    invoices.forEach(inv => {
                        if (inv.Billing_type === 'Credit Note') return;
                        
                        let inrVal = 0;
                        if (inv.Billed_Amount_in_Inr) {
                            inrVal = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                        } else if (item.Billable_Amount_in_Inr) {
                            inrVal = parseFloat(String(item.Billable_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                        }
                        
                        const val = displayCurrency === "USD" ? inrVal / 90 : inrVal;
                        itemTotalAmount += val;
                        
                        if (inv.Invoice_Number) {
                            processedInvoices.add(inv.Invoice_Number);
                        }
                    });
                } else {
                    // No invoices yet, fallback to billable amount if billed date matches
                    const inrVal = parseFloat(String(item.Billable_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                    const val = displayCurrency === "USD" ? inrVal / 90 : inrVal;
                    itemTotalAmount += val;
                }

                if (hasInvoice) {
                    totalBilledAmount += itemTotalAmount;
                } else {
                    totalBillables++;
                    totalBillableAmount += itemTotalAmount;
                }
            } else {
                invoices.forEach(inv => {
                    if (inv.Billing_type === 'Credit Note') return;
                    
                    if (inv.Receipts && inv.Receipts.length > 0) {
                        inv.Receipts.forEach(rec => {
                            // Ensure we don't double count receipts for merged invoices
                            const recKey = rec.Receipt_id || `${inv.Invoice_Number}_${rec.Receipt_date}_${rec.Receipt_Amount}`;
                            if (processedReceipts.has(recKey)) return;
                            processedReceipts.add(recKey);

                            if (rec.Receipt_date || (rec.Receipt_Amount && String(rec.Receipt_Amount).trim() !== "")) {
                                totalReceiptsCount++;
                                const inrVal = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                const val = displayCurrency === "USD" ? inrVal / 90 : inrVal;
                                totalReceiptAmount += val;
                            }
                        });
                    }
                });
            }
        });

        const totalBilled = processedInvoices.size;

        return { totalBillables, totalBillableAmount, totalBilled, totalBilledAmount, totalReceiptsCount, totalReceiptAmount };
    }, [filteredData, displayCurrency, dateContext]);

    const chartData = useMemo(() => {
        const data = {};
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        months.forEach(m => data[m] = 0);

        const processedChartReceipts = new Set();

        filteredData.forEach(item => {
            const invoices = item.finances || [];
            const hasInvoice = invoices.some(f => !!f.Invoice_Number);
            
            if (dateContext === 'billed') {
                if (hasInvoice) {
                    invoices.forEach(inv => {
                        if (inv.Billing_type === 'Credit Note') return;
                        
                        const targetDateStr = inv.Billed_date;
                        if (targetDateStr) {
                            const date = parseDate(targetDateStr);
                            if (date) {
                                const month = date.toLocaleString('default', { month: 'short' });
                                
                                let inrVal = 0;
                                if (inv.Billed_Amount_in_Inr) {
                                    inrVal = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                                } else if (item.Billable_Amount_in_Inr) {
                                    inrVal = parseFloat(String(item.Billable_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                                }
                                
                                const val = displayCurrency === "USD" ? inrVal / 90 : inrVal;
                                
                                if (data[month] !== undefined) {
                                    data[month] += val;
                                }
                            }
                        }
                    });
                } else {
                    const targetDateStr = item.Billable_date;
                    if (targetDateStr) {
                        const date = parseDate(targetDateStr);
                        if (date) {
                            const month = date.toLocaleString('default', { month: 'short' });
                            
                            const inrVal = parseFloat(String(item.Billable_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
                            const val = displayCurrency === "USD" ? inrVal / 90 : inrVal;
                            
                            if (data[month] !== undefined) {
                                data[month] += val;
                            }
                        }
                    }
                }
            } else {
                invoices.forEach(inv => {
                    if (inv.Billing_type === 'Credit Note') return;
                    
                    if (inv.Receipts && inv.Receipts.length > 0) {
                        inv.Receipts.forEach(rec => {
                            // Deduplicate receipts
                            const recKey = rec.Receipt_id || `${inv.Invoice_Number}_${rec.Receipt_date}_${rec.Receipt_Amount}`;
                            if (processedChartReceipts.has(recKey)) return;
                            processedChartReceipts.add(recKey);

                            const targetDateStr = rec.Receipt_date;
                            if (targetDateStr) {
                                const date = parseDate(targetDateStr);
                                if (date) {
                                    const month = date.toLocaleString('default', { month: 'short' });
                                    const inrVal = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                                    const val = displayCurrency === "USD" ? inrVal / 90 : inrVal;
                                    if (data[month] !== undefined) {
                                        data[month] += val;
                                    }
                                }
                            }
                        });
                    }
                });
            }
        });

        let orderedMonths = [];
        if (yearType === 'CY') {
            orderedMonths = months;
        } else {
            orderedMonths = [...months.slice(3), ...months.slice(0, 3)];
        }

        return orderedMonths.map(m => ({ month: m, amount: data[m] }));
    }, [filteredData, displayCurrency, dateContext, yearType]);

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-primary/30">
            {/* Top Bar */}
            <header className="border-b border-white/10 bg-dark-800/50 backdrop-blur-md sticky top-0 z-[100]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto md:h-16 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-3">
                            {showHubBack && (
                                <button onClick={() => navigate('/admin-dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white" title="Back to Admin Hub">
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            <div className="p-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                                <img src={logoSrc} alt="PhantomFX" className="h-6" />
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                <span className="text-white">Finance </span>
                                <span className="text-primary" style={{ textShadow: '0 0 15px rgba(52, 211, 153, 0.4)' }}>Hub</span>
                            </h1>
                        </div>
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
                {error && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        {error}
                    </motion.div>
                )}

                {/* Date Context Toggle */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <div className="flex bg-dark-800/80 p-1.5 rounded-xl border border-white/5 w-fit">
                            <button
                                onClick={() => setDateContext("billed")}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                                    dateContext === "billed"
                                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                <Calendar size={18} />
                                Billed Date
                            </button>
                            <button
                                onClick={() => setDateContext("receipt")}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                                    dateContext === "receipt"
                                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                <TrendingUp size={18} />
                                Receipt Date
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dashboard Metrics - Redesigned to match Business Projections */}
                {dateContext === 'billed' ? (
                    <div className="flex flex-wrap gap-3 mb-4 w-full xl:w-2/3">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 min-w-[140px] shrink-0">
                            <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Billables</h3>
                            <div className="text-[clamp(1.25rem,5vw,2rem)] font-bold text-white leading-tight">{kpis.totalBillables}</div>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 flex-1 min-w-[200px]">
                            <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Billable Amount ({displayCurrency})</h3>
                            <div className="text-[clamp(1.1rem,2vw,1.8rem)] font-bold text-white leading-tight tracking-tight whitespace-nowrap">
                                {displayCurrency === "INR" ? "₹" : "$"}{Math.round(kpis.totalBillableAmount).toLocaleString()}
                            </div>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 min-w-[140px] shrink-0">
                            <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Billed</h3>
                            <div className="text-[clamp(1.25rem,5vw,2rem)] font-bold text-white leading-tight">{kpis.totalBilled}</div>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 flex-1 min-w-[200px]">
                            <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Billed Amount ({displayCurrency})</h3>
                            <div className="text-[clamp(1.1rem,2vw,1.8rem)] font-bold text-white leading-tight tracking-tight whitespace-nowrap">
                                {displayCurrency === "INR" ? "₹" : "$"}{Math.round(kpis.totalBilledAmount).toLocaleString()}
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-3 mb-4 w-full md:w-1/2 lg:w-1/3">
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 min-w-[140px] shrink-0">
                            <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Receipts</h3>
                            <div className="text-[clamp(1.25rem,5vw,2rem)] font-bold text-white leading-tight">{kpis.totalReceiptsCount}</div>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 flex-1 min-w-[200px]">
                            <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Amount ({displayCurrency})</h3>
                            <div className="text-[clamp(1.1rem,2vw,1.8rem)] font-bold text-white leading-tight tracking-tight whitespace-nowrap">
                                {displayCurrency === "INR" ? "₹" : "$"}{Math.round(kpis.totalReceiptAmount).toLocaleString()}
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* 12 Month Grid (Non-scrollable) */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-8">
                    {chartData.map((month, idx) => (
                        <motion.div
                            key={month.month}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center hover:bg-white/10 transition-colors cursor-default"
                        >
                            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">{month.month}</div>
                            <div className="text-sm font-bold text-white">
                                {displayCurrency === "INR" ? "₹" : "$"}{Math.round(month.amount).toLocaleString()}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Filters Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {/* Status */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-[70]">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Status</h3>
                        <Select
                            options={[
                                { value: 'all', label: 'All Statuses' },
                                { value: 'billed', label: 'Billed' },
                                { value: 'non_billed', label: 'Non Billed' }
                            ]}
                            value={statusFilter || 'all'}
                            onChange={(e) => setStatusFilter(e.target.value === 'all' ? '' : e.target.value)}
                            placeholder="Select Status"
                            className="text-xs py-2 px-3"
                        />
                    </motion.div>

                    {/* Office */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-[60]">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Office</h3>
                        <Select
                            options={[
                                { value: 'all', label: 'All Offices' },
                                ...filterOptions.offices.map(o => ({ value: o, label: o }))
                            ]}
                            value={selectedOffices.length > 0 ? selectedOffices[0] : 'all'}
                            onChange={(e) => setSelectedOffices(e.target.value === 'all' ? [] : [e.target.value])}
                            placeholder="Select Office"
                            className="text-xs py-2 px-3"
                        />
                    </motion.div>

                    {/* Region */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-[50]">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Region</h3>
                        <Select
                            options={[
                                { value: 'all', label: 'All Regions' },
                                ...filterOptions.regions.map(r => ({ value: r, label: r }))
                            ]}
                            value={selectedRegions.length > 0 ? selectedRegions[0] : 'all'}
                            onChange={(e) => setSelectedRegions(e.target.value === 'all' ? [] : [e.target.value])}
                            placeholder="Select Region"
                            className="text-xs py-2 px-3"
                        />
                    </motion.div>

                    {/* FY / CY */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-[40]">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">{yearType}</h3>
                            <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={() => { setYearType("FY"); setSelectedFYs([]); }}
                                    className={`flex items-center justify-center px-2 py-0.5 rounded-md transition-all ${yearType === "FY"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-[10px] font-bold">FY</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setYearType("CY"); setSelectedFYs([]); }}
                                    className={`flex items-center justify-center px-2 py-0.5 rounded-md transition-all ${yearType === "CY"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-[10px] font-bold">CY</span>
                                </button>
                            </div>
                        </div>
                        <Select
                            options={[
                                { value: 'all', label: `All ${yearType}s` },
                                ...filterOptions.fys.map(fy => ({ value: fy, label: fy }))
                            ]}
                            value={selectedFYs.length > 0 ? selectedFYs[0] : 'all'}
                            onChange={(e) => setSelectedFYs(e.target.value === 'all' ? [] : [e.target.value])}
                            placeholder={`Select ${yearType}`}
                            className="text-xs py-2 px-3"
                        />
                    </motion.div>

                    {/* Timeline */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-[30]">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">{dateContext === 'billed' ? 'Billed Timeline' : 'Receipt Timeline'}</h3>
                        <Select
                            options={[
                                { value: 'all', label: 'All Timelines' },
                                { value: 'today', label: 'Today' },
                                { value: 'week', label: 'This Week' },
                                { value: 'month', label: 'This Month' },
                                { value: 'quarter', label: 'This Quarter' },
                                { value: 'fy', label: yearType === 'CY' ? 'This CY' : 'This FY' },
                                { value: 'pastweek', label: 'Past Week' },
                                { value: 'pastmonth', label: 'Past Month' },
                                { value: 'overdue', label: 'Overdue' }
                            ]}
                            value={timelineFilter}
                            onChange={(e) => setTimelineFilter(e.target.value)}
                            placeholder="Select Timeline"
                            className="text-xs py-2 px-3"
                        />
                    </motion.div>

                    {/* Month */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-[20]">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Month</h3>
                        <Select
                            options={[
                                { value: 'all', label: 'All Months' },
                                ...filterOptions.months.map(m => ({ value: m, label: m }))
                            ]}
                            value={selectedMonths.length > 0 ? selectedMonths[0] : 'all'}
                            onChange={(e) => setSelectedMonths(e.target.value === 'all' ? [] : [e.target.value])}
                            placeholder="Select Month"
                            className="text-xs py-2 px-3"
                        />
                    </motion.div>

                    {/* Currency */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-10">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Currency</h3>
                        <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-xl p-1.5 w-full">
                            <button
                                type="button"
                                onClick={() => setDisplayCurrency("USD")}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all ${displayCurrency === "USD"
                                    ? "bg-primary text-white shadow-lg"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                <span className="text-xs font-medium">USD</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDisplayCurrency("INR")}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all ${displayCurrency === "INR"
                                    ? "bg-primary text-white shadow-lg"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                <span className="text-xs font-medium">INR</span>
                            </button>
                        </div>
                    </motion.div>

                    {/* Payment Status Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-[10]">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Payment Status</h3>
                        <Select
                            options={[
                                { value: 'all', label: 'All Statuses' },
                                { value: 'Paid', label: 'Paid' },
                                { value: 'Partially Paid', label: 'Partially Paid' },
                                { value: 'Not Paid', label: 'Not Paid' }
                            ]}
                            value={paymentStatusFilter || 'all'}
                            onChange={(e) => setPaymentStatusFilter(e.target.value === 'all' ? '' : e.target.value)}
                            placeholder="Select Payment Status"
                            className="text-xs py-2 px-3"
                        />
                    </motion.div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search by Project, Billable ID, or Invoice..."
                            className="pl-12 bg-dark-800/50 border-white/5 focus:bg-dark-800 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                        <Button
                            variant="outline"
                            onClick={() => setIsMergeModalOpen(true)}
                            className="h-9 px-4 text-sm transition-all border bg-dark-800/50 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
                        >
                            Merge Billables
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setPastDueOnly(!pastDueOnly)}
                            className={`h-9 px-4 text-sm transition-all border ${
                                pastDueOnly 
                                    ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:bg-red-500/30 hover:text-red-300' 
                                    : 'bg-dark-800/50 text-gray-400 border-white/10 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            Filter Past Due
                        </Button>
                        {(statusFilter || selectedOffices.length > 0 || selectedRegions.length > 0 || selectedFYs.length > 0 || selectedMonths.length > 0 || timelineFilter !== 'all' || paymentStatusFilter || pastDueOnly) && (
                            <Button variant="ghost" onClick={() => {
                                setStatusFilter("");
                                setSelectedOffices([]);
                                setSelectedRegions([]);
                                setSelectedFYs([]);
                                setSelectedMonths([]);
                                setTimelineFilter('all');
                                setPaymentStatusFilter("");
                                setPastDueOnly(false);
                            }} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 h-9">
                                <X size={18} className="mr-2" /> Clear Filters
                            </Button>
                        )}
                    </div>
                </div>

                {/* Finance Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-panel rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl"
                >
                    <div
                        ref={tableContainerRef}
                        className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar"
                    >
                        <table className="w-full text-sm text-left relative border-collapse">
                            <thead className="bg-[#0A0A0A] text-gray-400 font-medium uppercase tracking-wider text-[10px] border-b border-white/10 sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A] sticky left-0 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">Project Name</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Show Code</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Bin ID</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Invoice Number</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Sales Location</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Region</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">BizPoC</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Project Status</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Client Name</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Client Code</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Billing Type</th>
                                    <th className="px-6 py-4 whitespace-nowrap text-right bg-[#0A0A0A]">Amount (HC)</th>
                                    <th className="px-6 py-4 whitespace-nowrap text-right bg-[#0A0A0A]">Amount ({displayCurrency})</th>
                                    <th className="px-6 py-4 whitespace-nowrap bg-[#0A0A0A]">Finance Status</th>
                                    <th className="px-6 py-4 whitespace-nowrap text-center bg-[#0A0A0A] sticky right-0 shadow-[-2px_0_5px_rgba(0,0,0,0.5)]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan="15" className="text-center py-12 text-gray-500">Loading approved billables...</td></tr>
                                ) : aggregatedData.length === 0 ? (
                                    <tr><td colSpan="15" className="text-center py-12 text-gray-500">No approved billables found</td></tr>
                                ) : (
                                    aggregatedData.map((item, i) => {
                                        const invoices = item.finances || [];
                                        const invoiceNumbers = invoices.map(f => f.Invoice_Number).filter(Boolean).join(', ') || '-';
                                        const billingTypes = [...new Set(invoices.map(f => f.Billing_type).filter(Boolean))].join(', ') || '-';
                                        const hasInvoice = invoices.some(f => !!f.Invoice_Number);
                                        const isHeld = item.Hold_Billing;
                                        
                                        return (
                                        <motion.tr
                                            key={item.Billable_id || i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.02 }}
                                            className={`hover:bg-white/10 transition-colors group ${isHeld ? 'bg-yellow-500/10' : ''}`}
                                        >
                                            <td className={`px-6 py-4 font-medium text-white whitespace-nowrap sticky left-0 z-10 border-r border-white/10 shadow-[2px_0_5px_rgba(0,0,0,0.5)] ${isHeld ? 'bg-[#1c1a0f]' : 'bg-[#0A0A0A]'}`}>
                                                <div className="flex items-center gap-2">
                                                    {item.BlockName || '-'}
                                                    {isHeld && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Hold</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{item.Show_Code || '-'}</td>
                                            <td className="px-6 py-4 font-mono text-[11px] text-gray-400 whitespace-nowrap">{item.Bin_number || '-'}</td>
                                            <td className="px-6 py-4 font-mono text-blue-400 whitespace-nowrap">{invoiceNumbers}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{item.Office || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{item.Region || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{item.BizPoC || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                                                <span className="px-2 py-1 rounded-full bg-white/5 text-gray-300 text-[10px] font-medium border border-white/10 whitespace-nowrap">
                                                    {item.deal_stage || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{item.Client || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{item.Client_Code || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{billingTypes}</td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="font-mono text-emerald-400">{item.Billable_Amount_in_Home_Currency || '-'}</div>
                                                <div className="text-[10px] text-gray-500">{item.Home_Currency}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-emerald-400 whitespace-nowrap">
                                                {item.Billable_Amount_in_Inr ? (displayCurrency === "INR" ? `₹${Number(item.Billable_Amount_in_Inr).toLocaleString()}` : `$${Math.round(Number(item.Billable_Amount_in_Inr) / 90).toLocaleString()}`) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {hasInvoice ? (
                                                    <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">Invoiced</span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded bg-yellow-500/10 text-yellow-400 text-[10px] font-bold uppercase tracking-wider border border-yellow-500/20">Pending</span>
                                                )}
                                            </td>
                                            {!isExecutive && (
                                                <td className={`px-6 py-4 text-center whitespace-nowrap sticky right-0 shadow-[-2px_0_5px_rgba(0,0,0,0.5)] border-l border-white/10 ${isHeld ? 'bg-[#1c1a0f]' : 'bg-[#0A0A0A]'}`}>
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="text-gray-400 hover:text-white hover:bg-primary/20 border border-transparent hover:border-primary/30 h-8 px-3">
                                                        <Edit2 size={14} className="mr-2" /> Update
                                                    </Button>
                                                </td>
                                            )}
                                            {isExecutive && (
                                                <td className={`px-6 py-4 text-center whitespace-nowrap sticky right-0 shadow-[-2px_0_5px_rgba(0,0,0,0.5)] border-l border-white/10 ${isHeld ? 'bg-[#1c1a0f]' : 'bg-[#0A0A0A]'}`}>
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="text-gray-400 hover:text-white hover:bg-primary/20 border border-transparent hover:border-primary/30 h-8 w-8 p-0">
                                                        <Eye size={14} />
                                                    </Button>
                                                </td>
                                            )}
                                        </motion.tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </main>

            <AnimatePresence>
                {isModalOpen && editingItem && (
                    <FinanceModal 
                        item={editingItem} 
                        onClose={() => setIsModalOpen(false)} 
                        onSave={handleSave} 
                        saving={saving} 
                        readOnly={isExecutive}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isMergeModalOpen && (
                    <MergeSelectionModal
                        finances={finances.filter(f => !f.finances || !f.finances.some(inv => !!inv.Invoice_Number))}
                        onClose={() => setIsMergeModalOpen(false)}
                        onConfirm={(selected) => {
                            setSelectedMergeBillables(selected);
                            setIsMergeModalOpen(false);
                            setIsMergeFinanceModalOpen(true);
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isMergeFinanceModalOpen && selectedMergeBillables.length > 0 && (
                    <FinanceModal
                        isMergeMode={true}
                        mergedItems={selectedMergeBillables}
                        onClose={() => {
                            setIsMergeFinanceModalOpen(false);
                            setSelectedMergeBillables([]);
                        }}
                        onSave={handleSave}
                        saving={saving}
                        readOnly={isExecutive}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
