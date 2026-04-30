import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export const Button = ({ children, className, variant = "primary", ...props }) => {
    const variants = {
        primary: "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 font-bold",
        secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/10 backdrop-blur-sm",
        outline: "border border-primary text-primary hover:bg-primary/10 shadow-[0_0_10px_rgba(47,141,77,0.2)]",
        ghost: "hover:bg-white/5 text-gray-300 hover:text-white",
        danger: "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 hover:text-red-300"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "px-5 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </motion.button>
    );
};
