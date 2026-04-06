import { 
    MousePointer2, 
    Dot, 
    Ruler, 
    Spline, 
    Undo2,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Tool } from '@/pages/coach/PostureAnalysis';

interface PostureToolbarProps {
    activeTool: Tool;
    setActiveTool: (tool: Tool) => void;
    onReset: () => void;
    onDelete: () => void;
    onUndo: () => void;
    canUndo: boolean;
    hasSelection: boolean;
}

export function PostureToolbar({ activeTool, setActiveTool, onReset, onDelete, onUndo, canUndo, hasSelection }: PostureToolbarProps) {
    const tools = [
        { id: 'select' as Tool, icon: MousePointer2, label: 'Sposta / Seleziona' },
        { id: 'point' as Tool, icon: Dot, label: 'Punta' },
        { id: 'line' as Tool, icon: Ruler, label: 'Linea' },
        { id: 'parallel' as Tool, icon: Spline, label: 'Parallela' },
    ];

    return (
        <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full max-w-sm px-4"
        >
            <AnimatePresence>
                {hasSelection && (
                    <motion.button
                        initial={{ scale: 0.8, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 10 }}
                        onClick={onDelete}
                        className="bg-destructive text-destructive-foreground px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                        <Trash2 className="h-4 w-4" />
                        Elimina Selezione (Canc)
                    </motion.button>
                )}
            </AnimatePresence>

            <div className="glass-card flex items-center gap-1 p-1.5 rounded-full border border-white/20 shadow-2xl backdrop-blur-2xl">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool.id)}
                        className={clsx(
                            "group relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300",
                            activeTool === tool.id 
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                                : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                        )}
                        title={tool.label}
                    >
                        <tool.icon className={clsx(
                            "h-5 w-5 transition-transform duration-300",
                            activeTool === tool.id ? "scale-110" : "group-hover:scale-110"
                        )} />
                        
                        {/* Tooltip on Hover */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            {tool.label}
                        </div>
                    </button>
                ))}
                
                <div className="w-px h-8 bg-white/10 mx-1" />

                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={clsx(
                        "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300",
                        canUndo 
                            ? "text-muted-foreground hover:bg-white/10 hover:text-foreground" 
                            : "text-white/10 cursor-not-allowed"
                    )}
                    title="Annulla (Ctrl+Z)"
                >
                    <Undo2 className="h-5 w-5" />
                </button>

                <button
                    onClick={onReset}
                    className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
                    title="Resetta"
                >
                    <Trash2 className="h-5 w-5" />
                </button>
            </div>
        </motion.div>
    );
}
