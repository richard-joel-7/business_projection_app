import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { MultiSelect } from "../components/ui/MultiSelect";
import api from "../lib/api";
import { Search, Edit2, AlertTriangle, ArrowLeft, TrendingUp, Calendar, LogOut, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { parseDate, getFY, getCY, getQuarter } from "../lib/utils";
import BillableModal from "../components/BillableModal";
import ViewProjectModal from "../components/ViewProjectModal";

export default function ProductionPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [logoSrc, setLogoSrc] = useState("pixoo-black-logo.png");
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

    const [dateContext, setDateContext] = useState("closeDate"); // 'closeDate' or 'billableDate'
    const [yearType, setYearType] = useState("FY"); // "FY" or "CY"
    const [displayCurrency, setDisplayCurrency] = useState("USD");

    // Filter States
    const [selectedOffices, setSelectedOffices] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [timelineFilter, setTimelineFilter] = useState('all');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});

    // View Modal state
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewProject, setViewProject] = useState(null);

    const userRoles = String(user?.role || "").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
    const showHubBack = user?.isAdmin || userRoles.length > 1;
    const currencySymbol = displayCurrency === "INR" ? "₹" : "$";
    const currencyDivisor = 0.012;

    const fetchProductionData = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await api.getProductionProjects(user?.email, user?.isAdmin, user?.role);
            if (Array.isArray(data)) {
                setProjects(data);
            } else {
                setProjects([]);
            }
        } catch (err) {
            console.error("Failed to fetch production projects", err);
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchProductionData();
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

    useEffect(() => {
        setSelectedYears([]);
    }, [yearType]);

    const parseAmount = (value) => {
        return parseFloat(String(value ?? "").replace(/[^0-9.-]+/g, "")) || 0;
    };

    const toDisplayAmount = (usdAmount) => {
        const amount = parseAmount(usdAmount);
        return displayCurrency === "INR" ? amount / currencyDivisor : amount;
    };

    const formatDisplayAmount = (usdAmount) => {
        const locale = displayCurrency === "INR" ? "en-IN" : "en-US";
        return `${currencySymbol}${Math.round(toDisplayAmount(usdAmount)).toLocaleString(locale)}`;
    };

    const formatExactAmount = (amount) => {
        const locale = displayCurrency === "INR" ? "en-IN" : "en-US";
        return `${currencySymbol}${Math.round(amount).toLocaleString(locale)}`;
    };

    // --- Timeline & Filter Logic (Adapted from Dashboard) ---
    const isDateWithinTimeline = (date, timeline) => {
        if (!date) return false;
        const now = new Date();
        const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(todayStart.getDate() + 1);

        if (timeline === 'today') return target >= todayStart && target < tomorrowStart;
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
                const cyStart = new Date(todayStart.getFullYear(), 0, 1);
                const nextCyStart = new Date(todayStart.getFullYear() + 1, 0, 1);
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
        if (timeline === 'overdue') return target < todayStart;
        return true;
    };

    const calculateQuarterlyData = (project) => {
        const result = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Total: 0 };
        if (!project.billables || !Array.isArray(project.billables)) return result;

        const usingBillableDate = dateContext === 'billableDate';
        const targetYears = usingBillableDate && selectedYears.length > 0 ? selectedYears : null;
        const targetMonths = usingBillableDate && selectedMonths.length > 0 ? selectedMonths : null;

        project.billables.forEach(b => {
            const dateStr = String(b['Billable_date'] || "").trim();
            const date = parseDate(dateStr);
            if (!date) return;

            if (usingBillableDate && timelineFilter !== 'all' && !isDateWithinTimeline(date, timelineFilter)) return;

            const yearVal = yearType === "CY" ? getCY(date) : getFY(date);
            if (targetYears && !targetYears.includes(yearVal)) return;

            if (targetMonths) {
                const monthShort = date.toLocaleString('default', { month: 'short' });
                if (!targetMonths.includes(monthShort)) return;
            }

            const q = getQuarter(date, yearType === "CY");
            
            let rawAmount = 0;
            if (usingBillableDate) {
                rawAmount = displayCurrency === "INR" ? (b['Amount_in_Inr'] || 0) : (b['Amount_in_USD'] || 0);
            } else {
                rawAmount = b['Amount_in_USD'] || 0;
            }
            
            const amountStr = String(rawAmount).replace(/[^0-9.-]+/g, "");
            const amount = parseFloat(amountStr) || 0;

            if (q) {
                result[q] += amount;
                result.Total += amount;
            }
        });

        return result;
    };

    const matchesFilters = (p, filters) => {
        if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(p['Status'])) return false;
        if (filters.offices && filters.offices.length > 0 && !filters.offices.includes(p['Contracting_Office'])) return false;
        if (filters.regions && filters.regions.length > 0 && !filters.regions.includes(p['Region'])) return false;

        if (timelineFilter !== 'all') {
            if (dateContext === 'closeDate') {
                const closeDate = parseDate(p['DealclosingDate']);
                if (!closeDate || !isDateWithinTimeline(closeDate, timelineFilter)) return false;
            } else {
                if (!p.billables || p.billables.length === 0) return false;
                const hasValidBillable = p.billables.some(b => {
                    const bDate = parseDate(b['Billable_date']);
                    return bDate && isDateWithinTimeline(bDate, timelineFilter);
                });
                if (!hasValidBillable) return false;
            }
        }

        if (filters.years && filters.years.length > 0) {
            if (dateContext === 'closeDate') {
                const closeDate = parseDate(p['DealclosingDate']);
                if (!closeDate) return false;
                const closeYear = yearType === "CY" ? getCY(closeDate) : getFY(closeDate);
                if (!filters.years.includes(closeYear)) return false;
            } else {
                if (!p.billables || p.billables.length === 0) return false;
                const hasValidBillable = p.billables.some(b => {
                    const bDate = parseDate(b['Billable_date']);
                    if (!bDate) return false;
                    const bYear = yearType === "CY" ? getCY(bDate) : getFY(bDate);
                    return filters.years.includes(bYear);
                });
                if (!hasValidBillable) return false;
            }
        }

        if (filters.months && filters.months.length > 0) {
            if (dateContext === 'closeDate') {
                const closeDate = parseDate(p['DealclosingDate']);
                if (!closeDate) return false;
                const closeMonth = closeDate.toLocaleString('default', { month: 'short' });
                if (!filters.months.includes(closeMonth)) return false;
            } else {
                if (!p.billables || p.billables.length === 0) return false;
                const hasValidBillable = p.billables.some(b => {
                    const bDate = parseDate(b['Billable_date']);
                    if (!bDate) return false;
                    const bMonth = bDate.toLocaleString('default', { month: 'short' });
                    return filters.months.includes(bMonth);
                });
                if (!hasValidBillable) return false;
            }
        }

        return true;
    };

    // Calculate dynamic options
    const filterOptions = useMemo(() => {
        const statuses = new Set();
        const offices = new Set();
        const regions = new Set();
        const years = new Set();
        const months = new Set();

        const baseProjects = dateContext === 'billableDate' 
            ? projects.filter(p => p.billables && p.billables.length > 0)
            : projects;

        baseProjects.forEach(p => {
            if (p['Status']) statuses.add(p['Status']);
            if (p['Contracting_Office']) offices.add(p['Contracting_Office']);
            if (p['Region']) regions.add(p['Region']);

            if (dateContext === 'closeDate') {
                const closeDate = parseDate(p['DealclosingDate']);
                if (closeDate) {
                    years.add(yearType === "CY" ? getCY(closeDate) : getFY(closeDate));
                    months.add(closeDate.toLocaleString('default', { month: 'short' }));
                }
            } else {
                if (p.billables) {
                    p.billables.forEach(b => {
                        const bDate = parseDate(b['Billable_date']);
                        if (bDate) {
                            years.add(yearType === "CY" ? getCY(bDate) : getFY(bDate));
                            months.add(bDate.toLocaleString('default', { month: 'short' }));
                        }
                    });
                }
            }
        });

        const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        return {
            statuses: Array.from(statuses).sort().map(v => ({ value: v, label: v })),
            offices: Array.from(offices).sort().map(v => ({ value: v, label: v })),
            regions: Array.from(regions).sort().map(v => ({ value: v, label: v })),
            years: Array.from(years).sort().reverse().map(v => ({ value: v, label: v })),
            months: Array.from(months).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)).map(v => ({ value: v, label: v }))
        };
    }, [projects, yearType, dateContext]);

    const uniqueProjects = useMemo(() => {
        const groups = {};
        projects.forEach(p => {
            const id = p['Block_id'];
            if (!groups[id]) {
                groups[id] = { ...p, 'Amount_in_USD': parseAmount(p['Amount_in_USD']), billables: [] };
            }
            if (p.billables) {
                groups[id].billables.push(...p.billables);
            }
        });

        let result = Object.values(groups);
        if (dateContext === 'billableDate') {
            result = result.filter(p => p.billables && p.billables.length > 0);
        }

        return result.map(p => {
            const qData = calculateQuarterlyData(p);
            return { ...p, ...qData };
        });
    }, [projects, selectedYears, selectedMonths, dateContext, timelineFilter, yearType, displayCurrency]);

    const filteredProjects = useMemo(() => {
        return uniqueProjects.filter(p => {
            if (debouncedSearch) {
                const term = debouncedSearch.toLowerCase();
                const match = 
                    String(p['DealName'] || "").toLowerCase().includes(term) ||
                    String(p['Block_Name'] || "").toLowerCase().includes(term) ||
                    String(p['Region'] || "").toLowerCase().includes(term) ||
                    String(p['Contracting_Office'] || "").toLowerCase().includes(term) ||
                    String(p['Block_id'] || "").toLowerCase().includes(term);
                if (!match) return false;
            }

            return matchesFilters(p, {
                statuses: selectedStatuses,
                offices: selectedOffices,
                regions: selectedRegions,
                years: selectedYears,
                months: selectedMonths
            });
        });
    }, [uniqueProjects, debouncedSearch, selectedStatuses, selectedOffices, selectedRegions, selectedYears, selectedMonths, dateContext, timelineFilter, yearType]);

    const sortedProjects = useMemo(() => {
        if (!sortConfig.key || sortConfig.direction === 'default') return filteredProjects;

        return [...filteredProjects].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (['Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Amount_in_USD'].includes(sortConfig.key)) {
                valA = parseAmount(valA);
                valB = parseAmount(valB);
            } else if (sortConfig.key === 'DealclosingDate') {
                valA = parseDate(valA)?.getTime() || 0;
                valB = parseDate(valB)?.getTime() || 0;
            } else {
                valA = String(valA || "").toLowerCase();
                valB = String(valB || "").toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredProjects, sortConfig]);

    const totals = useMemo(() => {
            const t = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Total: 0, Overall: 0 };
            filteredProjects.forEach(p => {
                t.Q1 += p.Q1 || 0;
                t.Q2 += p.Q2 || 0;
                t.Q3 += p.Q3 || 0;
                t.Q4 += p.Q4 || 0;
                t.Total += p.Total || 0;
                
                if (dateContext === 'billableDate') {
                    t.Overall += p.Total || 0;
                } else {
                    t.Overall += parseAmount(p['Amount_in_USD']);
                }
            });
            return t;
        }, [filteredProjects, dateContext]);

    const monthlyKPIs = useMemo(() => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const data = {};
        months.forEach(m => data[m] = 0);

        filteredProjects.forEach(p => {
             if (p.billables && p.billables.length > 0) {
                 p.billables.forEach(b => {
                     const bDate = parseDate(b['Billable_date']);
                     if (!bDate) return;
                     
                     if (timelineFilter !== 'all' && !isDateWithinTimeline(bDate, timelineFilter)) return;
                     
                     const bYear = yearType === "CY" ? getCY(bDate) : getFY(bDate);
                     if (selectedYears.length > 0 && !selectedYears.includes(bYear)) return;
                     
                     const bMonth = bDate.toLocaleString('default', { month: 'short' });
                     if (selectedMonths.length > 0 && !selectedMonths.includes(bMonth)) return;

                     let amount = displayCurrency === "INR" ? (b['Amount_in_Inr'] || 0) : (b['Amount_in_USD'] || 0);
                     amount = parseFloat(String(amount).replace(/[^0-9.-]+/g, "")) || 0;
                     
                     if (data[bMonth] !== undefined) {
                         data[bMonth] += amount;
                     }
                 });
             }
        });
        return data;
    }, [filteredProjects, timelineFilter, yearType, selectedYears, selectedMonths, displayCurrency]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' :
                       prev.key === key && prev.direction === 'desc' ? 'default' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <span className="text-gray-600 group-hover:text-gray-400 ml-1">↕</span>;
        if (sortConfig.direction === 'asc') return <span className="text-primary ml-1">↑</span>;
        if (sortConfig.direction === 'desc') return <span className="text-primary ml-1">↓</span>;
        return <span className="text-gray-600 ml-1">↕</span>;
    };

    const toggleRow = (blockId) => {
        setExpandedRows(prev => ({
            ...prev,
            [blockId]: !prev[blockId]
        }));
    };

    const handleModalSuccess = () => {
        setIsModalOpen(false);
        fetchProductionData();
    };

    if (loading && projects.length === 0) {
        return (
            <div className="min-h-screen bg-dark-900 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-gray-400 font-medium">Loading Production Hub...</p>
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
                            {showHubBack && (
                                <button onClick={() => navigate('/admin-dashboard')} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white group relative" title="Back to Hub">
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            <div className="p-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                                <img src={logoSrc} alt="PhantomFX" className="h-6" onError={(e) => e.target.style.display = 'none'} />
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                <span className="text-white">Production </span>
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
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                        <AlertTriangle size={20} />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Date Context Toggle */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3 bg-dark-800/50 border border-white/10 rounded-xl p-1.5 w-full md:w-auto">
                        <button
                            onClick={() => {
                                setDateContext('closeDate');
                                setSelectedYears([]);
                                setSelectedMonths([]);
                            }}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${dateContext === 'closeDate'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Calendar size={16} />
                            <span className="text-sm font-medium">Close Date</span>
                        </button>
                        <button
                            onClick={() => {
                                setDateContext('billableDate');
                                setSelectedYears([]);
                                setSelectedMonths([]);
                            }}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${dateContext === 'billableDate'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <TrendingUp size={16} />
                            <span className="text-sm font-medium">Billable Date</span>
                        </button>
                    </div>

                    <div className="text-xs text-gray-500 w-full md:w-auto text-left md:text-right">
                        {dateContext === 'closeDate' ? 'FY & Month filters based on Close Date' : 'FY & Month filters based on Billable Date'}
                    </div>
                </div>

                {/* KPIs Section */}
                <div className="grid grid-cols-2 gap-3 mb-4 md:w-1/2 lg:w-1/3">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Projects</h3>
                        <div className="text-[clamp(1.25rem,5vw,2rem)] font-bold text-white leading-tight">{filteredProjects.length}</div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 flex flex-col justify-center">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Amount ({displayCurrency})</h3>
                        <div className="font-bold text-white leading-tight tracking-tight break-all" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.8rem)' }}>
                            {dateContext === 'billableDate' ? formatExactAmount(totals.Overall) : formatDisplayAmount(totals.Overall)}
                        </div>
                    </motion.div>
                </div>

                {/* Monthly KPIs Section */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-4">
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                        <motion.div key={m} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel p-2 rounded-lg border border-white/10 bg-white/5 text-center">
                            <h3 className="text-gray-400 text-[9px] font-medium mb-1 uppercase tracking-wider">{m}</h3>
                            <div className="text-xs font-bold text-white tracking-tight truncate" title={formatExactAmount(monthlyKPIs[m])}>
                                {formatExactAmount(monthlyKPIs[m])}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Filters Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {/* Status */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-50">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Status</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                            {filterOptions.statuses.map(status => (
                                <button
                                    key={status.value}
                                    onClick={() => {
                                        const newValues = selectedStatuses.includes(status.value)
                                            ? selectedStatuses.filter(v => v !== status.value)
                                            : [...selectedStatuses, status.value];
                                        setSelectedStatuses(newValues);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${selectedStatuses.includes(status.value)
                                        ? "bg-green-500 text-white border-green-500 font-bold"
                                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Office */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-40">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Office</h3>
                        <MultiSelect
                            options={filterOptions.offices}
                            value={selectedOffices}
                            onChange={setSelectedOffices}
                            placeholder="Select Office"
                            maintainOrder={true}
                        />
                    </motion.div>

                    {/* Region */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Region</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                            {filterOptions.regions.map(region => (
                                <button
                                    key={region.value}
                                    onClick={() => {
                                        const newValues = selectedRegions.includes(region.value)
                                            ? selectedRegions.filter(v => v !== region.value)
                                            : [...selectedRegions, region.value];
                                        setSelectedRegions(newValues);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${selectedRegions.includes(region.value)
                                        ? "bg-indigo-500 text-white border-indigo-500 font-bold"
                                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {region.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* FY / CY */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">{yearType}</h3>
                            <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setYearType("FY")}
                                    className={`flex items-center justify-center px-3 py-1 rounded-md transition-all ${yearType === "FY"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-[10px] font-bold">FY</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setYearType("CY")}
                                    className={`flex items-center justify-center px-3 py-1 rounded-md transition-all ${yearType === "CY"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-[10px] font-bold">CY</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {filterOptions.years.map(fy => (
                                <button
                                    key={fy.value}
                                    onClick={() => {
                                        const newValues = selectedYears.includes(fy.value)
                                            ? selectedYears.filter(v => v !== fy.value)
                                            : [...selectedYears, fy.value];
                                        setSelectedYears(newValues);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${selectedYears.includes(fy.value)
                                        ? "bg-pink-500 text-white border-pink-500 font-bold"
                                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {fy.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Closing Timeline */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-30">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">
                            {dateContext === 'closeDate' ? 'Closing Timeline' : 'Billable Timeline'}
                        </h3>
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
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-20">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Month</h3>
                        <MultiSelect
                            options={filterOptions.months}
                            value={selectedMonths}
                            onChange={setSelectedMonths}
                            placeholder="Select Month"
                            maintainOrder={true}
                        />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-10">
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
                </div>

                {/* Actions Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search projects..."
                            className="pl-12 bg-dark-800/50 border-white/5 focus:bg-dark-800 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        {(selectedStatuses.length > 0 || selectedOffices.length > 0 || selectedYears.length > 0 || selectedMonths.length > 0 || selectedRegions.length > 0 || timelineFilter !== 'all') && (
                            <Button variant="ghost" onClick={() => {
                                setSelectedStatuses([]);
                                setSelectedOffices([]);
                                setSelectedYears([]);
                                setSelectedMonths([]);
                                setSelectedRegions([]);
                                setTimelineFilter('all');
                                setSearch("");
                            }} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20">
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table Area */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative z-0"
                >
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-dark-800 text-gray-400 font-medium uppercase tracking-wider text-[10px] border-b border-white/10 sticky top-0 z-40 shadow-lg">
                                <tr className="whitespace-nowrap">
                                    <th className="p-4 w-10 text-center"></th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors sticky left-0 z-20 bg-dark-800/95 backdrop-blur-md min-w-[120px] sm:min-w-[200px] border-r border-white/10" onClick={() => handleSort('Block_Name')}>
                                        <div className="flex items-center">Project Name <SortIcon columnKey="Block_Name" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors min-w-[120px]" onClick={() => handleSort('Region')}>
                                        <div className="flex items-center">Region <SortIcon columnKey="Region" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors min-w-[120px]" onClick={() => handleSort('Contracting_Office')}>
                                        <div className="flex items-center">Office <SortIcon columnKey="Contracting_Office" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors min-w-[140px]" onClick={() => handleSort('DealclosingDate')}>
                                        <div className="flex items-center">Close Date <SortIcon columnKey="DealclosingDate" /></div>
                                    </th>
                                    <th className="p-4 text-right min-w-[140px]">Amount ({displayCurrency})</th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors min-w-[120px]" onClick={() => handleSort('Type')}>
                                        <div className="flex items-center">Type <SortIcon columnKey="Type" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors min-w-[120px]" onClick={() => handleSort('Status')}>
                                        <div className="flex items-center">Status <SortIcon columnKey="Status" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors min-w-[120px]" onClick={() => handleSort('Approved_to_Finance')}>
                                        <div className="flex items-center">Approval <SortIcon columnKey="Approved_to_Finance" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer group hover:bg-white/5 transition-colors min-w-[120px]" onClick={() => handleSort('Approved by')}>
                                        <div className="flex items-center">Approved By <SortIcon columnKey="Approved by" /></div>
                                    </th>
                                    <th className="p-4 text-center w-20 sticky right-0 z-20 bg-dark-800/95 backdrop-blur-md border-l border-white/10">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sortedProjects.length > 0 ? (
                                    sortedProjects.map((p, index) => {
                                        const isExpanded = expandedRows[p['Block_id']];
                                        
                                        return (
                                            <React.Fragment key={p['Block_id'] || index}>
                                                <tr className={`group transition-colors hover:bg-white/5`}>
                                                    <td className="p-4 text-center">
                                                        <button 
                                                            onClick={() => {
                                                                setViewProject(p);
                                                                setIsViewModalOpen(true);
                                                            }} 
                                                            className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/20 transition-all focus:outline-none"
                                                            title="View Project Details"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                    </td>
                                                    <td className="p-4 font-medium text-white sticky left-0 z-20 bg-dark-900/95 group-hover:bg-dark-800/95 border-r border-white/10 truncate max-w-[120px] sm:max-w-[300px]">
                                                        {p['Block_Name'] || p['DealName'] || 'Untitled Project'}
                                                    </td>
                                                    <td className="p-4 text-gray-300">{p['Region'] || '-'}</td>
                                                    <td className="p-4 text-gray-300">{p['Contracting_Office'] || '-'}</td>
                                                    <td className="p-4 text-gray-300">{p['DealclosingDate'] || '-'}</td>
                                                    <td className="p-4 text-right font-medium text-gray-200">
                                                        {dateContext === 'billableDate' ? formatExactAmount(p.Total || 0) : formatDisplayAmount(p['Amount_in_USD'])}
                                                    </td>
                                                    <td className="p-4 text-gray-300">{p['Type'] || '-'}</td>
                                                    <td className="p-4 text-gray-300">
                                                        {p['Status'] === 'Billable' ? (
                                                            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">{p['Status']}</span>
                                                        ) : p['Status'] === 'Billed' ? (
                                                            <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">{p['Status']}</span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-gray-300">
                                                        {p['Approved_to_Finance'] === 'True' ? (
                                                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">Approved</span>
                                                        ) : p['Approved_to_Finance'] === 'Partially Approved' ? (
                                                            <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium border border-yellow-500/20">Partially Approved</span>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded-full bg-gray-500/10 text-gray-400 text-xs font-medium border border-gray-500/20">Pending</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-gray-300 text-xs">
                                                        {p['Approved by'] || '-'}
                                                    </td>
                                                    <td className="p-4 text-center sticky right-0 z-20 bg-dark-900/95 group-hover:bg-dark-800/95 border-l border-white/10">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedProject(p);
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded transition-colors inline-flex items-center gap-1 text-xs font-medium"
                                                            title="Edit Billables"
                                                        >
                                                            <Edit2 size={14} /> <span className="hidden xl:inline">Edit</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="12" className="p-12 text-center text-gray-500">
                                            {search || selectedStatuses.length || selectedOffices.length ? "No projects match your filters." : "No projects available."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-dark-800/90 font-semibold border-t-2 border-white/10 sticky bottom-0 z-20">
                                <tr>
                                    <td colSpan="5" className="p-4 text-right text-gray-300 sticky left-0 z-30 bg-dark-800/95 backdrop-blur-md border-r border-white/10">Totals</td>
                                    <td className="p-4 text-right text-white">
                                        {dateContext === 'billableDate' ? formatExactAmount(totals.Overall) : formatDisplayAmount(totals.Overall)}
                                    </td>
                                    <td className="p-4"></td>
                                    <td className="p-4"></td>
                                    <td className="p-4"></td>
                                    <td className="p-4"></td>
                                    <td className="p-4 sticky right-0 z-30 bg-dark-800/95 backdrop-blur-md border-l border-white/10"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </motion.div>
            </main>

            {/* Billable Modal */}
            <BillableModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedProject(null);
                }}
                project={selectedProject}
                user={user}
                onSuccess={() => {
                    setIsModalOpen(false);
                    setSelectedProject(null);
                    fetchProductionData();
                }}
            />

            {/* View Project Modal */}
            <ViewProjectModal
                isOpen={isViewModalOpen}
                onClose={() => {
                    setIsViewModalOpen(false);
                    setViewProject(null);
                }}
                project={viewProject}
                dateContext={dateContext}
                displayCurrency={displayCurrency}
                formatExactAmount={formatExactAmount}
                formatDisplayAmount={formatDisplayAmount}
                timelineFilter={timelineFilter}
                selectedYears={selectedYears}
                selectedMonths={selectedMonths}
                yearType={yearType}
                isDateWithinTimeline={isDateWithinTimeline}
            />
        </div>
    );
}