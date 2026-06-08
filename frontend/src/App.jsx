import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import ModifyProject from "./pages/ModifyProject";
import AdminDashboard from "./pages/AdminDashboard";
import ClientCodePage from "./pages/ClientCodePage";
import ProductionPage from "./pages/ProductionPage";
import FinancePage from "./pages/FinancePage";
import ExecutivePage from "./pages/ExecutivePage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import { useEffect } from "react";

// Component to save current location
function LocationSaver() {
    const location = useLocation();
    useEffect(() => {
        if (location.pathname !== '/' && location.pathname !== '/login') {
            localStorage.setItem('bp_last_path', location.pathname);
        }
    }, [location]);
    return null;
}

// Component to handle root redirect
function RootRedirect() {
    const lastPath = localStorage.getItem('bp_last_path');
    if (lastPath && lastPath !== '/' && lastPath !== '/login') {
        return <Navigate to={lastPath} replace />;
    }
    return <Navigate to="/dashboard" replace />;
}

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { user, loading } = useAuth();

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-dark-900 text-primary">Loading...</div>;

    if (!user) return <Navigate to="/login" />;

    // Admin has access to everything
    if (user.isAdmin) return children;

    // Check role access
    if (allowedRoles.length > 0) {
        // Normalize role check (case insensitive) and support comma-separated strings
        const userRoles = String(user.role || "").split(",").map(r => r.trim().toLowerCase());
        let hasAccess = allowedRoles.some(role => userRoles.includes(role.toLowerCase()));

        // Special case: if route allows 'multi_role' and user has >1 role, grant access
        if (allowedRoles.includes('multi_role') && userRoles.length > 1) {
            hasAccess = true;
        }

        if (!hasAccess) {
            // Redirect to their allowed page if they try to access unauthorized page
            if (userRoles.includes('biz')) return <Navigate to="/dashboard" />;
            if (userRoles.includes('bizpoc')) return <Navigate to="/dashboard" />;
            if (userRoles.includes('client code')) return <Navigate to="/client-code" />;
            if (userRoles.includes('production') || userRoles.includes('prod admin')) return <Navigate to="/production" />;
            if (userRoles.includes('finance')) return <Navigate to="/finance" />;
            if (userRoles.includes('executive')) return <Navigate to="/admin-dashboard" />;
            return <Navigate to="/login" />; // Fallback
        }
    }

    return children;
};

import { DataProvider } from "./context/DataContext";

// ... (imports)

function App() {
    return (
        <AuthProvider>
            <DataProvider>
                <Router>
                    <LocationSaver />
                    <ScrollToTop />
                    <Routes>
                        <Route path="/login" element={<Login />} />

                        {/* Admin Dashboard */}
                        <Route
                            path="/admin-dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['admin', 'multi_role', 'executive']}>
                                    <AdminDashboard />
                                </ProtectedRoute>
                            }
                        />

                        {/* Business Projections (Biz & Admin) */}
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['biz', 'bizpoc', 'admin', 'executive']}>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/"
                            element={<RootRedirect />}
                        />

                        {/* Client Code (Client Code & Admin) */}
                        <Route
                            path="/client-code"
                            element={
                                <ProtectedRoute allowedRoles={['client code', 'admin', 'executive']}>
                                    <ClientCodePage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Production (Production & Admin) */}
                        <Route
                            path="/production"
                            element={
                                <ProtectedRoute allowedRoles={['production', 'admin', 'prod admin', 'executive']}>
                                    <ProductionPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Finance (Finance & Admin) */}
                        <Route
                            path="/finance"
                            element={
                                <ProtectedRoute allowedRoles={['finance', 'admin', 'executive']}>
                                    <FinancePage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Executive Hub (Executive & Admin) */}
                        <Route
                            path="/executive-hub"
                            element={
                                <ProtectedRoute allowedRoles={['executive', 'admin']}>
                                    <ExecutivePage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Project Management (Biz & Admin) */}
                        <Route
                            path="/new-project"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <NewProject />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/modify-project/:id"
                            element={
                                <ProtectedRoute allowedRoles={['biz', 'bizpoc', 'admin']}>
                                    <ModifyProject />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Router>
            </DataProvider>
        </AuthProvider>
    );
}

export default App;
