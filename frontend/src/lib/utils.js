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

// Canonical short month names. Never derive these from toLocaleString/toLocaleDateString:
// under ICU 72+ (Chrome 110+) the en-IN and en-GB locales abbreviate September as "Sept",
// which silently misses any bucket, filter or lookup keyed on "Sep".
export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Financial-year month order (April to March).
export const MONTHS_SHORT_FY = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

// Locale-independent short month name for a Date. Use this for every aggregation key,
// filter value and comparison so the same token is produced in every browser.
export function getMonthShort(date) {
    if (!date) return '';
    return MONTHS_SHORT[date.getMonth()] || '';
}

// Locale-independent "dd MMM yyyy" for display (e.g. 04 Sep 2026).
export function formatDayMonthYear(date) {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    return `${day} ${getMonthShort(date)} ${date.getFullYear()}`;
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

// --- Currency ---
//
// Single source of truth for the app's fixed home-currency -> INR rates.
// Production Hub (billable entry AND display) and Business Hub both use these, so a
// stored Amount_in_Inr always equals what the hubs show. Finance Hub is deliberately
// different: it keeps a per-invoice Exchange_Rate typed in by Finance, because that is
// the rate the invoice was actually raised at.
//
// If Production Hub later gains a manual rate per billable (the same way Finance Hub
// works), it should be multiplied at entry and stored in Amount_in_Inr. The display
// paths already read Amount_in_Inr first, so nothing downstream needs to change.
export const EXCHANGE_RATES_TO_INR = {
    "INR": 1,
    "USD": 90,
    "EUR": 107,
    "GBP": 123,
    "AUD": 63,
    "CAD": 66,
    "YEN": 12.9
};

export const USD_TO_INR = EXCHANGE_RATES_TO_INR.USD;

// Rate to convert one unit of `currency` into INR. Unknown/blank currencies fall back
// to the USD rate, matching the behaviour every call site had before this was shared.
export function getRateToInr(currency) {
    const key = String(currency || '').trim().toUpperCase();
    return EXCHANGE_RATES_TO_INR[key] || EXCHANGE_RATES_TO_INR.USD;
}

// Home-currency amount -> INR, rounded to paise so repeated saves stay stable.
export function homeToInr(amount, currency) {
    const n = parseFloat(String(amount ?? "").replace(/[^0-9.-]+/g, ""));
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * getRateToInr(currency) * 100) / 100;
}

// Home-currency amount -> INR at an explicitly supplied rate. This is what a billable
// stores in Amount_in_Inr once someone records the rate they actually priced it at.
// A blank/invalid/zero rate falls back to the fixed table for `currency`.
export function homeToInrAtRate(amount, rate, currency) {
    const n = parseFloat(String(amount ?? "").replace(/[^0-9.-]+/g, ""));
    if (!Number.isFinite(n)) return 0;
    const r = parseFloat(String(rate ?? "").replace(/[^0-9.-]+/g, ""));
    const effective = (Number.isFinite(r) && r > 0) ? r : getRateToInr(currency);
    return Math.round(n * effective * 100) / 100;
}

// Home-currency amount -> USD, always routed through INR so USD and INR never disagree.
export function homeToUsd(amount, currency) {
    return Math.round((homeToInr(amount, currency) / USD_TO_INR) * 100) / 100;
}

// --- Shared Executive Hub filter defaults ---
//
// Office selection convention shared by every Business Projections Hub filter -- Project
// Overview, Revenue Operations and Business Projection all open scoped to PhantomFX's own
// three delivery offices, since that is what gets reviewed day to day. Every other office --
// Spectre/SpectrePost, Milk, Lola, Tippett, or a bare "PhantomFX" row with no city -- stays
// one click away in the same dropdown rather than hidden entirely.
export const DEFAULT_OFFICES = ['PhantomFX - Chennai', 'PhantomFX - Hyderabad', 'PhantomFX - Mumbai'];
export function defaultOfficesFrom(allOffices = []) {
    return allOffices.filter(o => DEFAULT_OFFICES.includes(o));
}

// Set equality for two value-filter arrays, ignoring order. Used to tell whether a filter is
// still at its default selection -- so a "Clear Filters" control only appears once something
// has actually changed, rather than whenever the default happens to be non-empty.
export function sameValues(a = [], b = []) {
    return a.length === b.length && a.every(v => b.includes(v));
}
