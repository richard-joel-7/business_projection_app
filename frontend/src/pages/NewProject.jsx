import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ProjectForm from "../components/ProjectForm";
import { Button } from "../components/ui/Button";
import api from "../lib/api";
import { useData } from "../context/DataContext";

export default function NewProject() {
    const navigate = useNavigate();
    const { fetchProjects } = useData();

    const handleSave = async (payload) => {
        const result = await api.createProject(payload);
        if (result && !result.success) {
            throw new Error(result.error || "Create failed");
        }
        // Force refresh projects
        await fetchProjects(true);
    };

    return (
        <div className="min-h-screen bg-dark-900 text-gray-100 font-sans">
            <div className="max-w-4xl mx-auto pt-8 px-8">
                <ProjectForm
                    title="New Project"
                    onSubmit={handleSave}
                    onBack={() => navigate("/dashboard")}
                />
            </div>
        </div>
    );
}
