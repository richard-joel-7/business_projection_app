import { useState, useEffect, createContext, useContext } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is already logged in (e.g. from localStorage)
        const storedUser = localStorage.getItem('bp_user');
        const loginTime = localStorage.getItem('bp_login_time');

        if (storedUser && loginTime) {
            const now = Date.now();
            const timeElapsed = now - parseInt(loginTime, 10);
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (timeElapsed > twentyFourHours) {
                // Session expired
                logout();
            } else {
                try {
                    setUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error("Failed to parse stored user", e);
                    logout();
                }
            }
        } else {
            logout(); // Ensure clean state if no valid session
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const result = await api.login(email, password);
            if (result.success) {
                setUser(result);
                localStorage.setItem('bp_user', JSON.stringify(result));
                localStorage.setItem('bp_login_time', Date.now().toString());
                return { success: true, ...result };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error("Login error", error);
            return { success: false, error: "Login failed. Please try again." };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('bp_user');
        localStorage.removeItem('bp_login_time');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
