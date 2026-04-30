import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';
import { parseDate, getFY, getCY } from '../lib/utils';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]); // Business Projections
    const [clients, setClients] = useState([]); // Client Code
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [loadingClients, setLoadingClients] = useState(false);
    const [projectsLoaded, setProjectsLoaded] = useState(false);
    const [clientsLoaded, setClientsLoaded] = useState(false);

    // Fetch Projects (Business Projections)

    // Fetch Projects (Business Projections)
    const fetchProjects = async (force = false) => {
        if (!user) return;
        if (projectsLoaded && !force) return;
        setLoadingProjects(true);
        try {
            const data = await api.getDashboardProjects(user.email, user.isAdmin, user.role);

            // Enrich Data
            const enrichedData = (data || []).map(p => {
                const closeDate = parseDate(p['Close Date']);
                let closeDateFY = 'Unknown';
                let closeDateCY = 'Unknown';
                let closeDateMonth = 'Unknown';
                if (closeDate) {
                    closeDateFY = getFY(closeDate);
                    closeDateCY = getCY(closeDate);
                    closeDateMonth = closeDate.toLocaleString('default', { month: 'short' });
                }
                return { ...p, closeDate, closeDateFY, closeDateCY, closeDateMonth };
            });

            setProjects(enrichedData);
            setProjectsLoaded(true);
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setLoadingProjects(false);
        }
    };

    // Fetch Clients (Client Code)
    const fetchClients = async (force = false) => {
        if (clientsLoaded && !force) return;
        setLoadingClients(true);
        try {
            // We use getClientsWithProjectDetails as per recent refactor
            // Note: api.getClientsWithProjectDetails might need to be verified if it exists in api.js
            // If not, we use getClientCodeProjects which we redirected in backend
            // But api.js doesn't have getClientsWithProjectDetails exposed yet?
            // Let's check api.js again. It has getClientCodeProjects.
            // And backend getClientCodeProjects calls getClientsWithProjectDetails.
            // So calling api.getClientCodeProjects() is correct.
            const data = await api.getClientCodeProjects();
            setClients(data);
            setClientsLoaded(true);
        } catch (error) {
            console.error("Failed to fetch clients", error);
        } finally {
            setLoadingClients(false);
        }
    };

    // Clear cache on logout
    useEffect(() => {
        if (!user) {
            setProjects([]);
            setClients([]);
            setProjectsLoaded(false);
            setClientsLoaded(false);
        }
    }, [user]);

    return (
        <DataContext.Provider value={{
            projects,
            clients,
            loadingProjects,
            loadingClients,
            fetchProjects,
            fetchClients,
            setProjects, // Allow manual updates
            setClients
        }}>
            {children}
        </DataContext.Provider>
    );
};
