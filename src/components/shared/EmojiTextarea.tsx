
import { useState, useRef, useEffect } from 'react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmojiTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export function EmojiTextarea({ value, onChange, placeholder, className, required }: EmojiTextareaProps) {
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowPicker(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const onEmojiClick = (emojiData: EmojiClickData) => {
        const cursorPosition = (document.getElementById('emoji-textarea') as HTMLTextAreaElement)?.selectionStart || value.length;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const textAfterCursor = value.substring(cursorPosition);
        const newValue = textBeforeCursor + emojiData.emoji + textAfterCursor;
        onChange(newValue);
        // Optional: Keep focus on textarea
    };

    return (
        <div className="relative">
            <textarea
                id="emoji-textarea"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={className}
                required={required}
            />
            <div className="absolute right-2 bottom-2" ref={pickerRef}>
                <button
                    type="button"
                    onClick={() => setShowPicker(!showPicker)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                    <Smile className="h-4 w-4" />
                </button>
                <AnimatePresence>
                    {showPicker && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute bottom-full right-0 mb-2 z-50 shadow-xl rounded-xl overflow-hidden border border-white/10"
                        >
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                theme={Theme.DARK}
                                width={300}
                                height={400}
                                searchDisabled
                                skinTonesDisabled
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
