import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, FileText } from "lucide-react";
import { useState, useEffect } from "react";

export default function ViewClientModal({ isOpen, onClose, project }) {
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (isOpen) setIsCopied(false);
    }, [isOpen]);

    if (!isOpen || !project) return null;

    const handleCopy = () => {
        const textToCopy = `Show Code\t${project.show_code || 'N/A'}
Client Code\t${project.client_code || 'N/A'}
Source\t${project.source || 'N/A'}
Brand\t${project.brand || 'N/A'}
Region\t${project.region || 'N/A'}
Territory\t${project.territory || 'N/A'}
Country\t${project.country || 'N/A'}
Currency\t${project.currency || 'N/A'}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/10 overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-primary/10 to-purple-500/10 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-semibold text-white">Client Details</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium text-gray-300 hover:text-white"
                            >
                                {isCopied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-400" />
                                        <span className="text-green-400">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <table className="w-full">
                            <tbody>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider w-1/3">Show Code</td>
                                    <td className="py-4 px-6 text-base font-mono font-semibold text-primary">{project.show_code || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Client Code</td>
                                    <td className="py-4 px-6 text-base text-white font-medium">{project.client_code || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Project Name</td>
                                    <td className="py-4 px-6 text-base text-gray-300">{project.project_name || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Source</td>
                                    <td className="py-4 px-6 text-base text-gray-300">{project.source || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Brand</td>
                                    <td className="py-4 px-6">
                                        <span className={`px-3 py-1 rounded-md text-xs font-medium border ${
                                            project.brand === 'PFX' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                            project.brand === 'TIPPETT' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                        }`}>
                                            {project.brand || 'N/A'}
                                        </span>
                                    </td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Region</td>
                                    <td className="py-4 px-6 text-base text-gray-300">{project.region || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Client Location</td>
                                    <td className="py-4 px-6 text-base text-gray-300">{project.client_location || project.territory || 'N/A'}</td>
                                </tr>
                                <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Country</td>
                                    <td className="py-4 px-6 text-base text-gray-300">{project.country || 'N/A'}</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-6 text-sm font-medium text-gray-400 uppercase tracking-wider">Currency</td>
                                    <td className="py-4 px-6 text-base text-gray-300">{project.currency || 'N/A'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
