import { createPortal } from 'react-dom';
import { X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface TextPostModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
    author?: string;
    date?: string;
}

export function TextPostModal({ isOpen, onClose, title, content, author, date }: TextPostModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-background/5 backdrop-blur-3xl p-4 sm:p-6"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden bg-background/80 border border-white/5 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex-none p-6 sm:p-8 flex items-start justify-between bg-gradient-to-b from-white/5 to-transparent">
                        <div className="flex flex-col gap-2 mr-4">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <MessageSquare className="h-4 w-4" />
                                </span>
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80">
                                    Comunicazione
                                </span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground leading-tight">
                                {title}
                            </h3>
                            {(author || date) && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mt-1">
                                    {author && <span>{author}</span>}
                                    {author && date && <span>•</span>}
                                    {date && <span>{date}</span>}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-none h-10 w-10 rounded-full flex items-center justify-center bg-muted/20 border border-white/5 text-foreground hover:bg-muted/40 transition-all hover:scale-110 active:scale-95"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-8 custom-scrollbar">
                        <div
                            className="prose dark:prose-invert prose-sm sm:prose-base max-w-none leading-relaxed text-muted-foreground/90"
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    </div>

                    {/* Footer Gradient */}
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
