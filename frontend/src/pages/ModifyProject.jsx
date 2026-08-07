import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import ProjectForm from "../components/ProjectForm";
import { Button } from "../components/ui/Button";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { ArrowLeft } from "lucide-react";

export default function ModifyProject() {
    const { id } = useParams(); // Get ID from URL
    const location = useLocation();
    const { user } = useAuth();
    const { fetchProjects } = useData();
    const navigate = useNavigate();

    const [projectData, setProjectData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);

    useEffect(() => {
        if (id) {
            const stateProject = location.state?.projectData;
            if (location.state?.isReadOnly) {
                setIsReadOnly(true);
            }
            if (stateProject?.project) {
                setProjectData({
                    project: stateProject.project,
                    projections: stateProject.projections || []
                });
            }
            fetchProjectDetails(id, !stateProject?.project);
        }
    }, [id, location.state]);

    const fetchProjectDetails = async (id, showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            // The API expects ID (Block_id)
            const [project, projections] = await Promise.all([
                api.getProjectById(id),
                api.getProjectionsByProjectId(id)
            ]);
            
            // Check if project exists
            if (project) {
                setProjectData({ project, projections });
            } else {
                setProjectData(null);
            }
        } catch (err) {
            console.error("Failed to fetch project details", err);
            setProjectData(null);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const handleSave = async (payload) => {
        const result = await api.updateProject(payload);
        if (result && !result.success) {
            throw new Error(result.error || "Update failed");
        }
        // Force refresh projects
        await fetchProjects(true);
    };

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans">
            <div className="max-w-4xl mx-auto pt-8 px-8">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading project data...</div>
                ) : projectData ? (
                    <ProjectForm
                        title={isReadOnly ? `Viewing: ${projectData.project ? projectData.project['Project Name'] : 'Project'}` : `Editing: ${projectData.project ? projectData.project['Project Name'] : 'Project'}`}
                        initialData={projectData}
                        onSubmit={handleSave}
                        isModify={true}
                        isReadOnly={isReadOnly}
                        onBack={() => navigate("/dashboard")}
                    />
                ) : (
                    <div className="text-center py-12 text-gray-500">No project data found</div>
                )}
            </div>
        </div>
    );
}
