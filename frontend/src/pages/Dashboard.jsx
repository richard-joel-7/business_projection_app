import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { MultiSelect } from "../components/ui/MultiSelect";
import api from "../lib/api";
import { Plus, LogOut, Search, Edit2, Eye, AlertTriangle, X, Calendar, TrendingUp, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { parseDate, getFY, getCY, getQuarter } from "../lib/utils";

const getDaysToGo = (dateStr) => {
    if (!dateStr) return null;
    const date = parseDate(dateStr);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

export default function Dashboard() {
    const { user, loading: authLoading, logout } = useAuth();
    const { projects, loadingProjects: loading, fetchProjects } = useData();
    const navigate = useNavigate();

    // const [projects, setProjects] = useState([]); // From Context
    // const [loading, setLoading] = useState(true); // From Context
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [logoSrc, setLogoSrc] = useState("pixoo-black-logo.png");
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    const [dateContext, setDateContext] = useState("closeDate");

    // Filter States
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedOffices, setSelectedOffices] = useState([]);
    const [selectedBizPocs, setSelectedBizPocs] = useState([]);
    const [selectedFYs, setSelectedFYs] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [selectedRegions, setSelectedRegions] = useState([]);
    const [selectedTerritories, setSelectedTerritories] = useState([]);
    const [timelineFilter, setTimelineFilter] = useState('all');
    const [showUnapprovedOnly, setShowUnapprovedOnly] = useState(false);
    const [displayCurrency, setDisplayCurrency] = useState("USD");
    const [yearType, setYearType] = useState("FY"); // "FY" or "CY"
    const userRoles = String(user?.role || "").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
    const showHubBack = user?.isAdmin || userRoles.length > 1 || userRoles.includes("executive");
    const isExecutive = userRoles.includes("executive") && !user?.isAdmin;
    const currencySymbol = displayCurrency === "INR" ? "₹" : "$";
    const usdToInrRate = 90;

    const parseAmount = (value) => {
        return parseFloat(String(value ?? "").replace(/[^0-9.-]+/g, "")) || 0;
    };

    const toDisplayAmount = (usdAmount) => {
        const amount = parseAmount(usdAmount);
        return displayCurrency === "INR" ? amount * usdToInrRate : amount;
    };

    const formatDisplayAmount = (usdAmount) => {
        const locale = displayCurrency === "INR" ? "en-IN" : "en-US";
        return `${currencySymbol}${Math.round(toDisplayAmount(usdAmount)).toLocaleString(locale)}`;
    };

    useEffect(() => {
        setSelectedFYs([]);
    }, [yearType]);

    useEffect(() => {
        if (user) {
            fetchProjects();
        }
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
            } catch (err) {
                console.error("Failed to fetch logo", err);
            }
        };
        fetchLogo();
    }, [user]);
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

    const calculateQuarterlyData = (project) => {
        const result = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Total: 0 };

        if (!project.projections || !Array.isArray(project.projections)) return result;

        const usingProjectionDate = dateContext === 'projectionDate';
        const targetFYs = usingProjectionDate && selectedFYs.length > 0 ? selectedFYs : null;
        const targetMonths = usingProjectionDate && selectedMonths.length > 0 ? selectedMonths : null;

        project.projections.forEach(proj => {
            if (proj["Change Type"] === "Delete") return;
            const dateStr = String(proj['Projection date'] || "").trim();
            const date = parseDate(dateStr);
            if (!date) return;

            if (usingProjectionDate && timelineFilter !== 'all' && !isDateWithinTimeline(date, timelineFilter)) return;

            const fy = yearType === "CY" ? getCY(date) : getFY(date);
            if (targetFYs && !targetFYs.includes(fy)) return;

            if (targetMonths) {
                const monthShort = date.toLocaleString('default', { month: 'short' });
                if (!targetMonths.includes(monthShort)) return;
            }

            const q = getQuarter(date, yearType === "CY");
            const rawAmount = proj['Amount in USD'] || proj['Amount'] || 0;
            const amountStr = String(rawAmount).replace(/[^0-9.-]+/g, "");
            const amount = parseFloat(amountStr) || 0;

            if (q) {
                result[q] += amount;
                result.Total += amount;
            }
        });

        return result;
    };

    const uniqueProjects = useMemo(() => {
        const groups = {};
        projects.forEach(p => {
            const id = p['Project ID'];
            if (!groups[id]) {
                groups[id] = { ...p, 'Amount in USD': 0, 'Value in Home Currency': 0, _count: 0, projections: [] };
            }
            const val = parseFloat(String(p['Amount in USD']).replace(/[^0-9.-]+/g, "")) || 0;
            groups[id]['Amount in USD'] += val;

            const homeVal = parseFloat(String(p['Value in Home Currency'] || p['Home_Amount']).replace(/[^0-9.-]+/g, "")) || 0;
            groups[id]['Value in Home Currency'] += homeVal;

            groups[id]._count += 1;

            if (p.projections) {
                groups[id].projections.push(...p.projections);
            }
        });

        return Object.values(groups).map(p => {
            const qData = calculateQuarterlyData(p);
            return { ...p, ...qData };
        });
    }, [projects, selectedFYs, selectedMonths, dateContext, timelineFilter, yearType]);

    const matchesFilters = (p, filters) => {
        if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(p['deal_stage'] || p['Project Status'])) return false;
        if (filters.offices && filters.offices.length > 0 && !filters.offices.includes(p['Office'])) return false;
        if (filters.bizPocs && filters.bizPocs.length > 0 && !filters.bizPocs.includes(p['Biz Poc'])) return false;
        if (filters.regions && filters.regions.length > 0 && !filters.regions.includes(p['Region Type'])) return false;
        if (filters.territories && filters.territories.length > 0 && !filters.territories.includes(p['Territory'])) return false;

        if (timelineFilter !== 'all') {
            if (dateContext === 'closeDate') {
                const closeDate = parseDate(p['Close Date']);
                if (!isDateWithinTimeline(closeDate, timelineFilter)) return false;
            } else {
                const hasProjectionInTimeline = (p.projections || []).some((proj) => {
                    if (proj["Change Type"] === "Delete") return false;
                    const projectionDate = parseDate(proj['Projection date']);
                    return isDateWithinTimeline(projectionDate, timelineFilter);
                });
                if (!hasProjectionInTimeline) return false;
            }
        }

        if (dateContext === 'closeDate') {
            const closeDateYearVal = yearType === 'CY' ? p.closeDateCY : p.closeDateFY;
            if (filters.fys && filters.fys.length > 0 && !filters.fys.includes(closeDateYearVal)) return false;
            if (filters.months && filters.months.length > 0 && !filters.months.includes(p.closeDateMonth)) return false;
        } else {
            if (filters.fys && filters.fys.length > 0) {
                const hasMatchingFY = p.projections && p.projections.some(proj => {
                    const date = parseDate(proj['Projection date']);
                    return date && filters.fys.includes(yearType === 'CY' ? getCY(date) : getFY(date));
                });
                if (!hasMatchingFY) return false;
            }
            if (filters.months && filters.months.length > 0) {
                const hasMatchingMonth = p.projections && p.projections.some(proj => {
                    const date = parseDate(proj['Projection date']);
                    return date && filters.months.includes(date.toLocaleString('default', { month: 'short' }));
                });
                if (!hasMatchingMonth) return false;
            }
        }

        return true;
    };

    const hasUnapprovedProjectionChanges = (project) => {
        if (!project?.projections || !Array.isArray(project.projections)) return false;
        return project.projections.some((proj) => {
            const hasChange = Boolean(proj["Action Date"] || proj["Action Timestamp"]);
            const approvedRaw = String(proj["Is Approved"] ?? "").toLowerCase().trim();
            const isApproved = approvedRaw === "true" || approvedRaw === "yes" || approvedRaw === "approved" || approvedRaw === "1";
            return hasChange && !isApproved;
        });
    };

    const filterOptions = useMemo(() => {
        const getOptions = (key, filterKey, currentFilters) => {
            const otherFilters = { ...currentFilters };
            delete otherFilters[filterKey];
            const relevantProjects = uniqueProjects.filter(p => matchesFilters(p, otherFilters));

            if (key === 'fy') {
                if (dateContext === 'closeDate') {
                    const yearProp = yearType === 'CY' ? 'closeDateCY' : 'closeDateFY';
                    return [...new Set(relevantProjects.map(p => p[yearProp]).filter(f => f !== 'Unknown'))].sort();
                } else {
                    const fys = new Set();
                    relevantProjects.forEach(p => {
                        if (p.projections) {
                            p.projections.forEach(proj => {
                                if (proj["Change Type"] === "Delete") return;
                                const date = parseDate(proj['Projection date']);
                                if (date) fys.add(yearType === 'CY' ? getCY(date) : getFY(date));
                            });
                        }
                    });
                    return [...fys].sort();
                }
            } else if (key === 'month') {
                if (dateContext === 'closeDate') {
                    return [...new Set(relevantProjects.map(p => p.closeDateMonth).filter(m => m !== 'Unknown'))];
                } else {
                    const months = new Set();
                    relevantProjects.forEach(p => {
                        if (p.projections) {
                            p.projections.forEach(proj => {
                                if (proj["Change Type"] === "Delete") return;
                                const date = parseDate(proj['Projection date']);
                                if (date) months.add(date.toLocaleString('default', { month: 'short' }));
                            });
                        }
                    });
                    return [...months];
                }
            }

            return [...new Set(relevantProjects.map(p => p[key]).filter(Boolean))].sort();
        };

        const currentFilters = {
            statuses: selectedStatuses,
            offices: selectedOffices,
            bizPocs: selectedBizPocs,
            fys: selectedFYs,
            months: selectedMonths,
            regions: selectedRegions,
            territories: selectedTerritories
        };

        const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec"];

        return {
            statuses: getOptions('deal_stage', 'statuses', currentFilters), // Use deal_stage for status filter
            offices: getOptions('Office', 'offices', currentFilters),
            bizPocs: getOptions('Biz Poc', 'bizPocs', currentFilters),
            fys: getOptions('fy', 'fys', currentFilters),
            months: getOptions('month', 'months', currentFilters).sort((a, b) => {
                const indexA = monthsOrder.indexOf(a);
                const indexB = monthsOrder.indexOf(b);
                // If not found in array, put at end
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            }),
            regions: getOptions('Region Type', 'regions', currentFilters),
            territories: getOptions('Territory', 'territories', currentFilters)
        };
    }, [uniqueProjects, selectedStatuses, selectedOffices, selectedBizPocs, selectedFYs, selectedMonths, selectedRegions, selectedTerritories, dateContext]);

    const filteredProjects = useMemo(() => {
        return uniqueProjects.filter(p => {
            if (search) {
                const lowerSearch = search.toLowerCase();
                const matchesSearch = (
                    (p['Project Name'] && p['Project Name'].toLowerCase().includes(lowerSearch)) ||
                    (p['Project ID'] && String(p['Project ID']).toLowerCase().includes(lowerSearch)) ||
                    (p['Client'] && p['Client'].toLowerCase().includes(lowerSearch))
                );
                if (!matchesSearch) return false;
            }

            if (showUnapprovedOnly && !hasUnapprovedProjectionChanges(p)) {
                return false;
            }

            return matchesFilters(p, {
                statuses: selectedStatuses,
                offices: selectedOffices,
                bizPocs: selectedBizPocs,
                fys: selectedFYs,
                months: selectedMonths,
                regions: selectedRegions,
                territories: selectedTerritories
            });
        });
    }, [uniqueProjects, search, selectedStatuses, selectedOffices, selectedBizPocs, selectedFYs, selectedMonths, selectedRegions, selectedTerritories, dateContext, timelineFilter, showUnapprovedOnly]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'default';
        }
        setSortConfig({ key, direction });
    };

    const sortedProjects = useMemo(() => {
        const data = [...filteredProjects];
        if (sortConfig.direction === 'default' || !sortConfig.key) return data;

        return data.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (['Amount in USD', 'Value in Home Currency', 'Profit %', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'].includes(sortConfig.key)) {
                aValue = parseFloat(String(aValue).replace(/[^0-9.-]+/g, "")) || 0;
                bValue = parseFloat(String(bValue).replace(/[^0-9.-]+/g, "")) || 0;
            } else if (['Close Date'].includes(sortConfig.key)) {
                const dateA = parseDate(aValue);
                const dateB = parseDate(bValue);
                aValue = dateA ? dateA.getTime() : 0;
                bValue = dateB ? dateB.getTime() : 0;
            } else {
                aValue = String(aValue || "").toLowerCase();
                bValue = String(bValue || "").toLowerCase();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredProjects, sortConfig]);

    const getSortIcon = (key) => {
        if (sortConfig.key !== key || sortConfig.direction === 'default') {
            return <span className="ml-1 opacity-30">⇅</span>;
        }
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-primary">↑</span> : <span className="ml-1 text-primary">↓</span>;
    };

    const totalProjects = filteredProjects.length;
    const totalAmount = filteredProjects.reduce((sum, p) => {
        if (dateContext === 'projectionDate') {
            return sum + (p.Total || 0);
        }
        return sum + (p['Amount in USD'] || 0);
    }, 0);

    const clearFilters = () => {
        setSelectedStatuses([]);
        setSelectedOffices([]);
        setSelectedBizPocs([]);
        setSelectedFYs([]);
        setSelectedMonths([]);
        setSelectedRegions([]);
        setSelectedTerritories([]);
        setTimelineFilter('all');
        setShowUnapprovedOnly(false);
        setSearch("");
    };

    const getStatusColor = (status) => {
        if (!status) return 'bg-white/5 text-gray-300 border-white/10';
        const s = String(status).toLowerCase();
        if (s.includes('award')) return 'bg-green-500/10 text-green-400 border-green-500/20';
        if (s.includes('near win')) return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
        if (s.includes('potential') || s.includes('greenlit')) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
        if (s.includes('opportunity')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        if (s.includes('lost') || s.includes('loss')) return 'bg-red-500/10 text-red-400 border-red-500/20';
        if (s.includes('hold')) return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
        return 'bg-white/5 text-gray-300 border-white/10';
    };

    const selectedFYDisplay = selectedFYs.length === 1 ? selectedFYs[0] : (selectedFYs.length > 1 ? 'Multi' : 'All');

    const renderProjectName = (project) => {
        const stage = project['deal_stage'] || project['Project Status'] || 'Unknown';
        const s = String(stage).toLowerCase();
        const shouldShowDaysTag =
            s.includes('greenlit') ||
            s.includes('potential') ||
            s.includes('qualified opportunity') ||
            s.includes('near win');
        const daysToGo = getDaysToGo(project['Close Date']);
        const isOverdue = daysToGo !== null && daysToGo < 0;

        return (
            <div className="flex flex-col gap-1 items-center justify-center">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{project['Project Name']}</span>
                </div>
                
                {shouldShowDaysTag && daysToGo !== null && (
                    <div className={`px-2 py-0.5 rounded-full border text-[10px] font-medium shadow-sm backdrop-blur-sm transition-all
                        ${isOverdue
                            ? 'bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                            : 'bg-orange-500/20 border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                        }`}
                    >
                        <span>{Math.abs(daysToGo)} Days {isOverdue ? 'Ago' : 'To Go'}</span>
                    </div>
                )}
            </div>
        );
    };

    if (authLoading) return <div className="text-white text-center mt-20">Loading auth...</div>;

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-primary/30">
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
                                <span className="text-white">Business </span>
                                <span className="text-primary" style={{ textShadow: '0 0 15px rgba(52, 211, 153, 0.4)' }}>Projections</span>
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
                            <span className="text-xs font-medium text-gray-300">Welcome, <span className="text-white font-bold">{user?.name}</span></span>
                        </div>
                        <button onClick={handleLogout} className="hidden md:block p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {/* Date Context Toggle */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3 bg-dark-800/50 border border-white/10 rounded-xl p-1.5 w-full md:w-auto">
                        <button
                            onClick={() => {
                                setDateContext('closeDate');
                                setSelectedFYs([]);
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
                                setDateContext('projectionDate');
                                setSelectedFYs([]);
                                setSelectedMonths([]);
                            }}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${dateContext === 'projectionDate'
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <TrendingUp size={16} />
                            <span className="text-sm font-medium">Projection Date</span>
                        </button>
                    </div>

                    <div className="text-xs text-gray-500 w-full md:w-auto text-left md:text-right">
                        {dateContext === 'closeDate' ? 'FY & Month filters based on Close Date' : 'FY & Month filters based on Projection Date'}
                    </div>
                </div>

                {/* KPIs Section */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 min-w-[150px] shrink-0">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Projects</h3>
                        <div className="text-[clamp(1.25rem,5vw,2rem)] font-bold text-white leading-tight">{totalProjects}</div>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 min-w-[200px] max-w-full">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-1 uppercase tracking-wider">Total Amount ({displayCurrency})</h3>
                        <div className="text-[clamp(0.95rem,4.2vw,1.6rem)] md:text-[clamp(1.05rem,1.6vw,1.8rem)] font-bold text-white leading-tight tracking-tight whitespace-nowrap overflow-visible">{formatDisplayAmount(totalAmount)}</div>
                    </motion.div>
                </div>

                {/* Filters Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {/* Status */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Status</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                            {filterOptions.statuses.map(status => (
                                <button
                                    key={status}
                                    onClick={() => {
                                        const newValues = selectedStatuses.includes(status)
                                            ? selectedStatuses.filter(v => v !== status)
                                            : [...selectedStatuses, status];
                                        setSelectedStatuses(newValues);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${selectedStatuses.includes(status)
                                        ? "bg-green-500 text-white border-green-500 font-bold"
                                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Office */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Office</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                            {filterOptions.offices.map(office => (
                                <button
                                    key={office}
                                    onClick={() => {
                                        const newValues = selectedOffices.includes(office)
                                            ? selectedOffices.filter(v => v !== office)
                                            : [...selectedOffices, office];
                                        setSelectedOffices(newValues);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${selectedOffices.includes(office)
                                        ? "bg-purple-500 text-white border-purple-500 font-bold"
                                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {office}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Region */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Region</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                            {filterOptions.regions.map(region => (
                                <button
                                    key={region}
                                    onClick={() => {
                                        const newValues = selectedRegions.includes(region)
                                            ? selectedRegions.filter(v => v !== region)
                                            : [...selectedRegions, region];
                                        setSelectedRegions(newValues);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${selectedRegions.includes(region)
                                        ? "bg-indigo-500 text-white border-indigo-500 font-bold"
                                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {region}
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
                            {filterOptions.fys.map(fy => (
                                <button
                                    key={fy}
                                    onClick={() => {
                                        const newValues = selectedFYs.includes(fy)
                                            ? selectedFYs.filter(v => v !== fy)
                                            : [...selectedFYs, fy];
                                        setSelectedFYs(newValues);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${selectedFYs.includes(fy)
                                        ? "bg-pink-500 text-white border-pink-500 font-bold"
                                        : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {fy}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Biz Poc */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-30">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Biz Poc</h3>
                        <MultiSelect
                            options={filterOptions.bizPocs}
                            value={selectedBizPocs}
                            onChange={setSelectedBizPocs}
                            placeholder="Select Biz Poc"
                        />
                    </motion.div>

                    {/* Closing Timeline */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-20">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">
                            {dateContext === 'closeDate' ? 'Closing Timeline' : 'Projection Timeline'}
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
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative z-10">
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider">Month</h3>
                        <MultiSelect
                            options={filterOptions.months}
                            value={selectedMonths}
                            onChange={setSelectedMonths}
                            placeholder="Select Month"
                            maintainOrder={true}
                        />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5">
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
                        {(selectedStatuses.length > 0 || selectedOffices.length > 0 || selectedBizPocs.length > 0 || selectedFYs.length > 0 || selectedMonths.length > 0 || selectedRegions.length > 0 || selectedTerritories.length > 0 || showUnapprovedOnly || timelineFilter !== 'all') && (
                            <Button variant="ghost" onClick={clearFilters} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20">
                                <X size={18} className="mr-2" /> Clear Filters
                            </Button>
                        )}
                        <Button
                            variant={showUnapprovedOnly ? "danger" : "secondary"}
                            onClick={() => setShowUnapprovedOnly(prev => !prev)}
                            className={showUnapprovedOnly ? "border border-red-500/50" : ""}
                        >
                            Recent Changes
                        </Button>
                        {!isExecutive && (
                            <Button
                                onClick={() => navigate('/new-project')}
                                disabled={!user?.isAdmin}
                                variant={user?.isAdmin ? "primary" : "secondary"}
                                className={user?.isAdmin ? "shadow-lg shadow-primary/20" : "opacity-60"}
                            >
                                <Plus size={18} /> New Project
                            </Button>
                        )}
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel rounded-2xl overflow-hidden"
                >
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar relative">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-dark-800 text-gray-400 font-medium uppercase tracking-wider text-[10px] border-b border-white/10 sticky top-0 z-40 shadow-lg">
                                <tr>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800 sticky left-0 z-50 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.5)]" onClick={() => handleSort('Project Name')}>
                                        <div className="flex items-center justify-center gap-1">Project Name {getSortIcon('Project Name')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Client')}>
                                        <div className="flex items-center justify-center gap-1">Client {getSortIcon('Client')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('deal_stage')}>
                                        <div className="flex items-center justify-center gap-1">Deal Stage {getSortIcon('deal_stage')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Block_Stage')}>
                                        <div className="flex items-center justify-center gap-1">Block Stage {getSortIcon('Block_Stage')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Region Type')}>
                                        <div className="flex items-center justify-center gap-1">Region {getSortIcon('Region Type')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Office')}>
                                        <div className="flex items-center justify-center gap-1">Office {getSortIcon('Office')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Biz Poc')}>
                                        <div className="flex items-center justify-center gap-1">Biz Poc {getSortIcon('Biz Poc')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Value in Home Currency')}>
                                        <div className="flex items-center justify-center gap-1">Home Amount {getSortIcon('Value in Home Currency')}</div>
                                    </th>
                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Amount in USD')}>
                                        <div className="flex items-center justify-center gap-1">Amount ({displayCurrency}) {getSortIcon('Amount in USD')}</div>
                                    </th>

                                    <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800/80 text-blue-300" onClick={() => handleSort('Q1')}>
                                        <div className="flex items-center justify-center gap-1">{selectedFYDisplay} Q1 {getSortIcon('Q1')}</div>
                                    </th>
                                    <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800/80 text-blue-300" onClick={() => handleSort('Q2')}>
                                        <div className="flex items-center justify-center gap-1">{selectedFYDisplay} Q2 {getSortIcon('Q2')}</div>
                                    </th>
                                    <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800/80 text-blue-300" onClick={() => handleSort('Q3')}>
                                        <div className="flex items-center justify-center gap-1">{selectedFYDisplay} Q3 {getSortIcon('Q3')}</div>
                                    </th>
                                    <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800/80 text-blue-300" onClick={() => handleSort('Q4')}>
                                        <div className="flex items-center justify-center gap-1">{selectedFYDisplay} Q4 {getSortIcon('Q4')}</div>
                                    </th>
                                    <th className="px-2 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800/80 text-purple-300" onClick={() => handleSort('Total')}>
                                        <div className="flex items-center justify-center gap-1">Total Proj {getSortIcon('Total')}</div>
                                    </th>

                                    <th className="px-3 py-3 cursor-pointer hover:text-white transition-colors text-center bg-dark-800" onClick={() => handleSort('Close Date')}>
                                        <div className="flex items-center justify-center gap-1">Close Date {getSortIcon('Close Date')}</div>
                                    </th>
                                    <th className="px-3 py-3 text-center bg-dark-800">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan="16" className="text-center py-12 text-gray-500">Loading data...</td></tr>
                                ) : sortedProjects.length === 0 ? (
                                    <tr><td colSpan="16" className="text-center py-12 text-gray-500">No projects found</td></tr>
                                ) : (
                                    sortedProjects.map((p, i) => {
                                        const hasUnapprovedChanges = hasUnapprovedProjectionChanges(p);
                                        return (
                                        <motion.tr
                                            key={p['Project ID'] || i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className={`transition-colors text-xs ${hasUnapprovedChanges ? 'bg-red-500/10 border-y border-red-500/20 hover:bg-red-500/15' : 'hover:bg-white/5'}`}
                                        >
                                            <td className={`px-3 py-3 font-medium text-white text-center sticky left-0 z-30 border-r border-white/5 transition-colors shadow-[4px_0_24px_rgba(0,0,0,0.5)] ${hasUnapprovedChanges ? 'bg-[#2b1116] hover:bg-[#36161d]' : 'bg-dark-900 hover:bg-[#1a1a1a]'}`}>
                                                {renderProjectName(p)}
                                            </td>
                                            <td className="px-3 py-3 text-gray-300 text-center">{p['Client']}</td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex flex-col gap-1 items-center">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(p['deal_stage'] || p['Project Status'])}`}>
                                                        {p['deal_stage'] || p['Project Status']}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex flex-col gap-1 items-center">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(p['Block_Stage'])}`}>
                                                        {p['Block_Stage'] || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-gray-300 text-center">{p['Region Type']}</td>
                                            <td className="px-3 py-3 text-gray-300 text-center">{p['Office']}</td>
                                            <td className="px-3 py-3 text-gray-300 text-center">{p['Biz Poc']}</td>
                                            <td className="px-3 py-3 text-gray-300 text-center font-medium">
                                                {p['Home Currency'] || p['Currency'] || ''} {p['Value in Home Currency'] ? Number(p['Value in Home Currency']).toLocaleString('en-US') : '-'}
                                            </td>
                                            <td className="px-3 py-3 text-gray-300 text-center">{p['Amount in USD'] ? formatDisplayAmount(p['Amount in USD']) : '-'}</td>

                                            {/* Quarterly Data */}
                                            <td className="px-2 py-3 text-blue-300 text-center">{formatDisplayAmount(p.Q1 || 0)}</td>
                                            <td className="px-2 py-3 text-blue-300 text-center">{formatDisplayAmount(p.Q2 || 0)}</td>
                                            <td className="px-2 py-3 text-blue-300 text-center">{formatDisplayAmount(p.Q3 || 0)}</td>
                                            <td className="px-2 py-3 text-blue-300 text-center">{formatDisplayAmount(p.Q4 || 0)}</td>
                                            <td className="px-2 py-3 text-purple-300 font-medium text-center">{formatDisplayAmount(p.Total || 0)}</td>

                                            <td className="px-3 py-3 text-gray-400 text-center">{p['Close Date'] || '-'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => navigate(`/modify-project/${p['Project ID']}`, { state: { projectData: { project: p, projections: p.projections || [] }, isReadOnly: isExecutive } })}
                                                    className="text-gray-500 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
                                                >
                                                    {isExecutive ? <Eye size={14} /> : <Edit2 size={14} />}
                                                </Button>
                                            </td>
                                        </motion.tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
