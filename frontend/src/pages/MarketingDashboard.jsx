import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import ProjectModal from "../components/ProjectModal";
import ClientTypeModal from "../components/ClientTypeModal";
import api from "../lib/api";
import { Plus, LogOut, Search, Download, Edit2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const logo = "/pixoo-black-logo.png";

export default function MarketingDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // State
    const [projects, setProjects] = useState([]);
    const [allProjects, setAllProjects] = useState([]); // Store all projects for KPIs
    const [clientTypeModalOpen, setClientTypeModalOpen] = useState(false);
    const [projectModalMode, setProjectModalMode] = useState('new');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [search, setSearch] = useState("");
    const [searchField, setSearchField] = useState("client_name");
    const [filterBrand, setFilterBrand] = useState(null);
    const [filterRegion, setFilterRegion] = useState(null);
    const [filterCreationMode, setFilterCreationMode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Initial Fetch
    useEffect(() => {
        fetchProjects();
    }, []);

    // Apply Filters
    useEffect(() => {
        applyFilters();
    }, [search, filterBrand, filterRegion, filterCreationMode, allProjects]);

    const fetchProjects = async () => {
        try {
            setError("");
            setLoading(true);
            const res = await api.get("/marketing/projects");
            if (Array.isArray(res.data)) {
                setAllProjects(res.data);
                setProjects(res.data); // Initially, filtered list is same as all
            } else {
                setAllProjects([]);
                setProjects([]);
                console.error("API returned non-array data:", res.data);
            }
        } catch (err) {
            console.error("Failed to fetch projects", err);
            setError("Failed to load projects. Please try again.");
            setAllProjects([]);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...allProjects];

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
        if (filterBrand) filtered = filtered.filter(p => p && p.brand === filterBrand);
        if (filterRegion) filtered = filtered.filter(p => p && p.region === filterRegion);
        if (filterCreationMode) filtered = filtered.filter(p => p && p.creation_mode === filterCreationMode);

        setProjects(filtered);
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const handleSave = async (projectData) => {
        try {
            if (editingProject) {
                await api.put(`/marketing/projects/${editingProject.master_id}`, projectData);
            } else {
                await api.post("/marketing/projects", projectData);
            }
            fetchProjects(); // Re-fetch to get updated list
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
        setProjectModalMode('existing'); // Editing is always effectively 'existing' context
        setEditingProject(project);
        setIsModalOpen(true);
    };

    const handleExport = async () => {
        try {
            const response = await api.get("/marketing/projects/export", {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'projects.csv');
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            console.error("Export failed", err);
        }
    };

    // Helper to calculate counts for filter buttons (Faceted Search Logic)
    // Calculates how many results would exist if we selected a specific filter value,
    // respecting all OTHER currently active filters.
    const getFilteredCount = (field, value) => {
        if (!allProjects) return 0;
        return allProjects.filter(p => {
            if (!p) return false; // Safety check

            // 1. Search Filter
            if (search) {
                const lowerSearch = search.toLowerCase();
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

                if (!fieldValue || typeof fieldValue !== 'string' || !fieldValue.toLowerCase().includes(lowerSearch)) return false;
            }

            // 2. Apply all OTHER filters (skip the field we are currently counting for)
            if (field !== 'brand' && filterBrand && p.brand !== filterBrand) return false;
            if (field !== 'region' && filterRegion && p.region !== filterRegion) return false;
            if (field !== 'creation_mode' && filterCreationMode && p.creation_mode !== filterCreationMode) return false;

            // 3. Match the specific value for the field we are counting
            if (p[field] !== value) return false;

            return true;
        }).length;
    };

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-primary/30">
            {/* Top Bar */}
            <header className="border-b border-white/10 bg-dark-800/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto md:h-16 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                                <img src={logo} alt="PhantomFX" className="h-6" />
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Marketing <span className="text-primary">Hub</span>
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
                            <span className="text-xs font-medium text-gray-300">Welcome, <span className="text-white font-bold">{user?.username}</span></span>
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

                {/* Stats / Hero Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
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

                    {/* Card 3: Region Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-blue-500/20"></div>
                        <h3 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Region</h3>
                        <div className="flex flex-wrap gap-2">
                            {['International', 'Domestic'].map(region => {
                                const count = getFilteredCount('region', region);
                                return (
                                    <button
                                        key={region}
                                        onClick={() => setFilterRegion(filterRegion === region ? null : region)}
                                        className={`text-[10px] px-2 py-1 rounded border transition-all ${filterRegion === region
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

                    {/* Card 4: Project From Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-orange-500/20"></div>
                        <h3 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Project From</h3>
                        <div className="flex flex-wrap gap-2">
                            {['New Client', 'Existing Client'].map(mode => {
                                const count = getFilteredCount('creation_mode', mode);
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => setFilterCreationMode(filterCreationMode === mode ? null : mode)}
                                        className={`text-[10px] px-2 py-1 rounded border transition-all ${filterCreationMode === mode
                                            ? "bg-orange-500 text-white border-orange-500 font-bold"
                                            : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                            }`}
                                    >
                                        {mode}: {count}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Card 5: Brands Filter */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:bg-purple-500/20"></div>
                        <h3 className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Brands</h3>
                        <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto custom-scrollbar">
                            {/* Get unique brands from ALL projects, but count based on current filters */}
                            {Array.from(new Set((allProjects || []).filter(p => p).map(p => p.brand || "Unknown"))).map(brand => {
                                const count = getFilteredCount('brand', brand);
                                // Only show brands that have at least 1 match in the current context (or are selected)
                                if (count === 0 && filterBrand !== brand) return null;

                                return (
                                    <button
                                        key={brand}
                                        onClick={() => setFilterBrand(brand === filterBrand ? null : brand)}
                                        className={`text-[10px] px-2 py-1 rounded border transition-all ${filterBrand === brand
                                            ? "bg-purple-500 text-white border-purple-500 font-bold"
                                            : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                                            }`}
                                    >
                                        {brand}: {count}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>

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
                    <div className="flex gap-3 w-full md:w-auto">
                        <Button variant="secondary" onClick={handleExport} className="shadow-none bg-dark-800 hover:bg-dark-700 border-white/5">
                            <Download size={18} /> Export
                        </Button>
                        <Button onClick={handleCreate} className="shadow-lg shadow-primary/20">
                            <Plus size={18} /> New Project
                        </Button>
                    </div>
                </div>

                {/* Projects Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-panel rounded-2xl overflow-hidden"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-gray-400 font-medium uppercase tracking-wider text-xs border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-5">Client Code</th>
                                    <th className="px-6 py-5">Client Name</th>
                                    <th className="px-6 py-5">Brand</th>
                                    <th className="px-6 py-5">Project Name</th>
                                    <th className="px-6 py-5">Region</th>
                                    <th className="px-6 py-5">Show Code</th>
                                    <th className="px-6 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan="6" className="text-center py-12 text-gray-500">Loading data...</td></tr>
                                ) : (projects || []).length === 0 ? (
                                    <tr><td colSpan="6" className="text-center py-12 text-gray-500">No projects found</td></tr>
                                ) : (
                                    (projects || []).map((p, i) => (
                                        <motion.tr
                                            key={p.master_id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-white/5 transition-colors group"
                                        >
                                            <td className="px-6 py-4 font-mono font-bold text-primary tracking-wider group-hover:text-white transition-colors">{p.client_code}</td>
                                            <td className="px-6 py-4 font-medium text-white">{p.client_name}</td>
                                            <td className="px-6 py-4 text-gray-300">{p.brand || "-"}</td>
                                            <td className="px-6 py-4 text-gray-300">{p.project_name}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-300 text-xs font-medium border border-white/10 group-hover:border-primary/30 group-hover:text-primary transition-all">
                                                    {p.region}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 font-mono">{p.show_code}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(p)} className="text-gray-500 hover:text-white hover:bg-white/10">
                                                    <Edit2 size={16} />
                                                </Button>
                                            </td>
                                        </motion.tr>
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
        </div>
    );
}
