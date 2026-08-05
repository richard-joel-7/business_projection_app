import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function parseDate(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    // Check for "09 Sept 2026" or "09 Sep 2026" format
    const strMonthMatch = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
    if (strMonthMatch) {
        const day = parseInt(strMonthMatch[1], 10);
        const monthStr = strMonthMatch[2].substring(0, 3).toLowerCase();
        const year = parseInt(strMonthMatch[3], 10);
        
        const monthMap = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        
        const month = monthMap[monthStr];
        if (month !== undefined) {
            return new Date(year, month, day);
        }
    }

    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10) - 1;
        const d = parseInt(isoMatch[3], 10);
        return new Date(y, m, d);
    }

    const ddmmyyyyMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
        const year = parseInt(ddmmyyyyMatch[3], 10);
        return new Date(year, month, day);
    }

    const mdyyyyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyyyyMatch) {
        const month = parseInt(mdyyyyMatch[1], 10) - 1;
        const day = parseInt(mdyyyyMatch[2], 10);
        const year = parseInt(mdyyyyMatch[3], 10);
        return new Date(year, month, day);
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

export function getFY(date) {
    if (!date) return 'Unknown';
    const m = date.getMonth();
    const y = date.getFullYear();
    const fyYear = m >= 3 ? y : y - 1;
    return `FY-${String(fyYear).slice(-2)}`;
}

export function getCY(date) {
    if (!date) return 'Unknown';
    const y = date.getFullYear();
    return `CY-${String(y).slice(-2)}`;
}

export function getQuarter(date, isCY = false) {
    if (!date) return null;
    const m = date.getMonth();
    if (isCY) {
        if (m >= 0 && m <= 2) return 'Q1';
        if (m >= 3 && m <= 5) return 'Q2';
        if (m >= 6 && m <= 8) return 'Q3';
        return 'Q4';
    } else {
        if (m >= 3 && m <= 5) return 'Q1';
        if (m >= 6 && m <= 8) return 'Q2';
        if (m >= 9 && m <= 11) return 'Q3';
        return 'Q4';
    }
}

export function getLocale(currencyStr) {
    return String(currencyStr).toUpperCase() === 'INR' ? 'en-IN' : 'en-US';
}
