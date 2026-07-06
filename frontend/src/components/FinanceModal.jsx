import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Plus, Trash2, FileText, Receipt, Eye, BarChart2, AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { DateInput } from "./ui/DateInput";
import api from "../lib/api";

const createNewInvoice = () => ({
    Finance_id: '',
    Invoice_Number: '',
    Billed_date: '',
    Expected_payment_date: '',
    Due_date: '',
    Billing_type: '',
    Exchange_Rate: '',
    Billed_Amount_in_Inr: '',
    Exchange_Diff: '',
    Bank_Charges: '',
    Finance_remarks: '',
    Tax_type: '',
    GST: '',
    'Total Amount + GST (INR)': '',
    GST_Received: '',
    GST_Date: '',
    TDS: '',
    VAT_UK: '',
    VAT_China: '',
    'Credit Note Number': '',
    Receipts: [],
    deletedReceipts: []
});

export default function FinanceModal({ item, mergedItems, isMergeMode, onClose, onSave, saving, readOnly = false }) {
    const activeItem = useMemo(() => {
        if (!isMergeMode || !mergedItems || mergedItems.length === 0) return item;

        let combinedFinances = [];
        const invoiceMap = {};
        mergedItems.forEach(m => {
            if (m.finances) {
                m.finances.forEach(f => {
                    const key = f.Invoice_Number || f.Finance_id; 
                    if (!key) return;
                    if (!invoiceMap[key]) {
                        invoiceMap[key] = { ...f, Receipts: (f.Receipts || []).map(r => ({...r})) };
                    } else {
                        const cF = invoiceMap[key];
                        const add = (field) => {
                            if (f[field] && !isNaN(parseFloat(f[field]))) {
                                cF[field] = String((parseFloat(cF[field] || 0) + parseFloat(f[field])).toFixed(2));
                            }
                        };
                        add('Billed_Home_Amount');
                        add('Billed_Amount_in_Inr');
                        add('GST_amount');
                        add('Total Amount + GST (INR)');
                        add('GST_Received');
                        add('TDS');
                        add('Exchange_Diff');
                        add('Bank_Charges');
                        add('VAT_UK');
                        add('VAT_China');
                        add('Outstanding_amount');

                        // Receipts are tied to the invoice and not split in the backend,
                        // so we do not sum them. The first finance object's receipts are the full receipts.
                    }
                });
            }
        });
        combinedFinances = Object.values(invoiceMap);

        return {
            ...mergedItems[0],
            Billable_id: mergedItems.map(m => m.Billable_id).join(', '),
            BlockName: [...new Set(mergedItems.map(m => m.BlockName))].join(', '),
            Billable_date: [...new Set(mergedItems.map(m => m.Billable_date))].join(', '),
            Bin_number: [...new Set(mergedItems.map(m => m.Bin_number))].join(', '),
            Billable_Amount_in_Home_Currency: String(mergedItems.reduce((acc, m) => acc + (parseFloat(String(m.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0), 0)),
            Billable_Amount_in_Inr: String(mergedItems.reduce((acc, m) => acc + (parseFloat(String(m.Billable_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0), 0)),
            Home_Currency: [...new Set(mergedItems.map(m => m.Home_Currency))].join(', '),
            finances: combinedFinances.length > 0 ? combinedFinances : (mergedItems[0].finances || [])
        };
    }, [item, mergedItems, isMergeMode]);

    const [activeTab, setActiveTab] = useState('invoice');
    const [showSummary, setShowSummary] = useState(readOnly);
    const [error, setError] = useState("");
    
    // We only want ONE empty invoice block by default when merging, 
    // unless the merged items already have existing grouped invoices
    const initialInvoices = useMemo(() => {
        if (activeItem.finances && activeItem.finances.length > 0) {
            // Check if there's actual saved data vs just a placeholder
            if (activeItem.finances[0].Invoice_Number || activeItem.finances[0].Billed_date) {
                return activeItem.finances;
            }
        }
        
        // Ensure default Billed_Home_Amount falls back to the Billable Amount in Home Currency
        const defaultInv = createNewInvoice();
        if (activeItem.finances && activeItem.finances.length > 0 && activeItem.finances[0].Finance_id) {
            defaultInv.Finance_id = activeItem.finances[0].Finance_id;
        }
        defaultInv.Billed_Home_Amount = activeItem.Billable_Amount_in_Home_Currency || '';
        return [defaultInv];
    }, [activeItem.finances, activeItem.Billable_Amount_in_Home_Currency]);

    const [invoices, setInvoices] = useState(initialInvoices.map(f => {
        let inv = {
            ...f, 
            TDS_Type: f.TDS_Type || 'Value',
            GST: f.GST || f['GST%'] || '',
            GST_amount: f.GST_amount || ''
        };
        
        // Ensure GST Amount is recalculated if we have Billed Amount and GST% but no GST_amount
        if (inv.GST && !inv.GST_amount && inv.Billed_Amount_in_Inr) {
            const billedInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
            const gstPercent = parseFloat(String(inv.GST).replace(/[^0-9.-]+/g, "")) || 0;
            const gstAmount = (billedInr * gstPercent) / 100;
            inv.GST_amount = String(Math.round(gstAmount));
            inv['Total Amount + GST (INR)'] = String(Math.round(billedInr + gstAmount));
        }
        // Always recalculate payment status to ensure accuracy
        let invReceiptTotal = 0;
        if (inv.Receipts) {
            inv.Receipts.forEach(r => invReceiptTotal += parseFloat(String(r.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0);
        }
        const invBilled = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
        if (invBilled === 0 || invReceiptTotal === 0) inv.Payment_status = 'Not Paid';
        else if (invReceiptTotal >= invBilled || (invBilled - invReceiptTotal) <= 0) inv.Payment_status = 'Paid';
        else inv.Payment_status = 'Partially Paid';
        
        return inv;
    }));
    const [deletedFinances, setDeletedFinances] = useState([]);
    const [showUnmergeConfirm, setShowUnmergeConfirm] = useState(false);
    const [isUnmerging, setIsUnmerging] = useState(false);

    const isMerged = activeItem && String(activeItem.Billable_id || '').includes(',');

    const handleUnmergeClick = () => {
        setShowUnmergeConfirm(true);
    };

    const executeUnmerge = async () => {
        setShowUnmergeConfirm(false);
        setIsUnmerging(true);
        try {
            const billableIds = String(activeItem.Billable_id).split(',').map(id => id.trim()).filter(Boolean);
            await api.unmergeFinanceDetails(billableIds);
            onSave({ action: 'unmerge' }); // Trigger a refresh in the parent component
        } catch (err) {
            console.error("Failed to unmerge:", err);
            setError("Failed to unmerge. Please try again.");
            setIsUnmerging(false);
        }
    };

    const handleInvoiceChange = (index, field, value) => {
        const newInvoices = [...invoices];
        let inv = newInvoices[index];
        inv[field] = value;

        if (field === 'Billing_type' && value !== 'Credit Note') {
            inv['Credit Note Number'] = '';
        }

        if (field === 'Billed_date' && value) {
            const billedDate = new Date(value);
            if (!isNaN(billedDate)) {
                billedDate.setDate(billedDate.getDate() + 30);
                inv.Due_date = billedDate.toISOString().split('T')[0];
            }
        }

        if (field === 'Exchange_Rate' || field === 'Billed_Home_Amount' || field === 'Billed_Amount_in_Inr') {
            const parsed = parseFloat(String(value).replace(/[^0-9.-]+/g, ""));
            const hcAmount = field === 'Billed_Home_Amount' 
                             ? parsed 
                             : parseFloat(String(inv.Billed_Home_Amount || activeItem.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
            const exRate = field === 'Exchange_Rate' 
                             ? parsed 
                             : parseFloat(String(inv.Exchange_Rate).replace(/[^0-9.-]+/g, "")) || 0;
            
            if (Number.isFinite(exRate) && Number.isFinite(hcAmount)) {
                inv.Billed_Amount_in_Inr = String(Math.round(hcAmount * exRate));
            }
        }

        if (field === 'GST' || field === 'Billed_Amount_in_Inr' || field === 'Exchange_Rate') {
            const billedInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
            const gstPercent = parseFloat(String(inv.GST).replace(/[^0-9.-]+/g, "")) || 0;
            const gstAmount = (billedInr * gstPercent) / 100;
            inv.GST_amount = String(Math.round(gstAmount));
            inv['Total Amount + GST (INR)'] = String(Math.round(billedInr + gstAmount));
        }

        if (field === 'TDS' || field === 'TDS_Percentage' || field === 'Billed_Amount_in_Inr') {
            const billedInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
            
            if (field === 'TDS_Percentage' || (field === 'Billed_Amount_in_Inr' && inv.TDS_Type === 'Percentage')) {
                const tdsPercent = parseFloat(String(field === 'TDS_Percentage' ? value : inv.TDS_Percentage).replace(/[^0-9.-]+/g, "")) || 0;
                inv.TDS = String(Math.round((billedInr * tdsPercent) / 100));
            } else if (field === 'TDS' || (field === 'Billed_Amount_in_Inr' && inv.TDS_Type === 'Value')) {
                const tdsVal = parseFloat(String(field === 'TDS' ? value : inv.TDS).replace(/[^0-9.-]+/g, "")) || 0;
                if (billedInr > 0) {
                    inv.TDS_Percentage = String(((tdsVal / billedInr) * 100).toFixed(2));
                } else {
                    inv.TDS_Percentage = "0.00";
                }
            }
        }

        if (field === 'Billed_Amount_in_Inr') {
            inv.Payment_status = recalculatePaymentStatus(inv);
        }

        setInvoices(newInvoices);
    };

    const addInvoice = () => {
        setInvoices([...invoices, createNewInvoice()]);
    };

    const removeInvoice = (index) => {
        const inv = invoices[index];
        if (inv._originalFinanceIds) {
            setDeletedFinances([...deletedFinances, ...inv._originalFinanceIds]);
        } else if (inv.Finance_id) {
            setDeletedFinances([...deletedFinances, inv.Finance_id]);
        }
        setInvoices(invoices.filter((_, i) => i !== index));
    };

    const recalculatePaymentStatus = (inv) => {
        if (inv.Payment_Status_Override) return inv.Payment_status;

        let invReceiptTotalHome = 0;
        if (inv.Receipts) {
            inv.Receipts.forEach(r => invReceiptTotalHome += parseFloat(String(r.Receipt_Home_Amount).replace(/[^0-9.-]+/g, "")) || 0);
        }
        
        // Instead of dividing INR by exchange rate (which causes rounding issues),
        // we directly pull the original Billable Amount in Home Currency from the modal's context.
        const invBilledHome = parseFloat(String(activeItem.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
        
        if (invBilledHome === 0) return 'Not Paid';
        if (invReceiptTotalHome === 0) return 'Not Paid';
        if (invReceiptTotalHome >= (invBilledHome - 0.05)) return 'Paid';
        return 'Partially Paid';
    };

    const handleReceiptChange = (invIndex, recIndex, field, value) => {
        const newInvoices = [...invoices];
        newInvoices[invIndex].Receipts[recIndex][field] = value;
        if (field === 'Receipt_Home_Amount' || field === 'Exchange_rate' || field === 'Receipt_Amount') {
            newInvoices[invIndex].Payment_status = recalculatePaymentStatus(newInvoices[invIndex]);
        }
        setInvoices(newInvoices);
    };

    const addReceipt = (invIndex) => {
        const newInvoices = [...invoices];
        newInvoices[invIndex].Receipts.push({ Receipt_date: '', Receipt_Amount: '', Receipt_Type: '' });
        newInvoices[invIndex].Payment_status = recalculatePaymentStatus(newInvoices[invIndex]);
        setInvoices(newInvoices);
    };

    const removeReceipt = (invIndex, recIndex) => {
        const newInvoices = [...invoices];
        const rec = newInvoices[invIndex].Receipts[recIndex];
        if (rec.Receipt_id) {
            if (!newInvoices[invIndex].deletedReceipts) newInvoices[invIndex].deletedReceipts = [];
            newInvoices[invIndex].deletedReceipts.push(rec.Receipt_id);
        }
        newInvoices[invIndex].Receipts.splice(recIndex, 1);
        newInvoices[invIndex].Payment_status = recalculatePaymentStatus(newInvoices[invIndex]);
        setInvoices(newInvoices);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        let isValid = true;
        let validationMsg = "";
        
        invoices.forEach((inv, invIndex) => {
            if (!inv.Exchange_Rate || String(inv.Exchange_Rate).trim() === '') {
                isValid = false;
                validationMsg = `Exchange Rate is required in Invoice Section ${invIndex + 1}.`;
            }
            if (inv.Receipts && inv.Receipts.length > 0) {
                inv.Receipts.forEach((rec, recIndex) => {
                    // Check if receipt actually has an amount before enforcing exchange rate
                    const hasAmount = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) > 0 || parseFloat(String(rec.Receipt_Amount_in_INR).replace(/[^0-9.-]+/g, "")) > 0;
                    if (hasAmount && (!rec.Exchange_rate || String(rec.Exchange_rate).trim() === '')) {
                        isValid = false;
                        validationMsg = `Exchange Rate is required for Receipt ${recIndex + 1} in Invoice Section ${invIndex + 1}.`;
                    }
                });
            }
        });

        if (!isValid) {
            setError(validationMsg);
            return;
        }
        setError("");
        
        const processedInvoices = invoices.map(inv => {
            const processedReceipts = inv.Receipts.map((rec, idx) => ({
                ...rec,
                Receipt_Type: `Receipt_${idx + 1}`
            }));
            
            let invReceiptTotal = 0;
            processedReceipts.forEach(r => invReceiptTotal += parseFloat(String(r.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0);
            const invBilled = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
            const outstanding = invBilled - invReceiptTotal;

            return { 
                ...inv, 
                'GST%': inv.GST,
                'Outstanding_amount': String(outstanding),
                Receipts: processedReceipts,
                BlockName: activeItem.BlockName,
                Billable_date: activeItem.Billable_date,
                Billable_Amount_in_Home_Currency: activeItem.Billable_Amount_in_Home_Currency,
                Home_Currency: activeItem.Home_Currency,
                Billable_Amount_in_Inr: activeItem.Billable_Amount_in_Inr
            };
        });

        let saves = [];

        if (isMergeMode) {
            const totalHc = parseFloat(String(activeItem.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
            
            mergedItems.forEach((mItem) => {
                const mHc = parseFloat(String(mItem.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
                const ratio = totalHc > 0 ? (mHc / totalHc) : (1 / mergedItems.length);

                const splitInvoices = processedInvoices.map((inv, idx) => {
                    const sInv = { ...inv };
                    
                    const splitField = (field) => {
                        if (sInv[field] && !isNaN(parseFloat(sInv[field]))) {
                            sInv[field] = String((parseFloat(sInv[field]) * ratio).toFixed(2));
                        }
                    };

                    splitField('Billed_Home_Amount');
                    splitField('Billed_Amount_in_Inr');
                    splitField('GST_amount');
                    splitField('Total Amount + GST (INR)');
                    splitField('GST_Received');
                    splitField('TDS');
                    splitField('Exchange_Diff');
                    splitField('Bank_Charges');
                    splitField('VAT_UK');
                    splitField('VAT_China');
                    splitField('Outstanding_amount');

                    sInv.Receipts = sInv.Receipts.map(r => {
                        const sR = { ...r };
                        // We do NOT split receipt amounts because receipts are tied to the Invoice, 
                        // and the backend only saves the receipts once per Invoice_Number.
                        return sR;
                    });

                    // Match existing Finance_id from this mItem by index to avoid duplicate insertions and guarantee upsert
                    const existingFin = mItem.finances ? mItem.finances[idx] : null;
                    if (existingFin && existingFin.Finance_id) {
                        sInv.Finance_id = existingFin.Finance_id;
                        sInv.Receipts = sInv.Receipts.map((r, rIdx) => {
                            const existingRec = existingFin.Receipts ? existingFin.Receipts[rIdx] : null;
                            if (existingRec && existingRec.Receipt_id) {
                                r.Receipt_id = existingRec.Receipt_id;
                            } else {
                                delete r.Receipt_id;
                            }
                            return r;
                        });
                    } else {
                        delete sInv.Finance_id;
                        sInv.Receipts.forEach(r => delete r.Receipt_id);
                    }

                    sInv.BlockName = mItem.BlockName;
                    sInv.Billable_date = mItem.Billable_date;
                    sInv.Billable_Amount_in_Home_Currency = mItem.Billable_Amount_in_Home_Currency;
                    sInv.Home_Currency = mItem.Home_Currency;
                    sInv.Billable_Amount_in_Inr = mItem.Billable_Amount_in_Inr;

                    return sInv;
                });

                let mDeletedFinances = [];
                deletedFinances.forEach(dfId => {
                     if (mItem.finances && mItem.finances.some(mf => mf.Finance_id === dfId)) {
                         mDeletedFinances.push(dfId);
                     }
                });

                saves.push({
                    billableId: mItem.Billable_id,
                    financesData: splitInvoices,
                    deletedFinances: mDeletedFinances
                });
            });
        } else {
            saves.push({
                billableId: activeItem.Billable_id,
                financesData: processedInvoices,
                deletedFinances: deletedFinances
            });
        }

        onSave({ multi: saves });
    };

    const calculateSummary = () => {
        const totalProdApproved = parseFloat(String(activeItem.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
        
        let totalBilled = 0;
        let totalReceipt = 0;
        
        invoices.forEach(inv => {
            if (inv.Billing_type === 'Credit Note') return;
            const exRate = parseFloat(String(inv.Exchange_Rate).replace(/[^0-9.-]+/g, "")) || 1;
            
            const billedInr = parseFloat(String(inv.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
            // Convert INR back to Home Currency using the invoice's exchange rate
            totalBilled += (billedInr / exRate);
            
            if (inv.Receipts) {
                inv.Receipts.forEach(rec => {
                    const receiptInr = parseFloat(String(rec.Receipt_Amount).replace(/[^0-9.-]+/g, "")) || 0;
                    totalReceipt += (receiptInr / exRate);
                });
            }
        });
        
        const outstanding = totalBilled - totalReceipt;
        const totalBillable = Math.max(0, totalProdApproved - totalBilled);
        
        let paymentStatus = 'Partially Paid';
        if (totalBilled === 0) paymentStatus = 'Not Paid';
        else if (totalReceipt === 0) paymentStatus = 'Not Paid';
        else if (totalReceipt >= totalBilled || outstanding <= 0) paymentStatus = 'Paid';
        
        // Let's check if any invoice has an overridden status that is "Paid"
        // and if it's the only one, or if they all are, then the overall summary should maybe reflect it.
        // Actually, let's just base the overall summary on the math, 
        // OR check if the math says it's not paid but there are invoices.
        // Let's aggregate the actual saved statuses.
        const statuses = invoices.map(inv => inv.Payment_status || 'Not Paid');
        if (statuses.length > 0) {
            if (statuses.every(s => s === 'Paid')) paymentStatus = 'Paid';
            else if (statuses.every(s => s === 'Not Paid' || s === '')) paymentStatus = 'Not Paid';
            else paymentStatus = 'Partially Paid';
        }
        
        // Simple scaling for bar chart
        const maxVal = Math.max(totalProdApproved, totalBilled, totalBillable, totalReceipt, outstanding, 1);
        
        return {
            totalProdApproved,
            totalBillable,
            totalBilled,
            totalReceipt,
            outstanding,
            paymentStatus,
            maxVal
        };
    };

    const summary = calculateSummary();

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass-panel rounded-2xl w-full max-w-5xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] my-8 flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-dark-900 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            Finance Details
                            <button 
                                type="button"
                                onClick={() => setShowSummary(!showSummary)}
                                className={`p-1.5 rounded-md transition-colors ${showSummary ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                title="Toggle Financial Summary"
                            >
                                <Eye size={16} />
                            </button>
                        </h2>
                        <div className="text-sm text-gray-400 mt-1">
                            {activeItem.BlockName} <span className="mx-2 text-white/20">|</span> ID: {activeItem.Billable_id}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isMerged && !readOnly && (
                            <button
                                type="button"
                                onClick={handleUnmergeClick}
                                disabled={isUnmerging || saving}
                                className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUnmerging ? 'Unmerging...' : 'Unmerge'}
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Read-Only Top Section */}
                <div className="px-6 pt-6 shrink-0">
                    <AnimatePresence>
                        {showSummary && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 bg-dark-800/80 rounded-xl border border-white/10 p-5 overflow-hidden"
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <BarChart2 size={16} className="text-primary" /> Financial Summary ({activeItem.Home_Currency || 'HC'})
                                    </h3>
                                    <div className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider border ${
                                        summary.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        summary.paymentStatus === 'Partially Paid' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                        {summary.paymentStatus}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                                    {[
                                        { label: 'Total Billable', value: summary.totalProdApproved, color: 'bg-blue-500' },
                                        { label: 'Yet to Bill', value: summary.totalBillable, color: 'bg-cyan-500' },
                                        { label: 'Billed', value: summary.totalBilled, color: 'bg-emerald-500' },
                                        { label: 'Receipt', value: summary.totalReceipt, color: 'bg-purple-500' },
                                        { label: 'Outstanding', value: summary.outstanding, color: summary.outstanding > 0 ? 'bg-red-500' : 'bg-gray-500' }
                                    ].map((stat, i) => (
                                        <div key={i} className="flex flex-col gap-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-xs text-gray-400 uppercase font-semibold">{stat.label}</span>
                                                <span className="text-sm font-mono text-white font-bold">{stat.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${stat.color} transition-all duration-500`} 
                                                    style={{ width: `${(stat.value / summary.maxVal) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-3">
                        {(isMergeMode && mergedItems ? mergedItems : [activeItem]).map((mItem, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-white/5 rounded-lg border border-white/10 relative">
                                {isMergeMode && (
                                    <div className="absolute -top-2 -left-2 bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/30 uppercase">
                                        Merged Item {idx + 1}
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Bin Number</label>
                                    <div className="text-sm text-gray-300 font-medium font-mono">{mItem.Bin_number || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Billable Date</label>
                                    <div className="text-sm text-gray-300 font-medium">{mItem.Billable_date || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Amount ({mItem.Home_Currency || 'HC'})</label>
                                    <div className="text-sm text-gray-300 font-mono">{mItem.Billable_Amount_in_Home_Currency || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Amount (INR)</label>
                                    <div className="text-sm text-emerald-400 font-mono">{mItem.Billable_Amount_in_Inr || '-'}</div>
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Work Order / Contract</label>
                                    {mItem.Work_Order ? (
                                        <a href={mItem.Work_Order} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline truncate block">View Link</a>
                                    ) : <div className="text-sm text-gray-500">-</div>}
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Approved Cost Sheet</label>
                                    {mItem.Approved_Cost_Sheet ? (
                                        <a href={mItem.Approved_Cost_Sheet} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline truncate block">View Link</a>
                                    ) : <div className="text-sm text-gray-500">-</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4 flex gap-2 border-b border-white/10 shrink-0">
                    <button
                        onClick={() => setActiveTab('invoice')}
                        className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'invoice' ? 'bg-white/10 text-white border-t border-x border-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <FileText size={16} /> Invoice Details
                    </button>
                    <button
                        onClick={() => setActiveTab('receipt')}
                        className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'receipt' ? 'bg-white/10 text-white border-t border-x border-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Receipt size={16} /> Receipt Details
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 relative bg-dark-900/50">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-semibold flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError("")} className="text-red-400 hover:text-red-300">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                    <form id="finance-form" onSubmit={handleSubmit} className="space-y-6">
                        
                        {activeTab === 'invoice' && (
                            <div className="space-y-6">
                                {invoices.map((inv, idx) => (
                                    <div key={idx} className="p-5 bg-dark-800/80 rounded-xl border border-white/10 relative pt-10">
                                        {invoices.length > 1 && !readOnly && (
                                            <button type="button" onClick={() => removeInvoice(idx)} className="absolute top-3 right-3 text-red-400 hover:bg-red-400/10 rounded p-1 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <div className="absolute top-3 left-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            Invoice Section {idx + 1}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-start">
                                            <Input label="Invoice Number" value={inv.Invoice_Number} onChange={(e) => handleInvoiceChange(idx, 'Invoice_Number', e.target.value)} required disabled={readOnly} />
                                            <DateInput label="Billed Date" value={inv.Billed_date} onChange={(e) => handleInvoiceChange(idx, 'Billed_date', e.target.value)} required disabled={readOnly} />
                                            <Select label="Billing Type" value={inv.Billing_type} onChange={(e) => handleInvoiceChange(idx, 'Billing_type', e.target.value)} options={[{value: '', label: 'Select'}, {value: 'Advance', label: 'Advance'}, {value: 'Credit Note', label: 'Credit Note'}, {value: 'Milestone', label: 'Milestone'}]} required disabled={readOnly} />
                                            {inv.Billing_type === 'Credit Note' && (
                                                <Input label="Credit Note Number" value={inv['Credit Note Number']} onChange={(e) => handleInvoiceChange(idx, 'Credit Note Number', e.target.value)} required disabled={readOnly} />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                            <Select label="Zone" value={inv.Tax_type} onChange={(e) => handleInvoiceChange(idx, 'Tax_type', e.target.value)} options={[{value: '', label: 'Select'}, {value: 'India', label: 'India'}, {value: 'UK', label: 'UK'}, {value: 'China', label: 'China'}, {value: 'None', label: 'None'}]} required disabled={readOnly} />
                                            <Input label="Billed Home Amount" type="number" step="any" value={inv.Billed_Home_Amount} onChange={(e) => handleInvoiceChange(idx, 'Billed_Home_Amount', e.target.value)} required disabled={readOnly} />
                                            <Input label="Exchange Rate" type="number" step="any" value={inv.Exchange_Rate} onChange={(e) => handleInvoiceChange(idx, 'Exchange_Rate', e.target.value)} required disabled={readOnly} />
                                            <Input label="Billed Amount (INR)" type="number" value={inv.Billed_Amount_in_Inr} disabled className="bg-dark-800/50" />
                                        </div>

                                        {inv.Tax_type === 'India' && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                                                <Input label="GST (%)" type="number" value={inv.GST} onChange={(e) => handleInvoiceChange(idx, 'GST', e.target.value)} disabled={readOnly} />
                                                <Input label="GST Amount (INR)" type="number" value={inv.GST_amount} disabled className="bg-dark-800/50" />
                                                <Input label="Total + GST (INR)" type="number" value={inv['Total Amount + GST (INR)']} disabled className="bg-dark-800/50" />
                                            </div>
                                        )}
                                        {inv.Tax_type === 'UK' && (
                                            <div className="grid grid-cols-1 gap-4 mb-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                                                <Input label="VAT UK" type="number" value={inv.VAT_UK} onChange={(e) => handleInvoiceChange(idx, 'VAT_UK', e.target.value)} disabled={readOnly} />
                                            </div>
                                        )}
                                        {inv.Tax_type === 'China' && (
                                            <div className="grid grid-cols-1 gap-4 mb-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                                                <Input label="VAT China" type="number" value={inv.VAT_China} onChange={(e) => handleInvoiceChange(idx, 'VAT_China', e.target.value)} disabled={readOnly} />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Input label="Finance Remarks" value={inv.Finance_remarks} onChange={(e) => handleInvoiceChange(idx, 'Finance_remarks', e.target.value)} disabled={readOnly} />
                                            <DateInput label="Due Date" value={inv.Due_date} disabled className="bg-dark-800/50" />
                                            <DateInput label="Expected Date" value={inv.Expected_payment_date} onChange={(e) => handleInvoiceChange(idx, 'Expected_payment_date', e.target.value)} disabled={readOnly} />
                                        </div>
                                    </div>
                                ))}
                                {!readOnly && (
                                    <Button type="button" variant="secondary" onClick={addInvoice} className="w-full border-dashed border-2 border-white/20 text-gray-400 hover:text-white hover:border-white/40 bg-transparent">
                                        <Plus size={16} className="mr-2" /> Add Another Invoice Section
                                    </Button>
                                )}
                            </div>
                        )}

                        {activeTab === 'receipt' && (
                            <div className="space-y-6">
                                {invoices.map((inv, idx) => {
                                    if (!inv.Invoice_Number) return null;
                                    const hasReceipts = inv.Receipts && inv.Receipts.length > 0;
                                    
                                    return (
                                        <div key={idx} className="p-5 bg-dark-800/80 rounded-xl border border-white/10 relative">
                                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                                            <div className="flex items-center gap-6">
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    Invoice: <span className="text-blue-400 font-mono">{inv.Invoice_Number}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Payment Status:</label>
                                                    <select 
                                                        value={inv.Payment_status || 'Not Paid'}
                                                        onChange={(e) => {
                                                            handleInvoiceChange(idx, 'Payment_status', e.target.value);
                                                            handleInvoiceChange(idx, 'Payment_Status_Override', true);
                                                        }}
                                                        disabled={readOnly}
                                                        className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border outline-none appearance-none cursor-pointer text-center ${
                                                            inv.Payment_status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' :
                                                            inv.Payment_status === 'Partially Paid' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20' :
                                                            'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                        }`}
                                                        style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                                    >
                                                        <option value="Paid" className="bg-dark-900 text-emerald-400">Paid</option>
                                                        <option value="Partially Paid" className="bg-dark-900 text-yellow-400">Partially Paid</option>
                                                        <option value="Not Paid" className="bg-dark-900 text-red-400">Not Paid</option>
                                                    </select>
                                                    {inv.Payment_Status_Override && !readOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newInvoices = [...invoices];
                                                                newInvoices[idx].Payment_Status_Override = false;
                                                                newInvoices[idx].Payment_status = recalculatePaymentStatus(newInvoices[idx]);
                                                                setInvoices(newInvoices);
                                                            }}
                                                            className="text-[10px] text-gray-500 hover:text-white underline ml-1"
                                                            title="Reset to Auto-calculated Status"
                                                        >
                                                            Reset
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {!readOnly && (
                                                <Button type="button" variant="secondary" size="sm" onClick={() => addReceipt(idx)} className="gap-2">
                                                    <Plus size={14} /> Add Receipt
                                                </Button>
                                            )}
                                        </div>

                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 items-end">
                                                <DateInput label="GST Date" value={inv.GST_Date} onChange={(e) => handleInvoiceChange(idx, 'GST_Date', e.target.value)} required={!!inv.GST_Received} disabled={readOnly} />
                                                <Input label="GST Received" type="number" value={inv.GST_Received} onChange={(e) => handleInvoiceChange(idx, 'GST_Received', e.target.value)} disabled={readOnly} />
                                                
                                                <div className="flex flex-col gap-1 w-full">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TDS</label>
                                                        <div className="flex rounded bg-dark-800/50 p-0.5 border border-white/10">
                                                            <button 
                                                                type="button" 
                                                                onClick={() => !readOnly && handleInvoiceChange(idx, 'TDS_Type', 'Value')} 
                                                                className={`px-2 py-0.5 text-[10px] rounded font-medium ${inv.TDS_Type === 'Value' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                                                                disabled={readOnly}
                                                            >Val</button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => !readOnly && handleInvoiceChange(idx, 'TDS_Type', 'Percentage')} 
                                                                className={`px-2 py-0.5 text-[10px] rounded font-medium ${inv.TDS_Type === 'Percentage' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                                                                disabled={readOnly}
                                                            >%</button>
                                                        </div>
                                                    </div>
                                                    {inv.TDS_Type === 'Percentage' ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-16 shrink-0">
                                                                <Input 
                                                                    type="number" 
                                                                    placeholder="%" 
                                                                    value={inv.TDS_Percentage !== undefined && inv.TDS_Percentage !== null ? inv.TDS_Percentage : ''} 
                                                                    onChange={(e) => handleInvoiceChange(idx, 'TDS_Percentage', e.target.value)} 
                                                                    disabled={readOnly}
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <Input 
                                                                    type="number" 
                                                                    value={inv.TDS !== undefined && inv.TDS !== null ? inv.TDS : ''} 
                                                                    disabled 
                                                                    className="bg-dark-800/50 w-full"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Input type="number" value={inv.TDS !== undefined && inv.TDS !== null ? inv.TDS : ''} onChange={(e) => handleInvoiceChange(idx, 'TDS', e.target.value)} disabled={readOnly} />
                                                    )}
                                                </div>
                                                
                                                <Input label="Exchange Diff (INR)" type="number" value={inv.Exchange_Diff} onChange={(e) => handleInvoiceChange(idx, 'Exchange_Diff', e.target.value)} disabled={readOnly} />
                                                <Input label="Bank Charges" type="number" value={inv.Bank_Charges} onChange={(e) => handleInvoiceChange(idx, 'Bank_Charges', e.target.value)} disabled={readOnly} />
                                            </div>

                                            {hasReceipts ? (
                                                <div className="space-y-3">
                                                    {inv.Receipts.map((rec, rIdx) => (
                                                        <div key={rIdx} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-dark-900 rounded-lg border border-white/5 items-end relative pr-12">
                                                            <DateInput label="Receipt Date" value={rec.Receipt_date} onChange={(e) => handleReceiptChange(idx, rIdx, 'Receipt_date', e.target.value)} required disabled={readOnly} />
                                                            
                                                            <Input 
                                                                label={`Receipt Amount (${activeItem.Home_Currency || 'HC'})`} 
                                                                type="number" 
                                                                value={rec.Receipt_Home_Amount !== undefined ? rec.Receipt_Home_Amount : ''} 
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    handleReceiptChange(idx, rIdx, 'Receipt_Home_Amount', val);
                                                                    
                                                                    // Auto calculate INR
                                                                    const homeAmt = parseFloat(val) || 0;
                                                                    const exRate = parseFloat(rec.Exchange_rate) || 0;
                                                                    if (homeAmt > 0 && exRate > 0) {
                                                                        handleReceiptChange(idx, rIdx, 'Receipt_Amount', Math.round(homeAmt * exRate));
                                                                    }
                                                                }} 
                                                                required 
                                                                disabled={readOnly} 
                                                            />
                                                            
                                                            <Input 
                                                                label="Exchange Rate" 
                                                                type="number" 
                                                                step="0.0001"
                                                                value={rec.Exchange_rate !== undefined ? rec.Exchange_rate : ''} 
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    handleReceiptChange(idx, rIdx, 'Exchange_rate', val);
                                                                    
                                                                    // Auto calculate INR
                                                                    const exRate = parseFloat(val) || 0;
                                                                    const homeAmt = parseFloat(rec.Receipt_Home_Amount) || 0;
                                                                    if (homeAmt > 0 && exRate > 0) {
                                                                        handleReceiptChange(idx, rIdx, 'Receipt_Amount', Math.round(homeAmt * exRate));
                                                                    }
                                                                }} 
                                                                required 
                                                                disabled={readOnly} 
                                                            />
                                                            
                                                            <Input label="Receipt Amount (INR)" type="number" value={rec.Receipt_Amount} onChange={(e) => handleReceiptChange(idx, rIdx, 'Receipt_Amount', e.target.value)} required disabled={readOnly} />
                                                            
                                                            {!readOnly && (
                                                                <button type="button" onClick={() => removeReceipt(idx, rIdx)} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:bg-red-400/10 rounded p-2 transition-colors z-10">
                                                                    <Trash2 size={20} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-4 bg-dark-900 rounded-lg border border-white/5 text-gray-500 text-sm">
                                                    No receipts added yet for this invoice.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {!invoices.some(inv => inv.Invoice_Number) && (
                                    <div className="text-center py-12 text-yellow-500/80 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                                        Please enter an Invoice Number in the Invoice Details tab to add Receipts.
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                <div className="p-6 border-t border-white/10 bg-dark-900 shrink-0 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={saving || isUnmerging}>{readOnly ? "Close" : "Cancel"}</Button>
                    {!readOnly && (
                        <Button type="submit" form="finance-form" disabled={saving || isUnmerging} className="min-w-[180px] justify-center">
                            {saving ? "Saving..." : (isUnmerging ? "Unmerging..." : (
                                <span className="flex items-center gap-2">
                                    <Save size={16} /> Save Finance Details
                                </span>
                            ))}
                        </Button>
                    )}
                </div>
            </motion.div>

            <AnimatePresence>
                {showUnmergeConfirm && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-panel bg-dark-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="text-red-400" size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-white">Unmerge Billables?</h3>
                            </div>
                            <p className="text-gray-400 text-sm mb-6">
                                Are you sure you want to unmerge these billables? All finance and receipt details will be cleared, and their status will revert to Billable.
                            </p>
                            <div className="flex justify-end gap-3">
                                <Button variant="ghost" onClick={() => setShowUnmergeConfirm(false)}>Cancel</Button>
                                <Button 
                                    className="bg-red-500 hover:bg-red-600 text-white border-none"
                                    onClick={executeUnmerge}
                                >
                                    Yes, Unmerge
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}