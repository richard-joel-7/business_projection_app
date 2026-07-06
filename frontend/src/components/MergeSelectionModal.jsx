import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Search, CheckSquare } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export default function MergeSelectionModal({ finances, onClose, onConfirm }) {
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Filter available billables based on search
    const filteredFinances = useMemo(() => {
        if (!search.trim()) return []; // Maybe return empty or top 50, let's return all if we want, but better to require search if many. Let's return all for now to let user scroll if they want, but prioritize search.
        
        const s = search.toLowerCase();
        return finances.filter(item => {
            return (
                (item.BlockName && item.BlockName.toLowerCase().includes(s)) ||
                (item.Billable_id && item.Billable_id.toLowerCase().includes(s)) ||
                (item.Bin_number && String(item.Bin_number).toLowerCase().includes(s))
            );
        });
    }, [finances, search]);

    const displayFinances = search.trim() ? filteredFinances : finances.slice(0, 100); // Show max 100 if no search to avoid lag

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        const selected = finances.filter(f => selectedIds.has(f.Billable_id));
        onConfirm(selected);
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass-panel rounded-2xl w-full max-w-4xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] flex flex-col max-h-[85vh]"
            >
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-dark-900 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            Merge Billables
                        </h2>
                        <div className="text-sm text-gray-400 mt-1">
                            Search by Project Name or Bin Number to select multiple billables to merge into a single invoice.
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 border-b border-white/10 shrink-0">
                    <div className="relative w-full group">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Type Project Name, Bin Number, or Billable ID..."
                            className="pl-12 bg-dark-800/50 border-white/5 focus:bg-dark-800 w-full text-lg"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="mt-4 flex justify-between items-center text-sm text-gray-400">
                        <span>Showing {displayFinances.length} billables</span>
                        <span className="text-primary font-medium">{selectedIds.size} Selected</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {displayFinances.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No billables found matching your search.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {displayFinances.map(item => {
                                const isSelected = selectedIds.has(item.Billable_id);
                                return (
                                    <div 
                                        key={item.Billable_id}
                                        onClick={() => toggleSelection(item.Billable_id)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                                            isSelected 
                                                ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(52,211,153,0.1)]' 
                                                : 'bg-dark-800/50 border-white/5 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 transition-colors ${
                                            isSelected ? 'bg-primary border-primary text-white' : 'border-gray-600 text-transparent'
                                        }`}>
                                            <CheckSquare size={16} />
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">Project</div>
                                                <div className="text-sm font-bold text-white">{item.BlockName || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">Bin Number</div>
                                                <div className="text-sm text-gray-300 font-mono">{item.Bin_number || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">Billable Date</div>
                                                <div className="text-sm text-gray-300">{item.Billable_date || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">Amount</div>
                                                <div className="text-sm text-emerald-400 font-mono">
                                                    {item.Billable_Amount_in_Home_Currency} <span className="text-[10px] text-gray-500">{item.Home_Currency}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 bg-dark-900 shrink-0 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={selectedIds.size === 0}
                    >
                        Confirm Selection ({selectedIds.size})
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
