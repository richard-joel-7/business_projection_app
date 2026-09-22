import React, { useState, useEffect, useRef } from 'react';
import { parseDate, formatDayMonthYear } from '../../lib/utils';

export function DateInput({ label, error, value, onChange, placeholder, className, ...props }) {
    const [inputType, setInputType] = useState('text');
    const [displayValue, setDisplayValue] = useState('');
    const inputRef = useRef(null);

    // Format date for display: dd MMM yyyy (e.g., 03 Sep 2026)
    const formatDisplayDate = (dateString) => {
        if (!dateString) return '';
        const date = parseDate(dateString);
        if (!date) return dateString;
        return formatDayMonthYear(date);
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
        <div className="flex flex-col gap-1.5 w-full">
            {label && <label className="text-sm font-medium text-gray-300 ml-1">{label}</label>}
            <div className="relative w-full">
                <input
                    ref={inputRef}
                    type={inputType}
                    // [color-scheme:dark] tells the browser to draw its native date-picker
                    // icon (and calendar popup) in light-on-dark colours -- without it the
                    // icon defaults to black and disappears against this dark input.
                    className={`w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all [color-scheme:dark] ${className}`}
                    placeholder={inputType === 'date' ? '' : (placeholder || 'dd MMM yyyy')}
                    value={inputType === 'date' ? formatInputDate(value) : displayValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    {...props}
                />
            </div>
            {error && <span className="text-xs text-red-400 ml-1">{error}</span>}
        </div>
    );
}
