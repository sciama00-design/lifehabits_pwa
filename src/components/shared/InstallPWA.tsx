import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function InstallPWA() {
    const [promptInstall, setPromptInstall] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setPromptInstall(e);

            // Check if already shown this session
            const lastShown = sessionStorage.getItem('pwa-prompt-shown');
            if (!lastShown) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const onClick = (e: any) => {
        e.preventDefault();
        if (!promptInstall) return;
        promptInstall.prompt();
        promptInstall.userChoice.then((choiceResult: { outcome: string }) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
                setIsVisible(false);
            } else {
                console.log('User dismissed the A2HS prompt');
            }
            setPromptInstall(null);
        });
    };

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('pwa-prompt-shown', 'true');
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-24 left-4 right-4 z-[90] sm:bottom-8 sm:right-8 sm:left-auto sm:w-80"
            >
                <div className="bg-background/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />

                    <button
                        onClick={handleDismiss}
                        className="absolute top-3 right-3 p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex items-start gap-4 mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/20 shadow-inner">
                            <Download size={24} />
                        </div>
                        <div className="pt-0.5">
                            <h3 className="text-sm font-bold text-white mb-1">Installa NT Wellness</h3>
                            <p className="text-[11px] text-white/50 leading-relaxed font-medium"> Scarica l'app sul tuo dispositivo per un accesso rapido e l'uso offline. </p>
                        </div>
                    </div>

                    <button
                        onClick={onClick}
                        className="w-full py-3 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Installa Ora
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
