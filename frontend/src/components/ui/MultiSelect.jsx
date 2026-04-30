import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";

export function MultiSelect({ label, options, value = [], onChange, placeholder = "Select options", maintainOrder = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Helper to get option value and label
    const getOptionValue = (option) => (typeof option === 'object' ? option.value : option);
    const getOptionLabel = (option) => (typeof option === 'object' ? option.label : option);

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

    const removeOption = (optionValue, e) => {
        e.stopPropagation();
        onChange(value.filter(v => v !== optionValue));
    };

    const clearAll = (e) => {
        e.stopPropagation();
        onChange([]);
    };

    const getDisplayText = () => {
        if (value.length === 0) return placeholder;
        if (value.length === 1) return value[0]; // You might want to map this back to label if possible, but value is fine for now
        return `${value.length} selected`;
    };

    return (
        <div className="space-y-1.5" ref={containerRef}>
            {label && <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full bg-white/5 border ${isOpen ? 'border-primary/50 ring-1 ring-primary/20' : 'border-white/10'} rounded-lg px-3 py-2 text-left flex justify-between items-center gap-2 transition-all hover:bg-white/10 text-sm`}
                >
                    <span className={value.length > 0 ? "text-white text-xs flex-1 truncate" : "text-gray-500 text-xs flex-1"}>
                        {getDisplayText()}
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

            {/* Selected items as tags */}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {value.map((item) => (
                        <span
                            key={item}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-[10px] font-medium"
                        >
                            {item}
                            <button
                                onClick={(e) => removeOption(item, e)}
                                className="hover:bg-primary/30 rounded-full p-0.5 transition-colors"
                            >
                                <X size={10} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
