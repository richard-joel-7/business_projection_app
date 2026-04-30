import React, { useState, useEffect, useRef } from 'react';
import { parseDate } from '../../lib/utils';

export function DateInput({ value, onChange, placeholder, className, ...props }) {
    const [inputType, setInputType] = useState('text');
    const [displayValue, setDisplayValue] = useState('');
    const inputRef = useRef(null);

    // Format date for display: dd MMM yyyy (e.g., 03 Sep 2026)
    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';
        const date = parseDate(dateString);
        if (!date) return dateString;
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Format for input type="date": yyyy-mm-dd
    const formatInputDate = (dateString) => {
        if (!dateString) return '';
        const date = parseDate(dateString);
        if (!date) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    useEffect(() => {
        setDisplayValue(formatDisplayDate(value));
    }, [value]);

    const handleFocus = () => {
        setInputType('date');
    };

    const handleBlur = () => {
        setInputType('text');
        setDisplayValue(formatDisplayDate(value));
    };

    const handleChange = (e) => {
        onChange(e);
    };

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type={inputType}
                className={`w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all ${className}`}
                placeholder={inputType === 'date' ? '' : (placeholder || 'dd MMM yyyy')}
                value={inputType === 'date' ? formatInputDate(value) : displayValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                {...props}
            />
        </div>
    );
}
