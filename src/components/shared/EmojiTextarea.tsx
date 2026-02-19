import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (showPicker && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Default: show above and right-aligned to the button
            // 320 is picker height, + extra buffer to not cover content
            let top = rect.top - 375;
            // 260 is picker width
            let left = rect.right - 260;

            // Simple boundary checks
            if (top < 10) {
                // Not enough space above, put below
                top = rect.bottom + 10;
            }
            if (left < 10) {
                // Off screen to the left, align left to window
                left = 10;
            }

            setPosition({ top, left });
        }
    }, [showPicker]);

    // Handle clicks outside and scrolling/resizing
    useEffect(() => {
        if (!showPicker) return;

        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            // Ignore clicks inside the picker or on the toggle button
            if (pickerRef.current?.contains(target)) return;
            if (buttonRef.current?.contains(target)) return;
            setShowPicker(false);
        }

        function handleScroll(event: Event) {
            // Ignore scroll events that originate from inside the picker
            if (pickerRef.current?.contains(event.target as Node)) return;
            setShowPicker(false);
        }

        function handleResize() {
            setShowPicker(false);
        }

        // Use a small delay so the picker can mount before we start listening
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
        }, 50);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [showPicker]);

    const onEmojiClick = (emojiData: EmojiClickData) => {
        const textarea = document.getElementById('emoji-textarea') as HTMLTextAreaElement;
        const cursorPosition = textarea?.selectionStart || value.length;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const textAfterCursor = value.substring(cursorPosition);
        const newValue = textBeforeCursor + emojiData.emoji + textAfterCursor;
        onChange(newValue);
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
            <div className="absolute right-2 bottom-2">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => setShowPicker(!showPicker)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                    <Smile className="h-4 w-4" />
                </button>
            </div>

            {createPortal(
                <AnimatePresence>
                    {showPicker && (
                        <motion.div
                            ref={pickerRef}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{
                                position: 'fixed',
                                top: position.top,
                                left: position.left,
                                zIndex: 9999
                            }}
                            className="shadow-2xl rounded-xl overflow-hidden border border-white/10 font-sans"
                        >
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                theme={Theme.DARK}
                                width={260}
                                height={320}
                                searchDisabled
                                skinTonesDisabled
                                previewConfig={{ showPreview: false }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
