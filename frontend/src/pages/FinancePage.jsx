import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import api from "../lib/api";
import { LogOut, Search, Download, Edit2, AlertTriangle, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const logo = "https://lh3.googleusercontent.com/d/14iG9g-t8-yqSgXzXQ8uI4YjX3zZ9jZ9j"; // Placeholder

export default function FinancePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // State
    const [logoSrc, setLogoSrc] = useState("pixoo-black-logo.png");
    const [finances, setFinances] = useState([]);
    const [projects, setProjects] = useState([]);
    const [mergedData, setMergedData] = useState([]);
    const [search, setSearch] = useState("");
    const [searchField, setSearchField] = useState("show_code"); // Default to show_code
    const [loading, setLoading] = useState(true);
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

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        show_code: "",
        amount_in_inr: "",
        amount_in_usd: ""
    });
    const [saving, setSaving] = useState(false);

    // Initial Fetch
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
            } catch (err) {
                console.error("Failed to fetch logo", err);
            }
        };
        fetchLogo();
    }, []);

    // Merge Data & Filter
    useEffect(() => {
        if (!projects.length) return;

        // Map finances to projects or vice versa. 
        // Strategy: List ALL projects, and attach finance data if it exists.
        // If a finance entry exists without a project (unlikely but possible), list it too?
        // Let's stick to Projects as the base.

        const financeMap = {};
        finances.forEach(f => {
            financeMap[f.show_code] = f;
        });

        const merged = projects
            .filter(p => p.show_code && String(p.show_code).trim() !== "")
            .map(p => {
            const fin = financeMap[p.show_code] || {};
            return {
                ...p,
                finance_id: fin.finance_id || null,
                amount_in_inr: fin.amount_in_inr || "",
                amount_in_usd: fin.amount_in_usd || ""
            };
        });

        // Filter
        let filtered = merged;
        if (search) {
            const lowerSearch = search.toLowerCase();
            filtered = filtered.filter(item => {
                let fieldValue = "";
                switch (searchField) {
                    case "client_name": fieldValue = item.client_name; break;
                    case "client_code": fieldValue = item.client_code; break;
                    case "project_name": fieldValue = item.project_name; break;
                    case "show_code": fieldValue = item.show_code; break;
                    default: fieldValue = item.show_code;
                }
                return fieldValue && typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(lowerSearch);
            });
        }

        setMergedData(filtered);

    }, [finances, projects, search, searchField]);

    const fetchData = async () => {
        try {
            setError("");
            setLoading(true);
            const [finData, projData] = await Promise.all([
                api.getFinances(),
                api.getClientCodeProjects()
            ]);

            setFinances(Array.isArray(finData) ? finData : []);
            setProjects(Array.isArray(projData) ? projData : []);
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
        setEditingItem(item);
        setFormData({
            show_code: item.show_code,
            amount_in_inr: item.amount_in_inr,
            amount_in_usd: item.amount_in_usd,
            finance_id: item.finance_id
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.saveFinance(formData);
            await fetchData(); // Refresh data
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (err) {
            console.error("Failed to save", err);
            setError("Failed to save finance data");
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        const headers = [
            "Show Code",
            "Project Name",
            "Client Code",
            "Client Name",
            "Amount INR",
            "Amount USD",
            "Address",
            "Client Contact",
            "Finance Contact"
        ];
        const csvContent = [
            headers.join(","),
            ...mergedData.map(p => [
                p.show_code,
                p.project_name,
                p.client_code,
                p.client_name,
                p.amount_in_inr,
                p.amount_in_usd,
                p.Address,
                p.client_contact_mail,
                p.finance_contact_mail
            ].map(f => `"${f || ''}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "finance_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-primary/30">
            {/* Top Bar */}
            <header className="border-b border-white/10 bg-dark-800/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto md:h-16 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-3">
                            {user?.isAdmin && (
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

                {/* Actions Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                        <div className="w-full md:w-48">
                            <Select
                                options={[
                                    { value: "show_code", label: "Show Code" },
                                    { value: "project_name", label: "Project Name" },
                                    { value: "client_code", label: "Client Code" },
                                    { value: "client_name", label: "Client Name" }
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
                    </div>
                </div>

                {/* Finance Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-panel rounded-2xl overflow-hidden relative"
                >
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
                                    <th className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] sticky left-0 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.5)] min-w-[140px]">Show Code</th>
                                    <th className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] min-w-[200px]">Project Name</th>
                                    <th className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A]">Client Code</th>
                                    <th className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A] min-w-[200px]">Client Name</th>
                                    <th className="px-6 py-5 whitespace-nowrap text-right bg-[#0A0A0A]">Amount (INR)</th>
                                    <th className="px-6 py-5 whitespace-nowrap text-right bg-[#0A0A0A]">Amount (USD)</th>
                                    <th className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A]">Address</th>
                                    <th className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A]">Client Contact</th>
                                    <th className="px-6 py-5 whitespace-nowrap bg-[#0A0A0A]">Finance Contact</th>
                                    <th className="px-6 py-5 whitespace-nowrap text-right bg-[#0A0A0A]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan="10" className="text-center py-12 text-gray-500">Loading data...</td></tr>
                                ) : mergedData.length === 0 ? (
                                    <tr><td colSpan="10" className="text-center py-12 text-gray-500">No projects found</td></tr>
                                ) : (
                                    mergedData.map((item, i) => (
                                        <motion.tr
                                            key={item.show_code || i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="hover:bg-white/5 transition-colors group"
                                        >
                                            <td className="px-6 py-4 font-mono text-gray-400 whitespace-nowrap sticky left-0 z-10 bg-[#0A0A0A] border-r border-white/10 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">{item.show_code}</td>
                                            <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{item.project_name}</td>
                                            <td className="px-6 py-4 font-mono text-gray-400 whitespace-nowrap">{item.client_code}</td>
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{item.client_name}</td>
                                            <td className="px-6 py-4 text-right font-mono text-emerald-400 whitespace-nowrap">
                                                {item.amount_in_inr ? `₹${Number(item.amount_in_inr).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-blue-400 whitespace-nowrap">
                                                {item.amount_in_usd ? `$${Number(item.amount_in_usd).toLocaleString()}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 max-w-xs truncate" title={item.Address}>{item.Address || '-'}</td>
                                            <td className="px-6 py-4 text-gray-400 max-w-xs truncate" title={item.client_contact_mail}>{item.client_contact_mail || '-'}</td>
                                            <td className="px-6 py-4 text-gray-400 max-w-xs truncate" title={item.finance_contact_mail}>{item.finance_contact_mail || '-'}</td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="text-gray-500 hover:text-white hover:bg-white/10">
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

            {/* Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="glass-panel rounded-2xl w-full max-w-md border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A]"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-dark-900">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <DollarSign className="text-primary" size={20} />
                                    Update Finances
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">Project</label>
                                    <div className="text-white font-medium">{editingItem?.project_name}</div>
                                    <div className="text-gray-500 text-sm">{editingItem?.show_code}</div>
                                </div>

                                <Input
                                    label="Amount in INR"
                                    type="number"
                                    value={formData.amount_in_inr}
                                    onChange={(e) => setFormData({ ...formData, amount_in_inr: e.target.value })}
                                    placeholder="0.00"
                                />

                                <Input
                                    label="Amount in USD"
                                    type="number"
                                    value={formData.amount_in_usd}
                                    onChange={(e) => setFormData({ ...formData, amount_in_usd: e.target.value })}
                                    placeholder="0.00"
                                />

                                <div className="pt-4 flex justify-end gap-3">
                                    <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={saving}>
                                        {saving ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
