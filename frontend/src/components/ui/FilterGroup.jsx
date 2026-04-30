import React from 'react';
import { motion } from 'framer-motion';

export function FilterGroup({ label, options, selectedValues, onChange }) {
    const toggleValue = (value) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newValues);
    };

    return (
        <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const isSelected = selectedValues.includes(option);
                    return (
                        <button
                            key={option}
                            onClick={() => toggleValue(option)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isSelected
                                    ? 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_10px_rgba(52,211,153,0.2)]'
                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200'
                                }`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
