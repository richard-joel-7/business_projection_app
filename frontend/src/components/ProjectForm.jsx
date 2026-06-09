import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { DateInput } from "../components/ui/DateInput";
import ProjectionsRepeater from "./ProjectionsRepeater";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { parseDate } from "../lib/utils";

export default function ProjectForm({ initialData, onSubmit, title, isModify = false, onBack }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        "Project ID": "",
        "Office": "",
        "Region Type": "",
        "Territory": "",
        "Biz Poc": "",
        "Client": "",
        "Project Name": "",
        "Project Status": "",
        "Bidding": "",
        "Winning %": 0,
        "Value in Home Currency": 0,
        "Home Currency": "",
        "Amount in USD": 0,
        "Profit %": 0,
        "Close Date": "",
        "Gmail": ""
    });
    const [projections, setProjections] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [projectionCurrency, setProjectionCurrency] = useState("USD");
    
    // Exchange Rates mapping to INR
    const exchangeRates = {
        "USD": 90,
        "EUR": 107,
        "GBP": 123,
        "AUD": 63,
        "CAD": 66,
        "YEN": 12.9,
        "INR": 1
    };

    const normalizeAmountValue = (value) => {
        const cleaned = String(value ?? "").replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const toRoundedAmountString = (value) => {
        if (value === null || value === undefined || String(value).trim() === "") return "";
        return String(normalizeAmountValue(value));
    };

    // Options - dynamically add current value if not in standard list
    const getOptionsWithCurrent = (standardOptions, currentValue) => {
        if (!currentValue) return standardOptions;
        const exists = standardOptions.some(opt => String(opt.value).toLowerCase() === String(currentValue).toLowerCase());
        if (exists) return standardOptions;
        return [...standardOptions, { value: currentValue, label: currentValue }];
    };



    const officeOptions = getOptionsWithCurrent(["PFX", "TPS", "CHN", "SPP", "MLK"].map(o => ({ value: o, label: o })), formData["Office"]);
    const regionOptions = getOptionsWithCurrent(["Global", "India", "Canada", "Berkley"].map(o => ({ value: o, label: o })), formData["Region Type"]);
    const statusOptions = getOptionsWithCurrent(["Awarded", "Near Win", "Potential", "Lost", "Hold", "Opportunity"].map(o => ({ value: o, label: o })), formData["deal_stage"]);
    const blockStatusOptions = getOptionsWithCurrent(["Awarded", "Near Win", "Potential", "Lost", "Hold", "Opportunity"].map(o => ({ value: o, label: o })), formData["Block_Stage"]);
    const biddingOptions = getOptionsWithCurrent(["Yes", "No"].map(o => ({ value: o, label: o })), formData["Bidding"]);
    const currencyOptions = getOptionsWithCurrent(["USD", "EUR", "GBP", "INR", "CAD", "AUD"].map(o => ({ value: o, label: o })), formData["Home Currency"]);
    const bizPocOptions = getOptionsWithCurrent(["Ian", "Gary", "Roo", "Swapna", "Juan", "Sunil", "Satish", "Ameya", "Christina", "Andrew", "Hayden", "Bala/Shibi"].map(o => ({ value: o, label: o })), formData["Biz Poc"]);



    useEffect(() => {
        console.log('ProjectForm useEffect - initialData:', initialData);
        if (initialData && initialData.project) {
            console.log('Setting form data:', initialData.project);
            
            // Map incoming data to form state, prioritizing specific backend keys if frontend keys are missing
            const project = initialData.project;
            const { closeDate: _closeDate, ...projectWithoutDerivedDates } = project;
            const dealStage = project["deal_stage"] || project["Deal Stage"] || project["Project Status"];
            const blockStage = project["Block_Stage"] || project["Block Stage"] || project["Project Status"];

            // Force recalculate Amount in USD to ensure consistency with current exchange rates, overriding old DB values
            const currency = projectWithoutDerivedDates["Home Currency"] || projectWithoutDerivedDates["Currency"];
            const val = projectWithoutDerivedDates["Value in Home Currency"] || projectWithoutDerivedDates["Home_Amount"];
            let calculatedUsd = projectWithoutDerivedDates["Amount in USD"];
            
            if (currency && val) {
                calculatedUsd = calculateUSDAmount(currency, val);
            }

            setFormData(prev => ({
                ...prev,
                ...projectWithoutDerivedDates,
                "deal_stage": dealStage,
                "Block_Stage": blockStage,
                "Amount in USD": calculatedUsd
            }));

            // Normalize projections to ensure "Amount in USD" is populated
            const normalizedProjections = (initialData.projections || []).map(p => ({
                ...p,
                "Amount in USD": toRoundedAmountString(p["Amount in USD"] ?? p["Amount"] ?? p["Value"] ?? "")
            }));
            setProjectionCurrency("USD");
            setProjections(normalizedProjections);
        } else if (!isModify) {
            // New project
            setFormData(prev => ({ ...prev, "Project ID": "Auto-generated" }));
            setProjectionCurrency("USD");
        }

        // Auto-fill Gmail if user is logged in
        if (user && user.email) {
            setFormData(prev => ({ ...prev, "Gmail": user.email }));
        }
    }, [initialData, isModify, user]);

    const calculateUSDAmount = (currency, value) => {
        if (!currency || !value) return 0;

        // Clean value (remove commas, currency symbols if any, though input type should handle most)
        const cleanValue = parseFloat(String(value).replace(/[^0-9.-]+/g, ""));
        if (isNaN(cleanValue)) return 0;

        if (currency === "USD") {
            return cleanValue;
        }

        const rateToInr = exchangeRates[currency] || exchangeRates["USD"];
        const inrAmount = cleanValue * rateToInr;
        const result = inrAmount / exchangeRates["USD"];
        // Return exactly 2 decimal places properly rounded to avoid floating point drift
        return Math.round(result * 100) / 100;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-calculate Amount in USD
            if (name === "Home Currency" || name === "Value in Home Currency") {
                const currency = name === "Home Currency" ? value : prev["Home Currency"];
                const val = name === "Value in Home Currency" ? value : prev["Value in Home Currency"];

                const usdAmount = calculateUSDAmount(currency, val);
                newData["Amount in USD"] = usdAmount;
            }

            return newData;
        });
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = parseDate(dateString);
        if (!date) return "";
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        // value is YYYY-MM-DD from input
        // Keep it as YYYY-MM-DD for consistency, Backend will parse it
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleProjectionsChange = (newProjections) => {
        setProjections(newProjections);
    };

    const handleProjectionCurrencyChange = (nextCurrency) => {
        if (nextCurrency === projectionCurrency) return;
        
        const converted = projections.map((proj) => {
            const raw = proj["Amount in USD"] ?? proj["Amount"] ?? proj["Value"] ?? "";
            const amountUsd = normalizeAmountValue(raw); // Backend always stores USD
            
            let displayAmount = amountUsd;
            if (nextCurrency === "INR") {
                displayAmount = amountUsd * exchangeRates["USD"];
            } else if (nextCurrency === "Home") {
                const homeCur = formData["Home Currency"] || "USD";
                const rateToInr = exchangeRates[homeCur] || exchangeRates["USD"];
                const inrAmount = amountUsd * exchangeRates["USD"];
                displayAmount = inrAmount / rateToInr;
            }
            
            return {
                ...proj,
                // We use _displayAmount to pass to repeater, while preserving actual USD amount
                "_displayAmount": displayAmount ? String(Math.round(displayAmount * 100) / 100) : "",
                "Amount in USD": amountUsd ? String(amountUsd) : "",
                // Clear temp percentage so it recalculates based on the new display amount vs project total
                "_tempPercentage": undefined 
            };
        });
        
        setProjections(converted);
        setProjectionCurrency(nextCurrency);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Validation - Removed mandatory check as per request
        /*
        const requiredFields = [
            "Project Name", "Office", "Region Type", "Territory",
            "Biz Poc", "Client", "Project Status", "Bidding",
            "Home Currency", "Value in Home Currency"
        ];

        if (formData["Project Status"] === "Awarded") {
            requiredFields.push("Close Date");
        }

        const missingFields = requiredFields.filter(field => !formData[field]);

        if (missingFields.length > 0) {
            setError(`Please fill in the following required fields: ${missingFields.join(", ")}`);
            setLoading(false);
            return;
        }
        */

        try {
            const payloadProject = { ...formData };

            if (payloadProject["Project ID"] === "Auto-generated") {
                payloadProject["Project ID"] = "";
            }

            const payloadProjections = projections
                .filter(proj => proj["Change Type"] !== "Delete")
                .map((proj) => {
                    const rawDisplay = proj["_displayAmount"] ?? proj["Amount in USD"] ?? proj["Amount"] ?? proj["Value"] ?? "";
                    const amountDisplay = normalizeAmountValue(rawDisplay);
                    
                    let amountInUsd = amountDisplay;
                    let amountInInr = amountDisplay;
                    
                    if (projectionCurrency === "INR") {
                        amountInUsd = amountDisplay / exchangeRates["USD"];
                        amountInInr = amountDisplay;
                    } else if (projectionCurrency === "Home") {
                        const homeCur = formData["Home Currency"] || "USD";
                        const rateToInr = exchangeRates[homeCur] || exchangeRates["USD"];
                        amountInInr = amountDisplay * rateToInr;
                        amountInUsd = amountInInr / exchangeRates["USD"];
                    } else {
                        amountInInr = amountDisplay * exchangeRates["USD"];
                    }
                    
                    return {
                        ...proj,
                        "Amount in USD": amountInUsd ? String(Math.round(amountInUsd * 100) / 100) : "",
                        "Amount_in_Inr": amountInInr ? String(Math.round(amountInInr * 100) / 100) : ""
                    };
                });

            await onSubmit({
                project: payloadProject,
                projections: payloadProjections,
                userEmail: user?.email
            });
            navigate("/dashboard");
        } catch (err) {
            console.error("Submit failed", err);
            setError(err.message || "Failed to save project.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-8 space-y-8 max-w-4xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
                {onBack && (
                    <Button type="button" variant="ghost" onClick={onBack} className="p-2 text-gray-400 hover:text-white">
                        <ArrowLeft size={24} />
                    </Button>
                )}
                <h1 className="text-2xl font-bold text-white">{title}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Project Name & Projections */}
                <div className="space-y-6">
                    <Input 
                        label="Project Name" 
                        name="Project Name" 
                        value={formData["Project Name"]} 
                        onChange={handleChange} 
                        required 
                        readOnly={isModify}
                        className={isModify ? "opacity-70 cursor-not-allowed" : ""}
                    />

                    <div className="pt-2">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h3 className="text-lg font-medium text-white">Projections</h3>
                            <div className="flex items-center gap-3 bg-dark-800/50 border border-white/10 rounded-xl p-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleProjectionCurrencyChange("USD")}
                                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all ${projectionCurrency === "USD"
                                        ? "bg-primary text-white shadow-lg"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-xs font-medium">USD</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleProjectionCurrencyChange("INR")}
                                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all ${projectionCurrency === "INR"
                                        ? "bg-primary text-white shadow-lg"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-xs font-medium">INR</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleProjectionCurrencyChange("Home")}
                                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all ${projectionCurrency === "Home"
                                        ? "bg-primary text-white shadow-lg"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    <span className="text-xs font-medium">Home</span>
                                </button>
                            </div>
                        </div>
                        <ProjectionsRepeater
                            projections={projections}
                            onChange={handleProjectionsChange}
                            amountCurrency={projectionCurrency}
                            projectTotalHome={parseFloat(String(formData["Value in Home Currency"]).replace(/[^0-9.-]+/g, "")) || 0}
                            exchangeRates={exchangeRates}
                            projectHomeCurrency={formData["Home Currency"] || "USD"}
                        />
                    </div>
                </div>

                {/* Right Column: All other fields */}
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Select 
                            label="Office" 
                            name="Office" 
                            options={officeOptions} 
                            value={formData["Office"]} 
                            onChange={handleChange} 
                            disabled={isModify}
                        />
                        <Select 
                            label="Region Type" 
                            name="Region Type" 
                            options={regionOptions} 
                            value={formData["Region Type"]} 
                            onChange={handleChange} 
                            disabled={isModify}
                        />

                        {/* Client Location removed */}
                        
                        <Select 
                            label="Biz Poc" 
                            name="Biz Poc" 
                            options={bizPocOptions} 
                            value={formData["Biz Poc"]} 
                            onChange={handleChange} 
                            disabled={isModify}
                        />

                        <div className="md:col-span-2">
                            <Input 
                                label="Client" 
                                name="Client" 
                                value={formData["Client"]} 
                                onChange={handleChange} 
                                readOnly={isModify}
                                className={isModify ? "opacity-70 cursor-not-allowed" : ""}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Input label="Gmail" name="Gmail" value={formData["Gmail"]} readOnly className="opacity-70" />
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select 
                                label="Deal Stage" 
                                name="deal_stage" 
                                options={statusOptions} 
                                value={formData["deal_stage"]} 
                                onChange={handleChange} 
                                disabled={isModify}
                            />
                            <Select 
                                label="Block Stage" 
                                name="Block_Stage" 
                                options={blockStatusOptions} 
                                value={formData["Block_Stage"]} 
                                onChange={handleChange} 
                                disabled={isModify}
                            />
                        </div>

                        <Select 
                            label="Bidding" 
                            name="Bidding" 
                            options={biddingOptions} 
                            value={formData["Bidding"]} 
                            onChange={handleChange} 
                            disabled={isModify}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Close Date</label>
                            <DateInput
                                name="Close Date"
                                value={formatDateForInput(formData["Close Date"])}
                                onChange={handleDateChange}
                                readOnly={isModify}
                                className={isModify ? "opacity-70 cursor-not-allowed" : ""}
                            />
                        </div>

                        <div className="md:col-span-2 flex gap-2">
                            <div className="w-1/3">
                                <Select 
                                    label="Home Currency" 
                                    name="Home Currency" 
                                    options={currencyOptions} 
                                    value={formData["Home Currency"]} 
                                    onChange={handleChange} 
                                    placeholder="Currency" 
                                    disabled={isModify}
                                />
                            </div>
                            <div className="w-2/3">
                                <Input 
                                    label="Value" 
                                    name="Value in Home Currency" 
                                    type="text" 
                                    value={formData["Value in Home Currency"]} 
                                    onChange={handleChange} 
                                    placeholder="0.00" 
                                    readOnly={isModify}
                                    className={isModify ? "opacity-70 cursor-not-allowed" : ""}
                                />
                            </div>
                        </div>

                        {/* Amount in USD is now Read-Only and Auto-Calculated */}
                        <Input
                            label="Amount in USD"
                            name="Amount in USD"
                            type="text"
                            value={formData["Amount in USD"] ? Number(formData["Amount in USD"]).toFixed(2) : ""}
                            readOnly
                            className="opacity-70 cursor-not-allowed"
                            placeholder="Auto-calculated"
                        />

                        <Input label="Profit %" name="Profit %" type="text" value={formData["Profit %"]} onChange={handleChange} placeholder="0.00" />
                    </div>
                </div>
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <div className="flex justify-end gap-3 pt-4">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate("/dashboard");
                    }}
                >
                    Cancel
                </Button>
                <Button type="submit" disabled={loading} className="min-w-[150px]">
                    <Save size={18} className="mr-2" /> {loading ? "Saving..." : "Save Project"}
                </Button>
            </div>
        </form>
    );
}
