import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import BillableRepeater from "./BillableRepeater";
import api from "../lib/api";

export default function BillableModal({ isOpen, onClose, project, onSuccess, user }) {
    const [billables, setBillables] = useState([]);
    const [deletedBillables, setDeletedBillables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [currency, setCurrency] = useState("INR");

    useEffect(() => {
        if (isOpen && project) {
            const grouped = {};
            (project.billables || []).forEach(b => {
                const bin = b.Bin_number || '';
                if (!grouped[bin]) grouped[bin] = [];
                grouped[bin].push({
                    Billable_id: b.Billable_id,
                    Billable_date: b.Billable_date,
                    Billable_Amount_in_Home_Currency: b.Billable_Amount_in_Home_Currency || '',
                    Home_Currency: b.Home_Currency || project.Home_Currency || project.Currency || '',
                    Amount_in_Inr: b.Amount_in_Inr,
                    Amount_in_USD: b.Amount_in_USD,
                    Remarks: b.Remarks || '',
                    Status: b.Status || '',
                    Approved_to_Finance: b.Approved_to_Finance || '',
                    'Approved by': b['Approved by'] || '',
                    isApproving: false
                });
            });

            // Map from project.bins
            const binDetailsMap = {};
            (project.bins || []).forEach(b => {
                binDetailsMap[b.Bin_number] = b;
            });

            const initialBins = Object.keys(grouped).map(bin => {
                const binDetails = binDetailsMap[bin] || {};
                return {
                    binNumber: bin,
                    type: binDetails.Type || "",
                    entries: grouped[bin]
                };
            });

            setBillables(initialBins);
            setDeletedBillables([]);
            setError("");
        } else {
            setBillables([]);
            setDeletedBillables([]);
        }
    }, [isOpen, project]);

    if (!isOpen || !project) return null;

    const handleDeleteBillable = (id) => {
        if (id) {
            setDeletedBillables(prev => [...prev, id]);
        }
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError("");
            
            const payload = {
                blockId: project.Block_id,
                blockName: project.Block_Name,
                userEmail: user?.email,
                userName: user?.name || user?.email?.split('@')[0]
            };
            
            const flatBillables = [];
            const binUpdates = [];

            billables.forEach(binGroup => {
                binUpdates.push({
                    Bin_number: binGroup.binNumber,
                    Type: binGroup.type
                });

                binGroup.entries.forEach(entry => {
                    flatBillables.push({
                        Bin_number: binGroup.binNumber,
                        Billable_id: entry.Billable_id,
                        Billable_date: entry.Billable_date,
                        Billable_Amount_in_Home_Currency: entry.Billable_Amount_in_Home_Currency,
                        Home_Currency: entry.Home_Currency || project.Home_Currency || project.Currency || '',
                        Amount_in_Inr: entry.Amount_in_Inr,
                        Amount_in_USD: entry.Amount_in_USD,
                        Remarks: entry.Remarks,
                        Status: entry.Status,
                        isApproving: entry.isApproving
                    });
                });
            });

            payload.billables = flatBillables;
            payload.bins = binUpdates;
            payload.deletedBillables = deletedBillables;

            const result = await api.saveBillableDetails(payload);
            if (result && !result.success) {
                throw new Error(result.error || "Save failed");
            }
            onSuccess();
        } catch (err) {
            console.error(err);
            setError(err.message || "An error occurred while saving.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-2xl border border-white/10"
                >
                    <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-800/50">
                        <div className="flex justify-between items-start w-full sm:w-auto">
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white">Billable Details</h2>
                                <p className="text-xs sm:text-sm text-gray-400 mt-1">Project: {project.DealName || project.Block_Name}</p>
                            </div>
                            <button onClick={onClose} className="sm:hidden p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                            {/* Currency Toggle */}
                            <div className="flex items-center gap-1 bg-dark-800/50 border border-white/10 rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setCurrency("USD")}
                                    className={`flex items-center justify-center px-3 py-1 rounded-md transition-all ${currency === "USD"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-[10px] font-bold">USD</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrency("INR")}
                                    className={`flex items-center justify-center px-3 py-1 rounded-md transition-all ${currency === "INR"
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-[10px] font-bold">INR</span>
                                </button>
                            </div>
                            <button onClick={onClose} className="hidden sm:block p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
                                <AlertTriangle size={20} />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Billable Bins & Entries
                                </label>
                            </div>
                            <BillableRepeater
                                billables={billables}
                                onChange={setBillables}
                                amountCurrency={currency}
                                onDelete={handleDeleteBillable}
                                currentUser={user?.name || user?.email?.split('@')[0] || ''}
                                userRole={user?.role || ''}
                                project={project}
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-white/10 bg-dark-800/50 flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button onClick={() => handleSave()} disabled={loading} className="gap-2">
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Save size={18} />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}