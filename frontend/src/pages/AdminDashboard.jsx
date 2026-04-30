import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, PieChart, Users, Factory, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import api from "../lib/api";

const defaultLogo = "https://lh3.googleusercontent.com/d/14iG9g-t8-yqSgXzXQ8uI4YjX3zZ9jZ9j"; // Placeholder or use imported if available

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [logoSrc, setLogoSrc] = useState(defaultLogo);

    useEffect(() => {
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

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const modules = [
        {
            title: "Business Projections",
            description: "Manage projects, view KPIs, and track quarterly projections.",
            icon: PieChart,
            path: "/dashboard",
            color: "bg-emerald-500",
            delay: 0.1
        },
        {
            title: "Client Hub",
            description: "Manage clients, generate codes, and handle referrals.",
            icon: Users,
            path: "/client-code",
            color: "bg-blue-500",
            delay: 0.2
        },
        {
            title: "Production",
            description: "View production schedules and project codes (Client Name hidden).",
            icon: Factory,
            path: "/production",
            color: "bg-orange-500",
            delay: 0.3
        },
        {
            title: "Finance",
            description: "Manage financial data, INR/USD amounts, and invoicing.",
            icon: DollarSign,
            path: "/finance",
            color: "bg-purple-500",
            delay: 0.4
        }
    ];

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans selection:bg-primary/30 flex flex-col">
            <header className="border-b border-white/10 bg-dark-800/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-auto md:h-16 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10">
                                <img src={logoSrc} alt="PhantomFX" className="h-6" />
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                <span className="text-white">Admin </span>
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

            <main className="flex-grow flex items-center justify-center p-4">
                <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                    {modules
                        .filter(m => {
                            if (user?.isAdmin) return true;
                            const userRoles = String(user?.role || "").split(",").map(r => r.trim().toLowerCase());
                            switch (m.title) {
                                case "Business Projections": return userRoles.includes("biz") || userRoles.includes("bizpoc");
                                case "Client Hub": return userRoles.includes("client code");
                                case "Production": return userRoles.includes("production");
                                case "Finance": return userRoles.includes("finance");
                                default: return false;
                            }
                        })
                        .map((module, index) => (
                        <motion.div
                            key={module.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: module.delay }}
                            onClick={() => navigate(module.path)}
                            className="group relative overflow-hidden rounded-2xl bg-dark-800/50 border border-white/10 p-8 cursor-pointer hover:bg-dark-800 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/10"
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 ${module.color}/10 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:${module.color}/20`}></div>

                            <div className="relative z-10 flex items-start gap-6">
                                <div className={`p-4 rounded-xl ${module.color}/20 text-white group-hover:scale-110 transition-transform duration-300`}>
                                    <module.icon size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{module.title}</h2>
                                    <p className="text-gray-400 group-hover:text-gray-300 transition-colors">{module.description}</p>
                                </div>
                            </div>

                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-gray-500 uppercase tracking-widest">
                                Click to Enter &rarr;
                            </div>
                        </motion.div>
                    ))}
                </div>
            </main>
        </div>
    );
}
