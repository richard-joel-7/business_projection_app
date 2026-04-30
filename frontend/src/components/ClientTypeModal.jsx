import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Users, X } from "lucide-react";

export default function ClientTypeModal({ isOpen, onClose, onSelect }) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="glass-panel rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl shadow-primary/10 relative overflow-hidden bg-[#0A0A0A]"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full z-10"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-8 text-center">
                        <h2 className="text-2xl font-bold text-white mb-2">Create New Project</h2>
                        <p className="text-gray-400 mb-8">Is this for a new client or an existing one?</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => onSelect('new')}
                                className="group flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-black transition-colors">
                                    <UserPlus size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">New Client</h3>
                                <p className="text-xs text-gray-400 group-hover:text-gray-300">Add a completely new client to the database</p>
                            </button>

                            <button
                                onClick={() => onSelect('existing')}
                                className="group flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-primary/10 hover:border-primary/50 transition-all duration-300"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-black transition-colors">
                                    <Users size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">Existing Client</h3>
                                <p className="text-xs text-gray-400 group-hover:text-gray-300">Select from your existing client list</p>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
