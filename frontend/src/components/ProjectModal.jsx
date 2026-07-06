import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { X, Sparkles, RefreshCw, Check } from "lucide-react";
import api from "../lib/api";

// Simple Input component if not imported
const SimpleInput = ({ label, ...props }) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <input
            className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
            {...props}
        />
    </div>
);

export default function ProjectModal({ isOpen, onClose, project, onSave, mode = 'new' }) {
    const [formData, setFormData] = useState({
        client_name: "",
        region: "",
        client_location: "", // Renamed from territory
        currency: "",
        show_code: "",
        project_name: "",
        misc_info: "",
        source: "",
        brand: "",
        country: "",
        client_contact_mail: "",
        finance_contact_mail: "",
        Address: "",
        is_referral: false,
        additional_notes: "",
        year: new Date().getFullYear(), // Default to current year
        status: "Awarded" // Default status
    });
    const [previewCode, setPreviewCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [previewError, setPreviewError] = useState("");

    // Dropdown options for Existing Client mode
    const [clientNames, setClientNames] = useState([]);

    // Options
    const regionOptions = [
        { value: "Domestic", label: "Domestic" },
        { value: "International", label: "International" }
    ];

    // Renamed territoryOptions to clientLocationOptions for consistency
    const clientLocationOptions = {
        "Domestic": ["Chennai", "Hyderabad", "Mumbai", "Bangalore"],
        "International": ["USA", "UK", "Canada", "Europe", "China", "Others"]
    };

    const miscInfoOptions = ["ID", "TS", "NX", "SP", "MK", "00"];
    const brandOptions = ["PFX", "Milk", "Spectre", "Lola", "Tippett"];
    const statusOptions = [
        { value: "Awarded", label: "Awarded" },
        { value: "Lost", label: "Lost" },
        { value: "", label: "Unknown" }
    ];

    useEffect(() => {
        if (project) {
            setFormData({
                ...project,
                client_location: project.client_location || project.territory || "" // Handle migration/legacy naming
            });
            setPreviewCode(project.client_code);
        } else {
            setFormData({
                client_name: "",
                region: "",
                client_location: "",
                currency: "",
                show_code: "",
                project_name: "",
                misc_info: "",
                source: "",
                brand: "",
                country: "",
                client_contact_mail: "",
                finance_contact_mail: "",
                Address: "",
                is_referral: false,
                additional_notes: "",
                year: new Date().getFullYear(),
                status: "Unknown"
            });
            setPreviewCode("");
        }
    }, [project, isOpen]);

    // Fetch Client Names when opening in 'existing' mode
    useEffect(() => {
        if (isOpen && mode === 'existing' && !project) {
            const fetchClients = async () => {
                try {
                    const names = await api.getClientNames();
                    setClientNames(names.map(name => ({ value: name, label: name })));
                } catch (err) {
                    console.error("Failed to fetch client names", err);
                }
            };
            fetchClients();
        }
    }, [isOpen, mode, project]);



    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchPreview = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!formData.client_name) return;
        if (project) return;

        try {
            setIsRefreshing(true);
            setPreviewError("");
            const code = await api.previewClientCode(
                formData.client_name,
                formData.region,
                formData.client_location, // Pass new field name (backend handles it)
                formData.misc_info
            );
            setPreviewCode(code);
        } catch (err) {
            console.error("Preview failed", err);
            setPreviewError("Failed to load preview");
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (isOpen && !project) fetchPreview();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.client_name, formData.region, formData.client_location, formData.misc_info, isOpen, project]);

    // Autofill effect - Trigger on Client Name OR Misc Info change
    useEffect(() => {
        const fetchDetails = async () => {
            if (!formData.client_name || project || mode !== 'existing') return;

            try {
                let data = null;

                // 1. Try to find exact match (Name + Misc Info)
                if (formData.misc_info) {
                    data = await api.getClientDetails(formData.client_name, formData.misc_info);
                }

                // 2. If no exact match (or misc_info empty), fallback to latest client details by name
                if (!data || Object.keys(data).length === 0) {
                    data = await api.getClientDetailsByName(formData.client_name);
                }

                if (data && Object.keys(data).length > 0) {
                    setFormData(prev => ({
                        ...prev,
                        region: data.region || prev.region,
                        client_location: data.client_location || data.territory || prev.client_location,
                        brand: data.brand || prev.brand,
                        country: data.country || prev.country,
                        currency: data.currency || prev.currency,
                        client_contact_mail: data.client_contact_mail || prev.client_contact_mail,
                        finance_contact_mail: data.finance_contact_mail || prev.finance_contact_mail,
                        Address: data.Address || prev.Address,
                        is_referral: data.is_referral !== undefined ? (String(data.is_referral).toLowerCase() === 'true') : prev.is_referral,
                        additional_notes: data.additional_notes || prev.additional_notes,
                        // Don't overwrite misc_info if user manually selected it
                        misc_info: prev.misc_info || data.misc_info || ""
                    }));
                }
            } catch (err) {
                console.error("Autofill failed", err);
            }
        };

        const timeoutId = setTimeout(() => {
            if (isOpen) fetchDetails();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.client_name, formData.misc_info, isOpen, project, mode]);

    useEffect(() => {
        const validateFields = async () => {
            if (!formData.project_name && !formData.show_code) return;

            try {
                const res = await api.validateProject(formData.project_name, formData.show_code);
                if (res && res.errors) {
                    const errs = res.errors;
                    if (Object.keys(errs).length > 0) {
                        setError(Object.values(errs).join(", "));
                    } else {
                        setError("");
                    }
                } else {
                    // No errors returned, clear error state
                    setError("");
                }
            } catch (err) {
                console.error("Validation failed", err);
                setError(""); // Clear error on validation failure
            }
        };

        const timeoutId = setTimeout(() => {
            if (isOpen) validateFields();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.project_name, formData.show_code, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updates = { ...prev, [name]: value };
            // Reset client_location if region changes
            if (name === 'region') {
                updates.client_location = "";
            }
            return updates;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            // Determine repetition value
            let repetition = 'New';
            if (mode === 'existing') {
                repetition = 'Existing';
            }
            if (formData.is_referral) {
                repetition = 'Referral';
            }

            const payload = {
                ...formData,
                creation_mode: mode === 'existing' ? 'Existing Client' : 'New Client',
                client_code: previewCode,
                repetition: repetition,
                // Ensure legacy field is also populated just in case
                territory: formData.client_location
            };
            await onSave(payload);
            onClose();
        } catch (err) {
            console.error(err);
            setError("Failed to save project");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Determine Client Location Options based on selected Region
    const currentClientLocationOptions = formData.region ? clientLocationOptions[formData.region] || [] : [];

    // Generate years for picker (e.g., current year +/- 5)
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i).map(y => ({ value: y, label: String(y) }));

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="glass-panel rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A]"
                >
                    <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-dark-900 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Sparkles className="w-5 h-5 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-white">
                                {project ? "Edit Project" : (mode === 'existing' ? "New Project (Existing Client)" : "New Project (New Client)")}
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {mode === 'existing' && !project ? (
                                <>
                                    <Select
                                        label="Client Name"
                                        options={clientNames}
                                        value={formData.client_name}
                                        onChange={(e) => handleChange({ target: { name: "client_name", value: e.target.value } })}
                                        required
                                        placeholder="Select Client"
                                        searchable={true}
                                    />
                                    <Select
                                        label="Misc Info"
                                        options={miscInfoOptions.map(o => ({ value: o, label: o }))}
                                        value={formData.misc_info}
                                        onChange={(e) => handleChange({ target: { name: "misc_info", value: e.target.value } })}
                                        required
                                        placeholder="Select Misc Info"
                                    />
                                </>
                            ) : (
                                <>
                                    <SimpleInput label="Client Name" name="client_name" value={formData.client_name} onChange={handleChange} required placeholder="e.g. Acme Corp" />
                                    <Select
                                        label="Misc Info"
                                        options={miscInfoOptions.map(o => ({ value: o, label: o }))}
                                        value={formData.misc_info}
                                        onChange={(e) => handleChange({ target: { name: "misc_info", value: e.target.value } })}
                                        required
                                        placeholder="Select Misc Info"
                                    />
                                </>
                            )}

                            <Select
                                label="Region"
                                options={regionOptions}
                                value={formData.region}
                                onChange={(e) => handleChange({ target: { name: "region", value: e.target.value } })}
                                required
                                placeholder="Select Region"
                            />

                            <Select
                                label="Client Location"
                                options={currentClientLocationOptions.map(t => ({ value: t, label: t }))}
                                value={formData.client_location}
                                onChange={(e) => handleChange({ target: { name: "client_location", value: e.target.value } })}
                                required
                                placeholder="Select Client Location"
                                disabled={!formData.region}
                            />

                            <SimpleInput label="Currency" name="currency" value={formData.currency} onChange={handleChange} required placeholder="e.g. USD" />
                            <SimpleInput label="Show Code" name="show_code" value={formData.show_code} onChange={handleChange} required placeholder="KRPU" />
                            <SimpleInput label="Project Name" name="project_name" value={formData.project_name} onChange={handleChange} required placeholder="e.g. Summer Campaign" />

                            <SimpleInput label="Country" name="country" value={formData.country} onChange={handleChange} required placeholder="e.g. USA" />
                            <SimpleInput label="Source" name="source" value={formData.source} onChange={handleChange} placeholder="EP name" />

                            <Select
                                label="Brand"
                                options={brandOptions.map(b => ({ value: b, label: b }))}
                                value={formData.brand}
                                onChange={(e) => handleChange({ target: { name: "brand", value: e.target.value } })}
                                placeholder="Select Brand"
                            />

                            <Select
                                label="Year"
                                options={yearOptions}
                                value={formData.year}
                                onChange={(e) => handleChange({ target: { name: "year", value: e.target.value } })}
                                required
                                placeholder="Select Year"
                            />

                            <Select
                                label="Status"
                                options={statusOptions}
                                value={formData.status}
                                onChange={(e) => handleChange({ target: { name: "status", value: e.target.value } })}
                                required
                                placeholder="Select Status"
                            />

                            {/* Contact Information */}
                            <div className="col-span-1 md:col-span-2 text-xs font-medium text-gray-400 uppercase tracking-wider border-t border-white/10 pt-4 mt-2">
                                Contact Information
                            </div>

                            <SimpleInput label="Client Contact Email" name="client_contact_mail" type="email" value={formData.client_contact_mail} onChange={handleChange} placeholder="client@example.com" />
                            <SimpleInput label="Finance Contact Email" name="finance_contact_mail" type="email" value={formData.finance_contact_mail} onChange={handleChange} placeholder="finance@example.com" />
                            <div className="col-span-1 md:col-span-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">Address</label>
                                <textarea
                                    name="Address"
                                    value={formData.Address}
                                    onChange={handleChange}
                                    className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all min-h-[60px]"
                                    placeholder="Full address"
                                />
                            </div>

                            {/* Referral Section */}
                            <div className="col-span-1 md:col-span-2 border-t border-white/10 pt-4 mt-2">
                                <div
                                    className={`flex items-center p-3 rounded-lg border transition-all cursor-pointer ${formData.is_referral ? 'bg-primary/10 border-primary/50' : 'bg-dark-800/50 border-white/10 hover:bg-white/5'}`}
                                    onClick={() => setFormData(prev => ({ ...prev, is_referral: !prev.is_referral, additional_notes: !prev.is_referral ? prev.additional_notes : '' }))}
                                >
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${formData.is_referral ? 'bg-primary border-primary' : 'border-gray-500 bg-transparent'}`}>
                                        {formData.is_referral && <Check size={14} className="text-black" />}
                                    </div>
                                    <span className={`text-sm font-medium transition-colors ${formData.is_referral ? 'text-white' : 'text-gray-300'}`}>This is a Referral</span>
                                </div>
                            </div>

                            {formData.is_referral && (
                                <div className="col-span-1 md:col-span-2">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1">
                                        Additional Notes <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        name="additional_notes"
                                        value={formData.additional_notes}
                                        onChange={handleChange}
                                        required={formData.is_referral}
                                        className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all min-h-[80px]"
                                        placeholder="Please provide referral details (mandatory for referrals)"
                                    />
                                </div>
                            )}
                        </div>

                        <motion.div
                            layout
                            className="bg-dark-800/50 p-6 rounded-xl border border-white/5 relative overflow-hidden group"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-all"></div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">
                                    {project ? "Current Client Code" : "Realtime Client Code Preview"}
                                </label>
                                {!project && (
                                    <button type="button" onClick={fetchPreview} className="text-xs text-primary hover:text-white flex items-center gap-1">
                                        <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} /> Refresh
                                    </button>
                                )}
                            </div>

                            <div className="text-3xl font-mono font-bold text-primary tracking-widest neon-text min-h-[40px]">
                                {previewCode || "---"}
                            </div>
                            {previewError && <div className="text-red-400 text-xs mt-1">{previewError}</div>}
                        </motion.div>

                        {error && (
                            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={loading} className="min-w-[120px]">
                                {loading ? "Saving..." : "Save Project"}
                            </Button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence >
    );
}
