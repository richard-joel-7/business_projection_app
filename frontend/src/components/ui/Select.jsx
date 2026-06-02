import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Search } from "lucide-react";

export function Select({ label, name, options, value, onChange, placeholder = "Select option", required, searchable = false, className = "", disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        if (!isOpen) {
            setSearchQuery("");
        }
    }, [isOpen, searchable]);

    const handleSelect = (optionValue) => {
        if (disabled) return;
        onChange({ target: { name: name || label, value: optionValue } });
        setIsOpen(false);
    };

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = searchable
        ? options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : options;

    return (
        <div className="flex flex-col gap-1.5 min-w-0" ref={containerRef}>
            {label && <label className="text-sm font-medium text-gray-300 ml-1">{label} {required && <span className="text-primary">*</span>}</label>}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`w-full min-w-0 bg-white/5 border ${isOpen ? 'border-primary/50 ring-2 ring-primary/20' : 'border-white/10'} rounded-xl px-4 py-3 text-left flex justify-between items-center transition-all hover:bg-white/10 ${className} ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                >
                    <span className={`block min-w-0 truncate pr-2 ${selectedOption ? "text-white" : "text-gray-500"}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                    {isOpen && !disabled && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-2 bg-[#0A0A0A] border border-white/20 rounded-lg shadow-2xl overflow-hidden ring-1 ring-white/10"
                        >
                            {searchable && (
                                <div className="p-2 border-b border-white/10 sticky top-0 bg-[#0A0A0A] z-10">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search..."
                                            className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-primary/50 placeholder-gray-600"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="max-h-60 overflow-y-auto py-1">
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleSelect(option.value)}
                                            className="w-full px-4 py-2 text-left hover:bg-white/10 flex justify-between items-center group transition-colors"
                                        >
                                            <span className={option.value === value ? "text-primary font-medium" : "text-gray-300 group-hover:text-white"}>
                                                {option.label}
                                            </span>
                                            {option.value === value && <Check size={16} className="text-primary" />}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">No options found</div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
