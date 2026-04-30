import { cn } from "../../lib/utils";

export const Input = ({ label, error, className, ...props }) => {
    return (
        <div className="flex flex-col gap-1.5">
            {label && <label className="text-sm font-medium text-gray-300 ml-1">{label}</label>}
            <input
                className={cn(
                    "px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 backdrop-blur-sm hover:bg-white/10",
                    error && "border-red-500/50 focus:ring-red-500/20",
                    className
                )}
                {...props}
            />
            {error && <span className="text-xs text-red-400 ml-1">{error}</span>}
        </div>
    );
};
