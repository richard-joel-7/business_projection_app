import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [logoSrc, setLogoSrc] = useState("pixoo-black-logo.png");
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const fetchLogo = async () => {
            try {
                // Check if logo is cached in localStorage
                const cachedLogo = localStorage.getItem('app_logo');
                if (cachedLogo) {
                    setLogoSrc(cachedLogo);
                    return;
                }

                // Fetch from server if not cached
                const { default: api } = await import("../lib/api");
                const result = await api.getLogoImage();
                if (result && result.data) {
                    const logoDataUrl = `data:${result.mimeType};base64,${result.data}`;
                    setLogoSrc(logoDataUrl);
                    // Cache it for future use
                    localStorage.setItem('app_logo', logoDataUrl);
                }
            } catch (err) {
                console.error("Failed to fetch logo", err);
            }
        };
        fetchLogo();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            const userRoles = String(result.role || "").split(",").map(r => r.trim().toLowerCase());
            // Admin or Multi-role user goes to Admin Hub
            if (result.isAdmin || userRoles.includes('admin') || userRoles.length > 1) {
                navigate("/admin-dashboard");
            } else if (userRoles.includes('client code')) {
                navigate("/client-code");
            } else if (userRoles.includes('production') || userRoles.includes('prod admin')) {
                navigate("/production");
            } else if (userRoles.includes('finance')) {
                navigate("/finance");
            } else {
                navigate("/dashboard"); // Default for Biz or others
            }
        } else {
            setError(result.error || "Invalid credentials");
        }
        setLoading(false);
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden"
            style={{
                backgroundColor: '#050505',
                backgroundImage: `
                    radial-gradient(circle at 50% 0%, rgba(47, 141, 77, 0.25), transparent 50%),
                    radial-gradient(circle at 0% 50%, rgba(255, 20, 147, 0.1), transparent 50%)
                `
            }}
        >

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-8 md:p-12 rounded-2xl w-full max-w-md z-10 relative border border-white/10 shadow-2xl"
            >
                <div className="text-center mb-8">
                    {/* Glass-morphism Logo Container */}
                    <div className="flex justify-center mb-6">
                        <div className="relative p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-lg">
                            <img src={logoSrc} alt="PhantomFX" className="h-12 object-contain" />
                        </div>
                    </div>

                    {/* Welcome Back with Green Glowing Accent */}
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Welcome <span className="text-primary" style={{ textShadow: '0 0 20px rgba(52, 211, 153, 0.5)' }}>Back</span>
                    </h1>
                    <p className="text-gray-400">Enter your credentials to access the portal</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        required
                    />
                    {/* Password with Eye Toggle */}
                    <div className="relative">
                        <Input
                            label="Password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-[38px] text-gray-400 hover:text-white transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* Sign In Button with Arrow */}
                    <Button
                        type="submit"
                        className="w-full py-3 text-lg flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        {loading ? "Signing in..." : (
                            <>
                                Sign In
                                <ArrowRight size={20} />
                            </>
                        )}
                    </Button>
                </form>
            </motion.div>
        </div>
    );
}
