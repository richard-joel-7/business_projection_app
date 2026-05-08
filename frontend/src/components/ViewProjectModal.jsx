import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import ProjectExpandedPanel from './ProjectExpandedPanel';

export default function ViewProjectModal({
    isOpen,
    onClose,
    project,
    displayCurrency,
    formatExactAmount,
    formatDisplayAmount,
    timelineFilter,
    selectedYears,
    selectedMonths,
    yearType,
    isDateWithinTimeline
}) {
    if (!isOpen || !project) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-panel w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-2xl border border-white/10"
                >
                    <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-start sm:items-center bg-dark-800/50">
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-white">Project Details</h2>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1">{project.DealName || project.Block_Name || 'Untitled Project'}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-0">
                        <ProjectExpandedPanel
                            project={project}
                            displayCurrency={displayCurrency}
                            formatExactAmount={formatExactAmount}
                            formatDisplayAmount={formatDisplayAmount}
                            timelineFilter={timelineFilter}
                            selectedYears={selectedYears}
                            selectedMonths={selectedMonths}
                            yearType={yearType}
                            isDateWithinTimeline={isDateWithinTimeline}
                        />
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
