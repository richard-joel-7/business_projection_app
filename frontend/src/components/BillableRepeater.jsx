import { useEffect, useState } from "react";
import { Input } from "./ui/Input";
import { DateInput } from "./ui/DateInput";
import { Select } from "./ui/Select";
import { Plus, Trash2, CheckCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BillableRepeater({ billables, onChange, amountCurrency = "INR", onDelete, currentUser }) {
    const addBin = () => {
        onChange([...billables, { binNumber: "", type: "", status: "", remarks: "", approvedToFinance: "", approvedBy: "", isApproving: false, entries: [{ "Billable_date": "", "Amount_in_Inr": "", "Amount_in_USD": "" }] }]);
    };

    const addEntry = (binIndex) => {
        const newBillables = [...billables];
        newBillables[binIndex].entries.push({ "Billable_date": "", "Amount_in_Inr": "", "Amount_in_USD": "" });
        onChange(newBillables);
    };

    const updateBinField = (binIndex, field, value) => {
        const newBillables = [...billables];
        newBillables[binIndex][field] = value;
        onChange(newBillables);
    };

    const handleApproveBin = (binIndex) => {
        updateBinField(binIndex, "isApproving", true);
    };

    const updateEntry = (binIndex, entryIndex, field, value) => {
        const newBillables = [...billables];
        newBillables[binIndex].entries[entryIndex][field] = value;
        onChange(newBillables);
    };

    const handleAmountChange = (binIndex, entryIndex, value) => {
        const newBillables = [...billables];
        const cleaned = String(value).replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);

        if (amountCurrency === "INR") {
            newBillables[binIndex].entries[entryIndex]["Amount_in_Inr"] = value;
            if (Number.isFinite(parsed)) {
                newBillables[binIndex].entries[entryIndex]["Amount_in_USD"] = String(Math.round(parsed * 0.012));
            } else {
                newBillables[binIndex].entries[entryIndex]["Amount_in_USD"] = "";
            }
        } else {
            newBillables[binIndex].entries[entryIndex]["Amount_in_USD"] = value;
            if (Number.isFinite(parsed)) {
                newBillables[binIndex].entries[entryIndex]["Amount_in_Inr"] = String(Math.round(parsed / 0.012));
            } else {
                newBillables[binIndex].entries[entryIndex]["Amount_in_Inr"] = "";
            }
        }
        onChange(newBillables);
    };

    const roundAmount = (binIndex, entryIndex) => {
        const field = amountCurrency === "INR" ? "Amount_in_Inr" : "Amount_in_USD";
        const raw = billables[binIndex]?.entries[entryIndex]?.[field];
        if (raw === null || raw === undefined || String(raw).trim() === "") return;
        const cleaned = String(raw).replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);
        if (!Number.isFinite(parsed)) return;
        
        const newBillables = [...billables];
        newBillables[binIndex].entries[entryIndex][field] = String(Math.round(parsed));
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
                    const approvedList = binGroup.approvedBy ? String(binGroup.approvedBy).replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean) : [];
                    const hasApproved = approvedList.includes(currentUser);
                    const isFullyApproved = binGroup.approvedToFinance === 'True';

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
                                        <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-semibold">Status</label>
                                        <Select
                                            value={binGroup.status || ""}
                                            onChange={(e) => updateBinField(binIndex, "status", e.target.value)}
                                            options={[
                                                { value: "", label: "Select Status" },
                                                { value: "Billable", label: "Billable" },
                                                { value: "Billed", label: "Billed" }
                                            ]}
                                            className="h-9"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeBin(binIndex)}
                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors flex items-center justify-center self-end sm:self-auto mt-2 sm:mt-0"
                                        title="Remove Bin"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="w-full mt-1">
                                    <label className="text-xs text-gray-500 mb-1 block uppercase tracking-wider font-semibold">Remarks</label>
                                    <Input
                                        type="text"
                                        value={binGroup.remarks || ""}
                                        onChange={(e) => updateBinField(binIndex, "remarks", e.target.value)}
                                        className="h-9 text-sm"
                                        placeholder="Add any remarks for this bin..."
                                    />
                                </div>
                                {/* Approval Status Badge & Action */}
                                <div className="flex items-center gap-2 mt-1">
                                    {binGroup.approvedToFinance === 'True' ? (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                                            <CheckCircle size={12} /> Approved
                                        </div>
                                    ) : binGroup.approvedToFinance === 'Partially Approved' ? (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold uppercase tracking-wider">
                                            <Clock size={12} /> Partially Approved
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-500/10 border border-gray-500/20 text-gray-400 text-[10px] font-semibold uppercase tracking-wider">
                                            <Clock size={12} /> Pending Approval
                                        </div>
                                    )}
                                    {binGroup.approvedBy && (
                                        <span className="text-[10px] text-gray-500 font-medium">By: {String(binGroup.approvedBy).replace(/[\[\]]/g, '')}</span>
                                    )}
                                    {!isFullyApproved && !hasApproved && !binGroup.isApproving && (
                                        <button
                                            type="button"
                                            onClick={() => handleApproveBin(binIndex)}
                                            className="ml-auto px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded text-[10px] uppercase tracking-wider font-bold transition-colors flex items-center gap-1"
                                        >
                                            <CheckCircle size={12} /> Approve Bin
                                        </button>
                                    )}
                                    {binGroup.isApproving && (
                                        <span className="ml-auto px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] uppercase tracking-wider font-bold flex items-center gap-1">
                                            Queued for Approval (Save to apply)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Entries for this Bin */}
                        <div className="space-y-3">
                            {binGroup.entries.map((entry, entryIndex) => (
                                <div key={entryIndex} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end p-3 bg-dark-800/30 rounded-lg border border-white/5 relative">
                                    {entry.Billable_id && (
                                        <div className="absolute top-2 right-10 text-[10px] font-bold text-primary/50 bg-primary/10 px-2 py-0.5 rounded">
                                            ID: {entry.Billable_id}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeEntry(binIndex, entryIndex)}
                                        className="absolute top-2 right-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 p-1 rounded transition-colors"
                                        title="Remove Entry"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="w-full">
                                        <label className="text-xs text-gray-500 mb-1 block">Billable Date</label>
                                        <DateInput
                                            value={entry.Billable_date || ""}
                                            onChange={(e) => updateEntry(binIndex, entryIndex, "Billable_date", e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                    </div>
                                    <div className="w-full">
                                        <label className="text-xs text-gray-500 block mb-1">{`Amount in ${amountCurrency}`}</label>
                                        <Input
                                            type="text"
                                            value={amountCurrency === "INR" ? (entry.Amount_in_Inr || "") : (entry.Amount_in_USD || "")}
                                            onChange={(e) => handleAmountChange(binIndex, entryIndex, e.target.value)}
                                            onBlur={() => roundAmount(binIndex, entryIndex)}
                                            className="h-9 text-sm"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            ))}
                            
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
