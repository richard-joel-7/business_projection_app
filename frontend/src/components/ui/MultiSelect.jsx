import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";

export function MultiSelect({ label, options, value = [], onChange, placeholder = "Select options", maintainOrder = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Helper to get option value and label
    const getOptionValue = (option) => (typeof option === 'object' ? option.value : option);
    const getOptionLabel = (option) => (typeof option === 'object' ? option.label : option);
    // A selected item is stored by value, so resolve it back to its label before showing it.
    // For plain string options the two are the same, which keeps every existing caller as-is.
    const labelFor = (v) => {
        const match = options.find(o => getOptionValue(o) === v);
        return match === undefined ? v : getOptionLabel(match);
    };

    // Sort options alphabetically unless maintainOrder is true
    const sortedOptions = maintainOrder ? options : [...options].sort((a, b) => {
        const labelA = getOptionLabel(a).toLowerCase();
        const labelB = getOptionLabel(b).toLowerCase();
        if (labelA < labelB) return -1;
        if (labelA > labelB) return 1;
        return 0;
    });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (option) => {
        const optionValue = getOptionValue(option);
        const newValue = value.includes(optionValue)
            ? value.filter(v => v !== optionValue)
            : [...value, optionValue];
        onChange(newValue);
    };


    const clearAll = (e) => {
        e.stopPropagation();
        onChange([]);
    };

    // Selections render as chips INSIDE the control, with a "+N" once there are more than
    // will fit. Keeping them in the button means the control is a fixed height however many
    // are picked, so choosing filters never pushes the content below it down the page.
    const MAX_CHIPS = 2;
    const allLabels = value.map(labelFor).join(", ");

    return (
        <div className="space-y-1.5" ref={containerRef}>
            {label && <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    title={value.length > 0 ? allLabels : undefined}
                    className={`w-full bg-white/5 border ${isOpen ? 'border-primary/50 ring-1 ring-primary/20' : 'border-white/10'} rounded-lg px-3 py-2 text-left flex justify-between items-center gap-2 transition-all hover:bg-white/10 text-sm`}
                >
                    <span className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                        {value.length === 0 ? (
                            <span className="text-gray-500 text-xs truncate">{placeholder}</span>
                        ) : (
                            <>
                                {value.slice(0, MAX_CHIPS).map((item) => (
                                    <span
                                        key={item}
                                        className="shrink-0 max-w-[8rem] truncate px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-medium"
                                    >
                                        {labelFor(item)}
                                    </span>
                                ))}
                                {value.length > MAX_CHIPS && (
                                    <span className="shrink-0 px-1.5 py-0.5 bg-white/10 text-gray-300 border border-white/15 rounded text-[10px] font-medium">
                                        +{value.length - MAX_CHIPS}
                                    </span>
                                )}
                            </>
                        )}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {value.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="p-1 hover:bg-red-500/20 rounded transition-colors text-red-400"
                                title="Clear all"
                            >
                                <X size={12} />
                            </button>
                        )}
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-[80] w-full mt-2 left-0 bg-[#0A0A0A] border border-white/20 rounded-lg shadow-2xl overflow-hidden ring-1 ring-white/10"
                            style={{ position: 'absolute' }}
                        >
                            <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                                {sortedOptions.map((option) => {
                                    const optionValue = getOptionValue(option);
                                    const optionLabel = getOptionLabel(option);
                                    const isSelected = value.includes(optionValue);
                                    return (
                                    <button
                                        key={optionValue}
                                        type="button"
                                        onClick={() => toggleOption(option)}
                                        className={`w-full px-3 py-2 text-left hover:bg-white/10 flex justify-between items-center transition-colors ${isSelected ? 'bg-primary/10' : ''
                                            }`}
                                    >
                                        <span className={isSelected ? "text-primary font-medium text-xs" : "text-gray-300 text-xs"}>
                                            {optionLabel}
                                        </span>
                                        {isSelected && (
                                            <div className="w-4 h-4 rounded bg-primary flex items-center justify-center flex-shrink-0">
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
