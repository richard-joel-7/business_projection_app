import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { MultiSelect } from "../components/ui/MultiSelect";
import ProjectModal from "../components/ProjectModal";
import ClientTypeModal from "../components/ClientTypeModal";
import api from "../lib/api";
import { Plus, LogOut, Search, Download, Edit2, AlertTriangle, ArrowLeft, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, Eye, Filter, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ViewClientModal from "../components/ViewClientModal";

const logo = "https://lh3.googleusercontent.com/d/14iG9g-t8-yqSgXzXQ8uI4YjX3zZ9jZ9j"; // Placeholder

export default function ClientCodePage() {
    const { user, logout } = useAuth();
    const { clients: allProjects, loadingClients: loading, fetchClients } = useData();
    const navigate = useNavigate();
    
    const userRoles = String(user?.role || "").split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
    const showHubBack = user?.isAdmin || userRoles.length > 1 || userRoles.includes("executive");
    const isExecutive = userRoles.includes("executive") && !user?.isAdmin;

    // State
    const [projects, setProjects] = useState([]);
    // allProjects is now from context
    const [clientTypeModalOpen, setClientTypeModalOpen] = useState(false);
    const [projectModalMode, setProjectModalMode] = useState('new');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewProject, setViewProject] = useState(null);
    const [search, setSearch] = useState("");
    const [searchField, setSearchField] = useState("client_name");
    
    // Filters - Arrays for MultiSelect
    const [filterBrand, setFilterBrand] = useState([]);
    const [filterRegion, setFilterRegion] = useState(null); // Keep as single select card for now or convert? User said resize card.
    const [filterCreationMode, setFilterCreationMode] = useState(null); // Keep as card
    const [filterSource, setFilterSource] = useState([]);
    const [filterYear, setFilterYear] = useState([]);
    const [filterCountry, setFilterCountry] = useState([]);
    const [filterStatus, setFilterStatus] = useState([]);
    const [filterReferrals, setFilterReferrals] = useState(false);
    
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

    const [error, setError] = useState("");

    // Table Scroll Logic
    const tableContainerRef = useRef(null);
    const [showTableScrollTop, setShowTableScrollTop] = useState(false);

    useEffect(() => {
        const container = tableContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (container.scrollTop > 200) {
                setShowTableScrollTop(true);
            } else {
                setShowTableScrollTop(false);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTableTop = () => {
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

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
        let data = [...projects];
        if (sortConfig.direction !== 'default' && sortConfig.key) {
            data.sort((a, b) => {
                let aValue = '';
                let bValue = '';

                // Handle specific keys that might have different casings from Google Sheets
                if (sortConfig.key === 'year') {
                    aValue = String(a.year || a.Year || '').trim();
                    bValue = String(b.year || b.Year || '').trim();
                } else if (sortConfig.key === 'status') {
                    aValue = String(a.status || a.Status || '').trim();
                    bValue = String(b.status || b.Status || '').trim();
                } else if (sortConfig.key === 'client_location') {
                    aValue = String(a.client_location || a.territory || a['client location'] || '').trim();
                    bValue = String(b.client_location || b.territory || b['client location'] || '').trim();
                } else if (sortConfig.key === 'referral') {
                    aValue = String(a.referral || a.Referral || '').toLowerCase() === 'true' || a.referral === true || a.Referral === true ? '1' : '0';
                    bValue = String(b.referral || b.Referral || '').toLowerCase() === 'true' || b.referral === true || b.Referral === true ? '1' : '0';
                } else {
                    aValue = String(a[sortConfig.key] || '').trim();
                    bValue = String(b[sortConfig.key] || '').trim();
                }

                // Always push empty values to the bottom, regardless of sort direction
                const aEmpty = !aValue;
                const bEmpty = !bValue;
                if (aEmpty && !bEmpty) return 1;
                if (!aEmpty && bEmpty) return -1;
                if (aEmpty && bEmpty) return 0;

                // Handle numeric sorting for Year
                if (sortConfig.key === 'year') {
                    const aNum = parseInt(aValue, 10);
                    const bNum = parseInt(bValue, 10);
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
                    }
                }

                // Default string sorting
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [projects, sortConfig]);

    const [logoSrc, setLogoSrc] = useState("pixoo-black-logo.png");

    // Initial Fetch
    useEffect(() => {
        // fetchProjects(); // Removed as per user request
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
    }, []);



    // Refresh on page focus removed

    // Apply Filters
    useEffect(() => {
        applyFilters();
    }, [search, filterBrand, filterRegion, filterCreationMode, filterSource, filterYear, filterCountry, filterStatus, filterReferrals, allProjects]);

    useEffect(() => {
        fetchClients();
    }, []);

    const applyFilters = () => {
        let filtered = [...(allProjects || [])];

        if (search) {
            const lowerSearch = search.toLowerCase();
            filtered = filtered.filter(p => {
                if (!p) return false;

                let fieldValue = "";
                switch (searchField) {
                    case "client_name":
                        fieldValue = p.client_name;
                        break;
                    case "client_code":
                        fieldValue = p.client_code;
                        break;
                    case "project_name":
                        fieldValue = p.project_name;
                        break;
                    case "show_code":
                        fieldValue = p.show_code;
                        break;
                    default:
                        fieldValue = p.client_name;
                }

                return fieldValue && typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(lowerSearch);
            });
        }
        
        // Single Select Filters (Legacy Cards)
        if (filterRegion) filtered = filtered.filter(p => p && String(p.region || '').trim().toLowerCase() === String(filterRegion).trim().toLowerCase());
        if (filterCreationMode) {
            filtered = filtered.filter(p => p && String(p.repetition || '').trim().toLowerCase() === String(filterCreationMode).trim().toLowerCase());
        }
        if (filterReferrals) {
            filtered = filtered.filter(p => p && (String(p.referral || p.Referral).toLowerCase() === 'true' || p.referral === true || p.Referral === true));
        }

        // Multi Select Filters
        if (filterSource.length > 0) filtered = filtered.filter(p => p && filterSource.includes(p.source));
        if (filterYear.length > 0) filtered = filtered.filter(p => p && filterYear.includes(String(p.year || p.Year)));
        if (filterCountry.length > 0) filtered = filtered.filter(p => p && filterCountry.includes(p.country));
        if (filterStatus.length > 0) filtered = filtered.filter(p => p && filterStatus.includes(p.status || p.Status || 'Unknown'));
        if (filterBrand.length > 0) filtered = filtered.filter(p => p && filterBrand.includes(p.brand));

        setProjects(filtered);
    };

    // Helper to calculate dynamic options with counts
    const getFilterOptions = (key, currentValues) => {
        if (!allProjects) return [];

        // Create a base filter set excluding the current key
        // We want to see counts of options *given the other filters*
        const otherFiltersMatches = (p) => {
             if (search) {
                const lowerSearch = search.toLowerCase();
                let fieldValue = "";
                switch (searchField) {
                    case "client_name": fieldValue = p.client_name; break;
                    case "client_code": fieldValue = p.client_code; break;
                    case "project_name": fieldValue = p.project_name; break;
                    case "show_code": fieldValue = p.show_code; break;
                    default: fieldValue = p.client_name;
                }
                if (!fieldValue || typeof fieldValue !== 'string' || !fieldValue.toLowerCase().includes(lowerSearch)) return false;
            }

            if (filterRegion && p.region !== filterRegion) return false;
            
            if (filterCreationMode) {
                if (String(p.repetition || '').trim().toLowerCase() !== String(filterCreationMode).trim().toLowerCase()) return false;
            }
            if (filterReferrals) {
                if (!(String(p.referral || p.Referral).toLowerCase() === 'true' || p.referral === true || p.Referral === true)) return false;
            }
            
            // Check other multi-selects
            if (key !== 'source' && filterSource.length > 0 && !filterSource.includes(p.source)) return false;
            if (key !== 'year' && filterYear.length > 0 && !filterYear.includes(String(p.year || p.Year))) return false;
            if (key !== 'country' && filterCountry.length > 0 && !filterCountry.includes(p.country)) return false;
            if (key !== 'status' && filterStatus.length > 0 && !filterStatus.includes(p.status || p.Status || 'Unknown')) return false;
            if (key !== 'brand' && filterBrand.length > 0 && !filterBrand.includes(p.brand)) return false;

            return true;
        };

        const relevantProjects = allProjects.filter(p => p && otherFiltersMatches(p));
        
        // Count occurrences
        const counts = {};
        relevantProjects.forEach(p => {
            let val = String(p[key] || 'Unknown'); // Handle null/undefined
            if (key === 'year') val = String(p.year || p.Year || 'Unknown');
            if (key === 'status') val = String(p.status || p.Status || 'Unknown');
            counts[val] = (counts[val] || 0) + 1;
        });

        // Get unique values only from RELEVANT projects (Dynamic filtering)
        const relevantValues = new Set(relevantProjects.map(p => {
            if (key === 'year') return String(p.year || p.Year || 'Unknown');
            if (key === 'status') return String(p.status || p.Status || 'Unknown');
            return String(p[key] || 'Unknown');
        }));
        
        return Array.from(relevantValues).map(val => {
            const count = counts[val] || 0;
            return {
                value: val,
                label: `${val} (${count})`
            };
        }).sort((a, b) => {
             return a.value.localeCompare(b.value);
        });
    };
    
    // Memoize options to prevent recalc on every render
    const sourceOptions = useMemo(() => getFilterOptions('source', filterSource), [allProjects, search, filterRegion, filterCreationMode, filterYear, filterCountry, filterStatus, filterBrand, filterReferrals]);
    const yearOptions = useMemo(() => getFilterOptions('year', filterYear), [allProjects, search, filterRegion, filterCreationMode, filterSource, filterCountry, filterStatus, filterBrand, filterReferrals]);
    const countryOptions = useMemo(() => getFilterOptions('country', filterCountry), [allProjects, search, filterRegion, filterCreationMode, filterSource, filterYear, filterStatus, filterBrand, filterReferrals]);
    const statusOptions = useMemo(() => getFilterOptions('status', filterStatus), [allProjects, search, filterRegion, filterCreationMode, filterSource, filterYear, filterCountry, filterBrand, filterReferrals]);
    const brandOptions = useMemo(() => getFilterOptions('brand', filterBrand), [allProjects, search, filterRegion, filterCreationMode, filterSource, filterYear, filterCountry, filterStatus, filterReferrals]);


    const handleSave = async (projectData) => {
        try {
            // STEP 1: Save client data to Clients sheet (Consolidated)
            const clientPayload = {
                client_code: projectData.client_code,
                client_name: projectData.client_name,
                show_code: projectData.show_code,
                project_name: projectData.project_name,
                brand: projectData.brand,
                region: projectData.region,
                client_location: projectData.client_location || projectData.territory, // Handle rename
                territory: projectData.client_location || projectData.territory, // Keep legacy for safety
                misc_info: String(projectData.misc_info) === '00' ? "'00" : projectData.misc_info,
                country: projectData.country,
                currency: projectData.currency,
                source: projectData.source,
                is_referral: projectData.is_referral, // Capture referral state
                year: projectData.year,
                status: projectData.status,
                additional_notes: projectData.additional_notes,
                // Merged fields from Client Code Projects
                client_contact_mail: projectData.client_contact_mail,
                finance_contact_mail: projectData.finance_contact_mail,
                Address: projectData.Address,
                // Pass original identifiers for updates
                original_client_code: editingProject ? editingProject.client_code : null,
                original_show_code: editingProject ? editingProject.show_code : null
            };
            await api.saveClient(clientPayload);

            // STEP 2: Client Code Projects sheet save removed (Data consolidated into Clients sheet)

            fetchClients(true); // Force refresh
            setIsModalOpen(false);
            setEditingProject(null);
        } catch (err) {
            console.error("Failed to save project", err);
            throw err;
        }
    };

    const handleCreate = () => {
        setClientTypeModalOpen(true);
    };

    const handleClientTypeSelect = (mode) => {
        setClientTypeModalOpen(false);
        setProjectModalMode(mode);
        setEditingProject(null);
        setIsModalOpen(true);
    };

    const handleEdit = (project) => {
        setProjectModalMode('existing');
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const handleView = (project) => {
        setViewProject(project);
        setViewModalOpen(true);
    };

    const handleExport = () => {
        const processedData = projects; // Use the currently filtered/sorted projects for export

        if (!processedData.length) return;

        const headers = [
            "Client Name", "Client Code", "Show Code", "Project Name",
            "Region", "Client Location", "Country", "Brand", "Currency", "Source",
            "Year", "Status",
            "Client Contact Email", "Finance Contact Email", "Address",
            "Creation Mode", "Misc Info"
        ];

        const csvContent = [
            headers.join(","),
            ...processedData.map(row => [
                `"${row.client_name || ''}"`,
                `"${row.client_code || ''}"`,
                `"${row.show_code || ''}"`,
                `"${row.project_name || ''}"`,
                `"${row.region || ''}"`,
                `"${row.client_location || row.territory || row['client location'] || ''}"`,
                `"${row.country || ''}"`,
                `"${row.brand || ''}"`,
                `"${row.currency || ''}"`,
                `"${row.source || ''}"`,
                `"${row.year || row.Year || ''}"`,
                `"${row.status || row.Status || ''}"`,
                `"${row.client_contact_mail || ''}"`,
                `"${row.finance_contact_mail || ''}"`,
                `"${row.Address || ''}"`,
                `"${row.repetition || ''}"`,
                `"${row.misc_info || ''}"`
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `client_codes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getFilteredCount = (field, value) => {
        if (!allProjects) return 0;
        return allProjects.filter(p => {
            if (!p) return false;

            if (search) {
                const lowerSearch = search.toLowerCase();
                let fieldValue = "";
                switch (searchField) {
                    case "client_name": fieldValue = p.client_name; break;
                    case "client_code": fieldValue = p.client_code; break;
                    case "project_name": fieldValue = p.project_name; break;
                    case "show_code": fieldValue = p.show_code; break;
                    default: fieldValue = p.client_name;
                }

                if (!fieldValue || typeof fieldValue !== 'string' || !fieldValue.toLowerCase().includes(lowerSearch)) return false;
            }

            // Case insensitive trimming for safety
            if (field !== 'brand' && filterBrand.length > 0 && !filterBrand.some(b => String(b).trim().toLowerCase() === String(p.brand || '').trim().toLowerCase())) return false;
            if (field !== 'region' && filterRegion && String(p.region || '').trim().toLowerCase() !== String(filterRegion).trim().toLowerCase()) return false;
            if (field !== 'repetition' && filterCreationMode && String(p.repetition || '').trim().toLowerCase() !== String(filterCreationMode).trim().toLowerCase()) return false;
            if (filterReferrals && !(String(p.referral || p.Referral).toLowerCase() === 'true' || p.referral === true || p.Referral === true)) return false;
            if (field !== 'source' && filterSource.length > 0 && !filterSource.includes(p.source)) return false;
            if (field !== 'year' && filterYear.length > 0 && !filterYear.includes(String(p.year || p.Year))) return false;
            if (field !== 'country' && filterCountry.length > 0 && !filterCountry.includes(p.country)) return false;
            if (field !== 'status' && filterStatus.length > 0 && !filterStatus.includes(p.status || p.Status || 'Unknown')) return false;

            if (field === 'year') {
                 if (String(p[field] || p.Year) !== String(value)) return false;
            } else if (field === 'status') {
                 if (String(p[field] || p.Status || 'Unknown').trim().toLowerCase() !== String(value).trim().toLowerCase()) return false;
            } else if (typeof p[field] === 'string' && typeof value === 'string') {
                 if (p[field].trim().toLowerCase() !== value.trim().toLowerCase()) return false;
            } else {
                 if (p[field] !== value) return false;
            }

            return true;
        }).length;
    };

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
                                <span className="text-white">Client </span>
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
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        {error}
                    </motion.div>
                )}

                {/* Top Row: Metrics & Key Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    {/* Card 1: Total Projects */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-emerald-500/20"></div>
                        <h3 className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wider">Total Projects</h3>
                        <div className="text-3xl font-bold text-white">{(projects || []).length}</div>
                    </motion.div>

                    {/* Card 2: Total Clients */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-primary/30"></div>
                        <h3 className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wider">Total Clients</h3>
                        <div className="text-3xl font-bold text-white">{new Set((projects || []).filter(p => p && p.client_name).map(p => p.client_name)).size}</div>
                    </motion.div>

                    {/* Card 3: Status Filter (Buttons) */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-8 h-8 bg-green-500/10 rounded-bl-xl -mr-2 -mt-2 transition-all group-hover:bg-green-500/20"></div>
                         <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider relative z-10">Status</h3>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar relative z-10">
                            {statusOptions.map(option => {
                                const isSelected = filterStatus.includes(option.value);
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            const newStatus = isSelected 
                                                ? filterStatus.filter(s => s !== option.value)
                                                : [...filterStatus, option.value];
                                            setFilterStatus(newStatus);
                                        }}
                                        className={`text-[10px] px-2 py-0.5 rounded border transition-all ${isSelected
                                            ? "bg-green-500 text-white border-green-500 font-bold"
                                            : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                            }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Card 4: Region Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/10 rounded-bl-xl -mr-2 -mt-2 transition-all group-hover:bg-blue-500/20"></div>
                         <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider relative z-10">Region</h3>
                        <div className="flex flex-wrap gap-1.5 relative z-10">
                            {['International', 'Domestic'].map(region => {
                                const count = getFilteredCount('region', region);
                                return (
                                    <button
                                        key={region}
                                        onClick={() => setFilterRegion(filterRegion === region ? null : region)}
                                        className={`text-[10px] px-2 py-0.5 rounded border transition-all ${filterRegion === region
                                            ? "bg-blue-500 text-white border-blue-500 font-bold"
                                            : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                            }`}
                                    >
                                        {region}: {count}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Card 5: Project From Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-orange-500/10 rounded-bl-xl -mr-2 -mt-2 transition-all group-hover:bg-orange-500/20"></div>
                        <h3 className="text-gray-400 text-[10px] font-medium mb-2 uppercase tracking-wider relative z-10">Project From</h3>
                        <div className="flex flex-wrap gap-1.5 relative z-10">
                            {[
                                { label: 'New Client', value: 'New' },
                                { label: 'Repeat Client', value: 'Existing' }
                            ].map(option => {
                                let count = getFilteredCount('repetition', option.value);
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setFilterCreationMode(filterCreationMode === option.value ? null : option.value)}
                                        className={`text-[10px] px-2 py-0.5 rounded border transition-all ${filterCreationMode === option.value
                                            ? "bg-orange-500 text-white border-orange-500 font-bold"
                                            : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                            }`}
                                    >
                                        {option.label}: {count}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>

                {/* Row 2: Detailed Filters (Individual Cards) */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8 relative z-50"
                >
                    {/* Source */}
                    <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative group z-40">
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/10 rounded-bl-xl -mr-2 -mt-2 transition-all group-hover:bg-blue-500/20"></div>
                        </div>
                        <MultiSelect
                            label="Source"
                            options={sourceOptions}
                            value={filterSource}
                            onChange={setFilterSource}
                            placeholder="Select Source"
                        />
                    </div>

                    {/* Year */}
                    <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative group z-30">
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 right-0 w-8 h-8 bg-purple-500/10 rounded-bl-xl -mr-2 -mt-2 transition-all group-hover:bg-purple-500/20"></div>
                        </div>
                        <MultiSelect
                            label="Year"
                            options={yearOptions}
                            value={filterYear}
                            onChange={setFilterYear}
                            placeholder="Select Year"
                        />
                    </div>

                    {/* Country */}
                    <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative group z-20">
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 right-0 w-8 h-8 bg-orange-500/10 rounded-bl-xl -mr-2 -mt-2 transition-all group-hover:bg-orange-500/20"></div>
                        </div>
                        <MultiSelect
                            label="Country"
                            options={countryOptions}
                            value={filterCountry}
                            onChange={setFilterCountry}
                            placeholder="Select Country"
                        />
                    </div>

                    {/* Brands */}
                    <div className="glass-panel p-3 rounded-xl border border-white/10 bg-white/5 relative group z-10">
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                            <div className="absolute top-0 right-0 w-8 h-8 bg-pink-500/10 rounded-bl-xl -mr-2 -mt-2 transition-all group-hover:bg-pink-500/20"></div>
                        </div>
                        <MultiSelect
                            label="Brands"
                            options={brandOptions}
                            value={filterBrand}
                            onChange={setFilterBrand}
                            placeholder="Select Brand"
                        />
                    </div>
                </motion.div>

                {/* Actions Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        <div className="w-full md:w-48">
                            <Select
                                options={[
                                    { value: "client_name", label: "Client Name" },
                                    { value: "client_code", label: "Client Code" },
                                    { value: "project_name", label: "Project Name" },
                                    { value: "show_code", label: "Show Code" }
                                ]}
                                value={searchField}
                                onChange={(e) => setSearchField(e.target.value)}
                                placeholder="Search Field"
                            />
                        </div>
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search..."
                                className="pl-12 bg-dark-800/50 border-white/5 focus:bg-dark-800 w-full"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto items-center">
                        <button
                            onClick={() => setFilterReferrals(!filterReferrals)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all backdrop-blur-md shadow-lg ${
                                filterReferrals 
                                    ? "bg-green-500/20 text-green-400 border-green-500/50 shadow-green-500/10" 
                                    : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                            <span className="text-sm font-medium">Referral Projects</span>
                        </button>
                        <Button variant="secondary" onClick={handleExport} className="shadow-none bg-dark-800 hover:bg-dark-700 border-white/5">
                            <Download size={18} /> Export
                        </Button>
                        {!isExecutive && (
                            <Button onClick={handleCreate} className="shadow-lg shadow-primary/20">
                                <Plus size={18} /> New Project
                            </Button>
                        )}
                        {(filterSource.length > 0 || filterYear.length > 0 || filterCountry.length > 0 || filterStatus.length > 0 || filterBrand.length > 0 || filterRegion || filterCreationMode || filterReferrals) && (
                            <button 
                                onClick={() => {
                                    setFilterSource([]);
                                    setFilterYear([]);
                                    setFilterCountry([]);
                                    setFilterStatus([]);
                                    setFilterBrand([]);
                                    setFilterRegion(null);
                                    setFilterCreationMode(null);
                                    setFilterReferrals(false);
                                }}
                                className="text-[10px] flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20 backdrop-blur-sm shadow-lg ml-2"
                            >
                                <X size={12} /> Clear All Filters
                            </button>
                        )}
                    </div>

                </div>


                {/* Projects Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-panel rounded-2xl overflow-hidden relative"
                >
                    {/* Table Scroll To Top Button */}
                    <AnimatePresence>
                        {showTableScrollTop && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                onClick={scrollToTableTop}
                                className="absolute bottom-6 right-6 p-2 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-full shadow-lg hover:bg-primary/30 transition-colors z-50 group"
                            >
                                <ArrowLeft className="w-5 h-5 text-primary group-hover:scale-110 transition-transform rotate-90" />
                            </motion.button>
                        )}
                    </AnimatePresence>

                    <div
                        ref={tableContainerRef}
                        className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar"
                    >
                        <table className="w-full text-sm text-left relative border-collapse">
                            <thead className="bg-[#0A0A0A] text-gray-400 font-medium uppercase tracking-wider text-xs border-b border-white/10 sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th onClick={() => handleSort('client_code')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] sticky left-0 z-30 cursor-pointer hover:bg-white/5 transition-colors border-r border-white/10 shadow-[2px_0_5px_rgba(0,0,0,0.5)] min-w-[140px]">
                                        <div className="flex items-center gap-2">
                                            Client Code
                                            {sortConfig.key === 'client_code' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('client_name')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors min-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            Client Name
                                            {sortConfig.key === 'client_name' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('region')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Region
                                            {sortConfig.key === 'region' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('client_location')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Client Location
                                            {sortConfig.key === 'client_location' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('year')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Year
                                            {sortConfig.key === 'year' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('country')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Country
                                            {sortConfig.key === 'country' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('currency')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Currency
                                            {sortConfig.key === 'currency' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('show_code')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Show Code
                                            {sortConfig.key === 'show_code' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('status')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Status
                                            {sortConfig.key === 'status' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('project_name')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Project Name
                                            {sortConfig.key === 'project_name' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('source')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Source
                                            {sortConfig.key === 'source' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('brand')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">

                                        <div className="flex items-center gap-2">
                                            Brand
                                            {sortConfig.key === 'brand' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('referral')} className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] cursor-pointer hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            Referral
                                            {sortConfig.key === 'referral' ? (
                                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />
                                            ) : (
                                                <ArrowUpDown size={14} className="text-gray-600 opacity-50" />
                                            )}
                                        </div>
                                    </th>

                                    <th className="px-6 py-5 text-right whitespace-nowrap bg-[#0A0A0A]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan="13" className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex justify-center items-center gap-3">
                                                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                                                Loading clients...
                                            </div>
                                        </td>
                                    </tr>
                                ) : projects.length === 0 ? (
                                    <tr>
                                        <td colSpan="13" className="px-6 py-12 text-center text-gray-500">
                                            No clients found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedProjects.map((project, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 font-medium text-white whitespace-nowrap sticky left-0 z-10 bg-[#0A0A0A] border-r border-white/10 shadow-[2px_0_5px_rgba(0,0,0,0.5)] min-w-[140px]">{project.client_code}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap min-w-[200px]">{project.client_name}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{project.region}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{project.client_location || project.territory || project['client location']}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{project.year || project.Year}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{project.country}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{project.currency}</td>
                                            <td className="px-6 py-4 font-mono text-primary/80 whitespace-nowrap">{project.show_code}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded text-xs border ${project.status === 'Awarded' || project.Status === 'Awarded' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                    project.status === 'Lost' || project.Status === 'Lost' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                    }`}>
                                                    {project.status || project.Status || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{project.project_name}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{project.source}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded text-xs border ${project.brand === 'PFX' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    project.brand === 'TIPPETT' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                    }`}>
                                                    {project.brand}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {(String(project.referral || project.Referral).toLowerCase() === 'true' || project.referral === true || project.Referral === true) && (
                                                    <span className="px-2 py-1 rounded text-xs border bg-green-500/10 text-green-400 border-green-500/20">
                                                        Referral
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleView(project)}
                                                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                        title="View"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    {!isExecutive && (
                                                        <button
                                                            onClick={() => handleEdit(project)}
                                                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

            </main>

            <ProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                project={editingProject}
                onSave={handleSave}
                mode={projectModalMode}
            />

            <ClientTypeModal
                isOpen={clientTypeModalOpen}
                onClose={() => setClientTypeModalOpen(false)}
                onSelect={handleClientTypeSelect}
            />

            <ViewClientModal
                isOpen={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                project={viewProject}
            />
        </div >
    );
}
