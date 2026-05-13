import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { DateInput } from "./ui/DateInput";

const exchangeRates = {
    "INR": 0.012,
    "EUR": 1.07,
    "GBP": 1.35,
    "CAD": 0.74,
    "AUD": 0.67,
    "USD": 1
};

export default function FinanceModal({ item, onClose, onSave, saving }) {
    const [financeData, setFinanceData] = useState({
        Billable_id: item.Billable_id || '',
        BlockName: item.BlockName || '',
        Billable_date: item.Billable_date || '',
        Billed_date: item.Billed_date || '',
        Expected_payment_date: item.Expected_payment_date || '',
        Due_date: item.Due_date || '',
        Invoice_Number: item.Invoice_Number || '',
        Billable_Amount_in_Home_Currency: item.Billable_Amount_in_Home_Currency || '',
        Home_Currency: item.Home_Currency || '',
        Billing_type: item.Billing_type || '',
        Exchange_Rate: item.Exchange_Rate || '',
        Billable_Amount_in_Inr: item.Billable_Amount_in_Inr || '',
        Billed_Amount_in_Inr: item.Billed_Amount_in_Inr || '',
        Exchange_Diff: item.Exchange_Diff || '',
        Bank_Charges: item.Bank_Charges || '',
        Finance_remarks: item.Finance_remarks || '',
        Tax_type: item.Tax_type || '',
        GST: item.GST || '',
        'Total Amount + GST (INR)': item['Total Amount + GST (INR)'] || '',
        GST_Received: item.GST_Received || '',
        GST_Date: item.GST_Date || '',
        TDS: item.TDS || '',
        VAT_UK: item.VAT_UK || ''
    });

    const [receipts, setReceipts] = useState(item.Receipts || []);
    const [deletedReceipts, setDeletedReceipts] = useState([]);

    useEffect(() => {
        // Auto-calculate Due Date (+30 days from Billed Date)
        if (financeData.Billed_date) {
            const billedDate = new Date(financeData.Billed_date);
            if (!isNaN(billedDate)) {
                billedDate.setDate(billedDate.getDate() + 30);
                const dueStr = billedDate.toISOString().split('T')[0];
                if (financeData.Due_date !== dueStr) {
                    setFinanceData(prev => ({ ...prev, Due_date: dueStr }));
                }
            }
        }
    }, [financeData.Billed_date]);

    const handleAmountChange = (field, value) => {
        const cleaned = String(value).replace(/[^0-9.-]+/g, "");
        const parsed = parseFloat(cleaned);
        
        let newFormData = { ...financeData, [field]: value };

        // If Exchange Rate changes, calculate Billed_Amount_in_Inr
        if (field === 'Exchange_Rate' || field === 'Billed_Amount_in_Inr') {
            const hcAmount = parseFloat(String(financeData.Billable_Amount_in_Home_Currency).replace(/[^0-9.-]+/g, "")) || 0;
            
            if (field === 'Exchange_Rate' && Number.isFinite(parsed) && Number.isFinite(hcAmount)) {
                // If they enter exchange rate manually
                // Typically Exchange Rate is HC to INR
                newFormData.Billed_Amount_in_Inr = String(Math.round(hcAmount * parsed));
            }
        }

        if (field === 'GST' || field === 'Billed_Amount_in_Inr') {
            const billedInr = parseFloat(String(newFormData.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0;
            const gstPercent = parseFloat(String(newFormData.GST).replace(/[^0-9.-]+/g, "")) || 0;
            const gstAmount = (billedInr * gstPercent) / 100;
            newFormData['Total Amount + GST (INR)'] = String(Math.round(billedInr + gstAmount));
        }

        setFinanceData(newFormData);
    };

    const addReceipt = () => {
        setReceipts([...receipts, { Receipt_date: '', Receipt_Amount: '', Receipt_Type: '' }]);
    };

    const removeReceipt = (index) => {
        const rec = receipts[index];
        if (rec.Receipt_id) {
            setDeletedReceipts([...deletedReceipts, rec.Receipt_id]);
        }
        setReceipts(receipts.filter((_, i) => i !== index));
    };

    const updateReceipt = (index, field, value) => {
        const newRecs = [...receipts];
        newRecs[index][field] = value;
        setReceipts(newRecs);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Auto-assign Receipt_Type based on index
        const processedReceipts = receipts.map((rec, idx) => ({
            ...rec,
            Receipt_Type: `Receipt_${idx + 1}`
        }));

        onSave({
            financeData,
            receiptsData: processedReceipts,
            deletedReceipts
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass-panel rounded-2xl w-full max-w-4xl border border-white/10 shadow-2xl shadow-primary/10 bg-[#0A0A0A] my-8 flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-dark-900 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Finance Details
                        </h2>
                        <div className="text-sm text-gray-400 mt-1">
                            {financeData.BlockName} <span className="mx-2 text-white/20">|</span> ID: {financeData.Billable_id}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="finance-form" onSubmit={handleSubmit} className="space-y-8">
                        
                        {/* Auto Populated Data (Read Only) */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Billable Date</label>
                                <div className="text-sm text-gray-300 font-medium">{financeData.Billable_date || '-'}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Amount ({financeData.Home_Currency || 'HC'})</label>
                                <div className="text-sm text-gray-300 font-mono">{financeData.Billable_Amount_in_Home_Currency || '-'}</div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Amount (INR)</label>
                                <div className="text-sm text-emerald-400 font-mono">{financeData.Billable_Amount_in_Inr || '-'}</div>
                            </div>
                        </div>

                        {/* Finance Inputs */}
                        <div>
                            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Billing Info</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input label="Invoice Number" value={financeData.Invoice_Number} onChange={(e) => setFinanceData({...financeData, Invoice_Number: e.target.value})} required />
                                <DateInput label="Billed Date" value={financeData.Billed_date} onChange={(e) => setFinanceData({...financeData, Billed_date: e.target.value})} />
                                <Select label="Billing Type" value={financeData.Billing_type} onChange={(e) => setFinanceData({...financeData, Billing_type: e.target.value})} options={[{value: '', label: 'Select'}, {value: 'Advance', label: 'Advance'}, {value: 'Credit Note', label: 'Credit Note'}, {value: 'Milestone', label: 'Milestone'}]} />
                            </div>
                        </div>

                        {/* Currency & Amounts */}
                        <div>
                            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Amounts & Exchange</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Input label="Exchange Rate" type="number" step="any" value={financeData.Exchange_Rate} onChange={(e) => handleAmountChange('Exchange_Rate', e.target.value)} />
                                <Input label="Billed Amount (INR)" type="number" value={financeData.Billed_Amount_in_Inr} onChange={(e) => handleAmountChange('Billed_Amount_in_Inr', e.target.value)} />
                                <Input label="Exchange Diff (INR)" type="number" value={financeData.Exchange_Diff} onChange={(e) => setFinanceData({...financeData, Exchange_Diff: e.target.value})} />
                                <Input label="Bank Charges" type="number" value={financeData.Bank_Charges} onChange={(e) => setFinanceData({...financeData, Bank_Charges: e.target.value})} />
                            </div>
                        </div>

                        {/* Tax Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Tax Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <Select label="Tax Type" value={financeData.Tax_type} onChange={(e) => setFinanceData({...financeData, Tax_type: e.target.value})} options={[{value: '', label: 'Select'}, {value: 'India', label: 'India'}, {value: 'UK', label: 'UK'}, {value: 'None', label: 'None'}]} />
                            </div>
                            
                            {financeData.Tax_type === 'India' && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                                    <Input label="GST (%)" type="number" value={financeData.GST} onChange={(e) => handleAmountChange('GST', e.target.value)} />
                                    <Input label="GST Amount (INR)" type="number" value={Math.round(((parseFloat(String(financeData.Billed_Amount_in_Inr).replace(/[^0-9.-]+/g, "")) || 0) * (parseFloat(String(financeData.GST).replace(/[^0-9.-]+/g, "")) || 0)) / 100) || 0} disabled className="bg-dark-800/50" />
                                    <Input label="Total + GST (INR)" type="number" value={financeData['Total Amount + GST (INR)']} disabled className="bg-dark-800/50" />
                                    <Input label="GST Received" type="number" value={financeData.GST_Received} onChange={(e) => setFinanceData({...financeData, GST_Received: e.target.value})} />
                                    <DateInput label="GST Date" value={financeData.GST_Date} onChange={(e) => setFinanceData({...financeData, GST_Date: e.target.value})} />
                                    <Input label="TDS" type="number" value={financeData.TDS} onChange={(e) => setFinanceData({...financeData, TDS: e.target.value})} />
                                </div>
                            )}

                            {financeData.Tax_type === 'UK' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                                    <Input label="VAT UK" type="number" value={financeData.VAT_UK} onChange={(e) => setFinanceData({...financeData, VAT_UK: e.target.value})} />
                                </div>
                            )}
                        </div>

                        {/* Remarks & Expected Date */}
                        <div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Finance Remarks" value={financeData.Finance_remarks} onChange={(e) => setFinanceData({...financeData, Finance_remarks: e.target.value})} />
                                <DateInput label="Expected Date" value={financeData.Expected_payment_date} onChange={(e) => setFinanceData({...financeData, Expected_payment_date: e.target.value})} />
                            </div>
                        </div>

                        {/* Receipts */}
                        {financeData.Invoice_Number && (
                            <div className="pt-4 border-t border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Receipts</h3>
                                    <Button type="button" variant="secondary" size="sm" onClick={addReceipt} className="gap-2">
                                        <Plus size={14} /> Add Receipt
                                    </Button>
                                </div>
                                
                                {receipts.length === 0 ? (
                                    <div className="text-center py-6 bg-dark-800/50 rounded-lg border border-white/5 text-gray-500 text-sm">
                                        No receipts added yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {receipts.map((rec, idx) => (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-dark-800/80 rounded-lg border border-white/10 relative pt-8 md:pt-4">
                                                <button type="button" onClick={() => removeReceipt(idx)} className="absolute top-2 right-2 text-red-400 hover:bg-red-400/10 rounded p-1 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                                <div>
                                                    <DateInput label="Receipt Date" value={rec.Receipt_date} onChange={(e) => updateReceipt(idx, 'Receipt_date', e.target.value)} />
                                                </div>
                                                <div>
                                                    <Input label="Receipt Amount" type="number" value={rec.Receipt_Amount} onChange={(e) => updateReceipt(idx, 'Receipt_Amount', e.target.value)} />
                                                </div>
                                                <div className="hidden">
                                                    <Input label="Receipt Type" value={`Receipt_${idx + 1}`} disabled />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {!financeData.Invoice_Number && (
                            <div className="pt-4 border-t border-white/10 text-sm text-yellow-500/80">
                                Please enter an Invoice Number to add Receipts.
                            </div>
                        )}
                    </form>
                </div>

                <div className="p-6 border-t border-white/10 bg-dark-900 shrink-0 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="finance-form" disabled={saving}>
                        {saving ? "Saving..." : (
                            <span className="flex items-center gap-2">
                                <Save size={16} /> Save Finance Details
                            </span>
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
