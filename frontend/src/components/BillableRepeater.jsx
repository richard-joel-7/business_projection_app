import { useEffect, useState } from "react";
import { Input } from "./ui/Input";
import { DateInput } from "./ui/DateInput";
import { Select } from "./ui/Select";
import { Plus, Trash2, CheckCircle, Clock, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "react-tooltip";

export default function BillableRepeater({ billables, onChange, amountCurrency = "INR", onDelete, currentUser, userRole, project, onApproveChange }) {
    const projectHomeCurrency = project?.Home_Currency || project?.Currency || '';

    const addBin = () => {
        onChange([...billables, { binNumber: "", type: "", entries: [{ "Billable_date": "", "Billable_Amount_in_Home_Currency": "", "Home_Currency": projectHomeCurrency, "Amount_in_Inr": "", "Amount_in_USD": "", "Remarks": "", "Status": "", "Approved_to_Finance": "", "Approved by": "", "isApproving": false }] }]);
    };

    const addEntry = (binIndex) => {
        const newBillables = [...billables];
        newBillables[binIndex].entries.push({ "Billable_date": "", "Billable_Amount_in_Home_Currency": "", "Home_Currency": projectHomeCurrency, "Amount_in_Inr": "", "Amount_in_USD": "", "Remarks": "", "Status": "", "Approved_to_Finance": "", "Approved by": "", "isApproving": false });
        onChange(newBillables);
    };

    const updateBinField = (binIndex, field, value) => {
        const newBillables = [...billables];
        newBillables[binIndex][field] = value;
        onChange(newBillables);
    };

    const handleApproveEntry = (binIndex, entryIndex) => {
        updateEntry(binIndex, entryIndex, "isApproving", true);
    };

    const updateEntry = (binIndex, entryIndex, field, value) => {
        const newBillables = [...billables];
        newBillables[binIndex].entries[entryIndex][field] = value;
        onChange(newBillables);
    };

    const exchangeRates = {
        "INR": 0.012,
        "EUR": 1.07,
        "GBP": 1.35,
        "CAD": 0.74,
        "AUD": 0.67,
        "USD": 1
    };

    const handleAmountChange = (binIndex, entryIndex, value) => {
        const newBillables = [...billables];
        const cleaned = String(value).replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);
        
        newBillables[binIndex].entries[entryIndex]["Billable_Amount_in_Home_Currency"] = value;

        const rate = exchangeRates[projectHomeCurrency] || exchangeRates["USD"];
        
        if (Number.isFinite(parsed)) {
            // First convert to USD
            const usdAmount = parsed * rate;
            newBillables[binIndex].entries[entryIndex]["Amount_in_USD"] = String(Math.round(usdAmount));
            
            // Then convert USD to INR (since INR = 0.012 USD, INR amount = USD / 0.012)
            const inrRate = exchangeRates["INR"];
            newBillables[binIndex].entries[entryIndex]["Amount_in_Inr"] = String(Math.round(usdAmount / inrRate));
        } else {
            newBillables[binIndex].entries[entryIndex]["Amount_in_Inr"] = "";
            newBillables[binIndex].entries[entryIndex]["Amount_in_USD"] = "";
        }
        
        onChange(newBillables);
    };

    const roundAmount = (binIndex, entryIndex) => {
        const raw = billables[binIndex]?.entries[entryIndex]?.["Billable_Amount_in_Home_Currency"];
        if (raw === null || raw === undefined || String(raw).trim() === "") return;
        const cleaned = String(raw).replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);
        if (!Number.isFinite(parsed)) return;
        
        const newBillables = [...billables];
        newBillables[binIndex].entries[entryIndex]["Billable_Amount_in_Home_Currency"] = String(Math.round(parsed));
        onChange(newBillables);
    };

    const removeBin = (binIndex) => {
        const binGroup = billables[binIndex];
        if (onDelete) {
            binGroup.entries.forEach(entry => {
                if (entry.Billable_id) {
                    onDelete(entry.Billable_id);
                }
            });
        }
        const newBillables = [...billables];
        newBillables.splice(binIndex, 1);
        onChange(newBillables);
    };

    const removeEntry = (binIndex, entryIndex) => {
        const entry = billables[binIndex].entries[entryIndex];
        if (onDelete && entry.Billable_id) {
            onDelete(entry.Billable_id);
        }
        const newBillables = [...billables];
        newBillables[binIndex].entries.splice(entryIndex, 1);
        onChange(newBillables);
    };

    return (
        <div className="space-y-6">
            <AnimatePresence>
                {billables.map((binGroup, binIndex) => {
                    const roles = String(userRole || "").split(",").map(r => r.trim().toLowerCase());
                    const isAdminOrFinance = roles.includes('admin') || roles.includes('finance') || roles.includes('prod admin');
                    
                    // Calculate derived Bin Status for display
                    let binStatusDisplay = 'Billable';
                    if (binGroup.entries && binGroup.entries.length > 0) {
                        const statuses = binGroup.entries.map(e => e.Status);
                        if (statuses.every(s => s === 'Billed')) binStatusDisplay = 'Billed';
                        else if (statuses.includes('Billed')) binStatusDisplay = 'Partially Billed';
                    }

                    return (
                        <motion.div
                            key={binIndex}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4 relative"
                        >
                            {/* Bin Header */}
                            <div className="flex flex-col gap-3 border-b border-white/5 pb-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="w-full sm:w-1/3">
                                        <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-semibold">Bin Number</label>
                                        <Input
                                            type="text"
                                            value={binGroup.binNumber || ""}
                                            onChange={(e) => updateBinField(binIndex, "binNumber", e.target.value)}
                                            className="h-9 text-sm font-bold tracking-wide"
                                            placeholder="e.g. BIN-001"
                                        />
                                    </div>
                                    <div className="w-full sm:w-1/3">
                                        <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-semibold">Type</label>
                                        <Select
                                            value={binGroup.type || ""}
                                            onChange={(e) => updateBinField(binIndex, "type", e.target.value)}
                                            options={[
                                                { value: "", label: "Select Type" },
                                                { value: "Milestone", label: "Milestone" },
                                                { value: "Advance", label: "Advance" },
                                                { value: "Carry Forward", label: "Carry Forward" },
                                                { value: "Archive", label: "Archive" }
                                            ]}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="w-full sm:w-1/3">
                                        <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-semibold">Bin Status (Auto)</label>
                                        <div className={`h-9 px-3 py-1.5 rounded-md border border-white/10 bg-dark-800/50 flex items-center text-sm font-medium ${binStatusDisplay === 'Billed' ? 'text-green-400' : binStatusDisplay === 'Partially Billed' ? 'text-yellow-400' : 'text-blue-400'}`}>
                                            {binStatusDisplay}
                                        </div>
                                    </div>
                                    {roles.includes('admin') && (
                                        <button
                                            type="button"
                                            onClick={() => removeBin(binIndex)}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors flex items-center justify-center self-end sm:self-auto mt-2 sm:mt-0"
                                            title="Remove Bin"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                                    <div className="w-full">
                                        <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-semibold">Approved Cost Sheet (GDrive Link)</label>
                                        <Input
                                            type="url"
                                            value={binGroup.Approved_Cost_Sheet || ""}
                                            onChange={(e) => updateBinField(binIndex, "Approved_Cost_Sheet", e.target.value)}
                                            className="h-9 text-sm"
                                            placeholder="Paste GDrive link here..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Entries for this Bin */}
                            <div className="space-y-4">
                                {binGroup.entries.map((entry, entryIndex) => {
                                    const approvedList = entry['Approved by'] ? String(entry['Approved by']).replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean) : [];
                                    const hasApproved = approvedList.includes(currentUser);
                                    const isFullyApproved = entry['Approved_to_Finance'] === 'True' || approvedList.length >= 2;
                                    const hasUnapprovedChanges = entry["Action Date"] && entry["Is Approved"] === false;
                                    const isDeleted = entry["Change Type"] === "Delete";
                                    const isUnapproved = entry["Is Approved"] === false || String(entry["Is Approved"]).trim().toUpperCase() === "FALSE";
                                    const isChanged = isUnapproved && entry["Change Type"] && entry["Change Type"] !== 'New';

                                    return (
                                    <div key={entryIndex} className={`flex flex-col gap-4 p-4 rounded-lg transition-all duration-300 ${isChanged ? "bg-red-500/10 border border-red-500/30" : "bg-dark-800/30 border border-white/5"}`}>
                                        
                                        <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                {entry.Billable_id && (
                                                    <span className="text-[10px] font-bold text-primary/50 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                                        ID: {entry.Billable_id}
                                                    </span>
                                                )}
                                                {isChanged && isDeleted && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30">
                                                        Deleted
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                {isChanged && (
                                                    <>
                                                        {roles.includes('admin') && (
                                                            entry.isChangeApproving ? (
                                                                <span className="text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-1 rounded flex items-center gap-1 text-[10px] font-medium">
                                                                    <CheckCircle size={12} /> Save to Approve
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (!entry["Action ID"]) return;
                                                                        updateEntry(binIndex, entryIndex, "isChangeApproving", true);
                                                                    }}
                                                                    className="text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-2 py-1 rounded transition-colors flex items-center gap-1 text-[10px] font-medium"
                                                                    title="Approve this billable change"
                                                                >
                                                                    <CheckCircle size={12} /> Approve
                                                                </button>
                                                            )
                                                        )}
                                                        <div
                                                            data-tooltip-id={`tooltip-${binIndex}-${entryIndex}`}
                                                            data-tooltip-html={`Prev Date: ${entry["Previous Billable Date"] || 'N/A'}<br/>Prev Amt (${projectHomeCurrency}): ${entry["Previous Amount in Home Currency"] || 'N/A'}<br/>Action Date: ${entry["Action Date"] || 'N/A'}<br/>Change: ${entry["Change Type"]}`}
                                                            className="text-red-400/80 hover:text-red-400 cursor-help bg-red-500/10 rounded-full p-1 z-[99]"
                                                        >
                                                            <Info size={14} />
                                                        </div>
                                                        <Tooltip id={`tooltip-${binIndex}-${entryIndex}`} place="top" className="z-[99] max-w-xs text-xs text-left" />
                                                    </>
                                                )}
                                                {roles.includes('admin') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeEntry(binIndex, entryIndex)}
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-1.5 rounded transition-colors flex items-center justify-center"
                                                        title="Remove Entry"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                                            <div className="w-full">
                                                <label className="text-xs text-gray-500 mb-1 flex justify-between items-center">
                                                    <span>Billed Date</span>
                                                </label>
                                                <DateInput
                                                    value={entry.Billable_date || ""}
                                                    onChange={(e) => updateEntry(binIndex, entryIndex, "Billable_date", e.target.value)}
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                            <div className="w-full">
                                            <label className="text-xs text-gray-500 block mb-1">Home Currency</label>
                                            <Input
                                                type="text"
                                                value={projectHomeCurrency}
                                                disabled
                                                className="h-9 text-sm bg-dark-800/30 text-gray-400 cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="w-full">
                                            <label className="text-xs text-gray-500 block mb-1">{`Amount in ${projectHomeCurrency || 'Home Currency'}`}</label>
                                            <Input
                                                type="text"
                                                value={entry.Billable_Amount_in_Home_Currency || ""}
                                                onChange={(e) => handleAmountChange(binIndex, entryIndex, e.target.value)}
                                                onBlur={() => roundAmount(binIndex, entryIndex)}
                                                className="h-9 text-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="w-full">
                                            <label className="text-xs text-gray-500 block mb-1">% of Total</label>
                                            <div className="relative">
                                                <Input
                                                    type="text"
                                                    value={
                                                        (() => {
                                                            const projectTotalHome = parseFloat(String(project?.Home_Amount || project?.["Value in Home Currency"] || "0").replace(/[^0-9.-]+/g, "")) || 0;
                                                            const entryHome = parseFloat(String(entry.Billable_Amount_in_Home_Currency || "0").replace(/[^0-9.-]+/g, "")) || 0;
                                                            if (projectTotalHome > 0) {
                                                                return ((entryHome / projectTotalHome) * 100).toFixed(2);
                                                            }
                                                            return "0.00";
                                                        })()
                                                    }
                                                    disabled
                                                    className="h-9 text-sm bg-dark-800/30 text-gray-400 cursor-not-allowed pr-6"
                                                    placeholder="0.00"
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-gray-500 font-medium">%</span>
                                            </div>
                                        </div>
                                    </div>

                                        <div className="w-full sm:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="w-full">
                                                <label className="text-xs text-gray-500 block mb-1">Remarks</label>
                                                <Input
                                                    type="text"
                                                    value={entry.Remarks || ""}
                                                    onChange={(e) => updateEntry(binIndex, entryIndex, "Remarks", e.target.value)}
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                            <div className="w-full">
                                                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                                                    <Select
                                                        value={entry.Status || "Billable"}
                                                        onChange={(e) => updateEntry(binIndex, entryIndex, "Status", e.target.value)}
                                                        options={[
                                                            { value: "Billable", label: "Billable" },
                                                            { value: "Billed", label: `Billed ${!isAdminOrFinance ? '(Admin/Finance Only)' : ''}`, disabled: !isAdminOrFinance }
                                                        ]}
                                                        className="h-9 text-sm w-full"
                                                    />
                                                </div>
                                        </div>
                                        
                                        <div className="w-full sm:col-span-4 flex items-center gap-2 mt-2 pt-3 border-t border-white/5">
                                            {isFullyApproved ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                                                    <CheckCircle size={12} /> Approved
                                                </div>
                                            ) : entry['Approved_to_Finance'] === 'Partially Approved' || approvedList.length === 1 ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold uppercase tracking-wider">
                                                    <Clock size={12} /> Partially Approved
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-500/10 border border-gray-500/20 text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                                                    <Clock size={12} /> Pending Approval
                                                </div>
                                            )}
                                            {entry['Approved by'] && (
                                                <span className="text-[10px] text-gray-500 font-medium">By: {String(entry['Approved by']).replace(/[\[\]]/g, '')}</span>
                                            )}
                                            
                                            <div className="ml-auto flex items-center gap-3 text-right">
                                                <div className="text-[12px] font-bold text-gray-400">
                                                    {amountCurrency === 'INR' ? '\u20B9' : '$'}
                                                    {amountCurrency === 'INR' ? (entry.Amount_in_Inr || 0) : (entry.Amount_in_USD || 0)}
                                                </div>
                                                {!hasApproved && !isFullyApproved && roles.includes('admin') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!project?.Client && !project?.client_name) {
                                                                alert("Please update the Client details for the deal in CRM before approving.");
                                                                return;
                                                            }
                                                            handleApproveEntry(binIndex, entryIndex);
                                                        }}
                                                        disabled={entry.isApproving}
                                                        className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 text-xs font-semibold ${entry.isApproving ? "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 cursor-not-allowed" : "text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20"}`}
                                                    >
                                                        <CheckCircle size={14} />
                                                        {entry.isApproving ? "Save to Approve" : "Approve Entry"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                                
                                <button
                                    type="button"
                                    onClick={() => addEntry(binIndex)}
                                    className="w-full sm:w-auto py-1.5 px-3 border border-dashed border-white/20 rounded text-xs text-primary/80 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5 ml-auto"
                                >
                                    <Plus size={14} /> Add Entry to Bin
                                </button>
                            </div>
                            </motion.div>
                        );
                    })}
            </AnimatePresence>

            <button
                type="button"
                onClick={addBin}
                className="w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
                <Plus size={18} /> Add New Bin Number
            </button>
        </div>
    );
}
