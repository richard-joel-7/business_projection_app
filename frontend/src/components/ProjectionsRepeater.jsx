import { useEffect, useState } from "react";
import { Input } from "../components/ui/Input";
import { DateInput } from "../components/ui/DateInput";
import { Plus, Info, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "react-tooltip";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

export default function ProjectionsRepeater({ projections, onChange, amountCurrency = "USD", projectTotalHome = 0, exchangeRates, projectHomeCurrency }) {
    const { user } = useAuth();
    const isAdmin = user?.isAdmin;
    const [approving, setApproving] = useState({});

    useEffect(() => {
        try {
            console.log("ProjectionsRepeater received projections:", projections);
        } catch (e) {
            console.error("ProjectionsRepeater logging failed", e);
        }
    }, [projections]);

    // Helper to display dd-MMM-yyyy in tooltip (e.g. 07-Jan-2026)
    const formatDateForDisplay = (dateString) => {
        if (!dateString || dateString === 'undefined') return "N/A";

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        // Check if it's in dd-mm-yyyy format (or d-m-yyyy)
        // Also handle potential timestamp part (dd-mm-yyyy HH:mm:ss)
        const cleanDateStr = String(dateString).split(' ')[0]; // Take only the date part
        const ddmmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
        
        const match = cleanDateStr.match(ddmmyyyyRegex);
        if (match) {
            const day = parseInt(match[1], 10);
            const monthIdx = parseInt(match[2], 10) - 1;
            const year = match[3];
            if (monthIdx >= 0 && monthIdx < 12) {
                return `${String(day).padStart(2, '0')}-${months[monthIdx]}-${year}`;
            }
        }

        try {
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return cleanDateStr; // Fallback to raw string if parsing fails
            const day = String(d.getDate()).padStart(2, '0');
            const month = months[d.getMonth()];
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (e) {
            return dateString;
        }
    };

    const addProjection = () => {
        onChange([...projections, { "Projection date": "", "Amount in USD": "", "Previous Projection Date": "", "Previous Amount in USD": "", "Action Date": "" }]);
    };

    const updateProjection = (index, field, value) => {
        const newProjections = [...projections];
        newProjections[index][field] = value;
        onChange(newProjections);
    };

    const roundProjectionAmount = (index) => {
        const proj = projections[index];
        const displayVal = proj["_displayAmount"] !== undefined ? proj["_displayAmount"] : proj["Amount in USD"];
        
        if (displayVal === null || displayVal === undefined || String(displayVal).trim() === "") return;
        
        const cleaned = String(displayVal).replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);
        if (!Number.isFinite(parsed)) return;
        
        const newProjections = [...projections];
        newProjections[index]["_displayAmount"] = String(Math.round(parsed * 100) / 100);
        onChange(newProjections);
    };

    const handleApprove = async (index, actionId) => {
        if (!actionId) {
            alert("Missing action reference for approval.");
            return;
        }
        setApproving(prev => ({ ...prev, [index]: true }));
        try {
            const res = await api.approveProjectionUpdate(actionId);
            if (res && res.success) {
                const proj = projections[index];
                if (proj["Change Type"] === "Delete") {
                    // Remove it from the UI immediately upon approval
                    const newProjections = projections.filter((_, i) => i !== index);
                    onChange(newProjections);
                } else {
                    updateProjection(index, "Is Approved", true);
                }
            } else {
                const message = res?.error || "Approval failed. Please try again.";
                alert("Failed to approve: " + message);
            }
        } catch (e) {
            const message = e?.message || e?.toString?.() || "Unknown error";
            alert("Error approving update: " + message);
        } finally {
            setApproving(prev => ({ ...prev, [index]: false }));
        }
    };

    return (
        <div className="space-y-3">
            <AnimatePresence>
                {projections.map((proj, index) => {
                    const isChanged = !proj["Is Approved"] && (proj["Action Date"] || proj["Action Timestamp"]);
                    const isDeleted = proj["Change Type"] === "Delete";
                    
                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`grid grid-cols-1 sm:grid-cols-3 gap-3 items-end p-4 rounded-lg relative group transition-all duration-300 pt-7 hover:z-[100] z-10
                                ${isChanged 
                                    ? isDeleted 
                                        ? "bg-red-900/20 border border-red-500/50 shadow-[0_4px_30px_rgba(239,68,68,0.2)] backdrop-blur-md opacity-80"
                                        : "bg-red-500/10 border border-red-500/30 shadow-[0_4px_30px_rgba(239,68,68,0.1)] backdrop-blur-md" 
                                    : "bg-white/5 border border-white/5"
                                }`}
                        >
                            {/* Actions / Info Icon (Absolute Top Right) */}
                            {isChanged && (
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    {isDeleted && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">
                                            Deleted
                                        </span>
                                    )}
                                    {isAdmin && (
                                        <button
                                            type="button"
                                            onClick={() => handleApprove(index, proj["Action ID"])}
                                            disabled={approving[index]}
                                            className="text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 p-1 rounded transition-colors disabled:opacity-50 flex items-center gap-1 text-[10px] font-medium"
                                            title="Approve this projection change"
                                        >
                                            <Check size={14} />
                                            {approving[index] ? 'Approving...' : 'Approve'}
                                        </button>
                                    )}
                                    <div
                                        data-tooltip-id={`tooltip-${index}`}
                                        data-tooltip-html={`Prev Date: ${formatDateForDisplay(proj["Previous Projection Date"])}<br/>Prev Amt (${amountCurrency}): ${proj["Previous Amount in USD"] || 'N/A'}<br/>Action Date: ${formatDateForDisplay(proj["Action Date"] || proj["Action Timestamp"])}<br/>Change: ${proj["Change Type"]}`}
                                        className="text-red-400/80 hover:text-red-400 cursor-help bg-red-500/10 rounded-full p-1"
                                    >
                                        <Info size={14} />
                                    </div>
                                    <Tooltip id={`tooltip-${index}`} place="top" className="z-50 max-w-xs text-xs text-left" />
                                </div>
                            )}

                            <div className="w-full">
                                <label className="text-xs text-gray-500 mb-1 block">Date</label>
                                <DateInput
                                    value={proj["Projection date"]}
                                    onChange={(e) => !isDeleted && updateProjection(index, "Projection date", e.target.value)}
                                    className={`h-9 text-sm ${isDeleted ? "line-through opacity-60 cursor-not-allowed" : ""}`}
                                    readOnly={isDeleted}
                                />
                            </div>
                            <div className="w-full relative">
                                <label className="text-xs text-gray-500 block mb-1">{`Amount in ${amountCurrency}`}</label>
                                <Input
                                    type="text"
                                    value={proj["_displayAmount"] !== undefined ? proj["_displayAmount"] : proj["Amount in USD"]}
                                    onChange={(e) => {
                                        if (isDeleted) return;
                                        const val = e.target.value;
                                        const newProjections = [...projections];
                                        
                                        newProjections[index]["_displayAmount"] = val;
                                        newProjections[index]["_tempPercentage"] = undefined;
                                        
                                        const displayAmount = parseFloat(val) || 0;
                                        
                                        // Update the underlying USD amount based on what currency we are currently typing in
                                        let amountUsd = displayAmount;
                                        if (amountCurrency === "INR") {
                                            amountUsd = displayAmount / exchangeRates["USD"];
                                        } else if (amountCurrency === "Home") {
                                            const rateToInr = exchangeRates[projectHomeCurrency] || exchangeRates["USD"];
                                            const inrAmount = displayAmount * rateToInr;
                                            amountUsd = inrAmount / exchangeRates["USD"];
                                        }
                                        
                                        newProjections[index]["Amount in USD"] = amountUsd ? String(Math.round(amountUsd * 100) / 100) : "";
                                        
                                        onChange(newProjections);
                                    }}
                                    onBlur={() => !isDeleted && roundProjectionAmount(index)}
                                    className={`h-9 text-sm ${isDeleted ? "line-through opacity-60 cursor-not-allowed" : ""}`}
                                    placeholder="0"
                                    readOnly={isDeleted}
                                />
                            </div>
                            <div className="w-full relative">
                                <label className="text-xs text-gray-500 block mb-1">% of Total</label>
                                <div className="relative">
                                    <Input
                                         type="text"
                                         value={
                                             proj._tempPercentage !== undefined
                                                 ? proj._tempPercentage
                                                 : (() => {
                                                     const rawDisplay = proj["_displayAmount"] !== undefined ? proj["_displayAmount"] : proj["Amount in USD"];
                                                     if (!rawDisplay || isNaN(parseFloat(rawDisplay)) || !projectTotalHome || projectTotalHome <= 0) return "";
                                                     
                                                     const amountDisplay = parseFloat(String(rawDisplay).replace(/[^0-9.-]+/g, ""));
                                                     
                                                     // The cleanest way to ensure percentage is constant is to always compare USD to USD
                                                     const amountUsd = parseFloat(String(proj["Amount in USD"]).replace(/[^0-9.-]+/g, "")) || 0;
                                                     
                                                     const rateToInr = exchangeRates[projectHomeCurrency] || exchangeRates["USD"];
                                                     const projectTotalUsd = (projectTotalHome * rateToInr) / exchangeRates["USD"];
                                                     
                                                     if (projectTotalUsd > 0) {
                                                         return String(Math.round((amountUsd / projectTotalUsd) * 10000) / 100);
                                                     }
                                                     return "";
                                                 })()
                                         }
                                        onChange={(e) => {
                                             if (isDeleted) return;
                                             const rawValue = e.target.value;
                                             const newProjections = [...projections];
                                             newProjections[index]["_tempPercentage"] = rawValue;
                                             
                                             const percentage = parseFloat(rawValue) || 0;
                                             if (projectTotalHome > 0) {
                                                 const rateToInr = exchangeRates[projectHomeCurrency] || exchangeRates["USD"];
                                                 const projectTotalUsd = (projectTotalHome * rateToInr) / exchangeRates["USD"];
                                                 
                                                 const calculatedUsdAmount = (projectTotalUsd * percentage) / 100;
                                                 
                                                 newProjections[index]["Amount in USD"] = String(Math.round(calculatedUsdAmount * 100) / 100);
                                                 
                                                 // Convert to current display currency
                                                 let displayAmount = calculatedUsdAmount;
                                                 if (amountCurrency === "INR") {
                                                     displayAmount = calculatedUsdAmount * exchangeRates["USD"];
                                                 } else if (amountCurrency === "Home") {
                                                     const inrAmount = calculatedUsdAmount * exchangeRates["USD"];
                                                     displayAmount = inrAmount / rateToInr;
                                                 }
                                                 
                                                 newProjections[index]["_displayAmount"] = String(Math.round(displayAmount * 100) / 100);
                                             }
                                             onChange(newProjections);
                                         }}
                                        onBlur={(e) => {
                                            if (isDeleted) return;
                                            updateProjection(index, "_tempPercentage", undefined);
                                            roundProjectionAmount(index);
                                        }}
                                        className={`h-9 text-sm pr-6 ${isDeleted ? "line-through opacity-60 cursor-not-allowed" : ""}`}
                                        placeholder="0.00"
                                        readOnly={isDeleted}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">%</span>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            <button
                type="button"
                onClick={addProjection}
                className="w-full py-2 border border-dashed border-white/20 rounded-lg text-sm text-gray-400 hover:text-white hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
            >
                <Plus size={16} /> Add Projection
            </button>
        </div>
    );
}
