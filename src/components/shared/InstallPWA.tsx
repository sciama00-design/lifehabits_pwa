import { useState, useEffect, useCallback } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type InstallMode = 'native' | 'ios' | null;

function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode(): boolean {
    return ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
        window.matchMedia('(display-mode: standalone)').matches;
}

export function InstallPWA() {
    const [promptInstall, setPromptInstall] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [installMode, setInstallMode] = useState<InstallMode>(null);

    useEffect(() => {
        // Don't show if already installed as PWA
        if (isInStandaloneMode()) return;

        // Check if dismissed this session
        const dismissed = sessionStorage.getItem('pwa-prompt-shown');
        if (dismissed) return;

        // For iOS Safari – show manual instructions
        if (isIOS()) {
            setInstallMode('ios');
            setIsVisible(true);
            return;
        }

        // For Chrome/Edge/Android – listen for native install prompt
        const handler = (e: Event) => {
            e.preventDefault();
            setPromptInstall(e);
            setInstallMode('native');
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // Also listen to appinstalled to hide the banner
    useEffect(() => {
        const handler = () => {
            setIsVisible(false);
            setPromptInstall(null);
        };
        window.addEventListener('appinstalled', handler);
        return () => window.removeEventListener('appinstalled', handler);
    }, []);

    const handleInstallClick = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();

        if (installMode === 'native' && promptInstall) {
            try {
                await promptInstall.prompt();
                const choiceResult = await promptInstall.userChoice;

                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
            } catch (err) {
                console.error('Error during PWA installation:', err);
            } finally {
                setIsVisible(false);
                setPromptInstall(null);
            }
        }
        // iOS mode is handled differently – the button isn't shown, instructions are
    }, [installMode, promptInstall]);

    const handleDismiss = useCallback(() => {
        setIsVisible(false);
        sessionStorage.setItem('pwa-prompt-shown', 'true');
    }, []);

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
                        className="absolute top-3 right-3 p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors z-10"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex items-start gap-4 mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/20 shadow-inner">
                            <Download size={24} />
                        </div>
                        <div className="pt-0.5">
                            <h3 className="text-sm font-bold text-white mb-1">Installa LifeHabits</h3>
                            {installMode === 'ios' ? (
                                <div className="text-[11px] text-white/50 leading-relaxed font-medium space-y-2">
                                    <p>Per installare l'app su iOS:</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-white/10 text-white/70 shrink-0">
                                            <Share size={12} />
                                        </span>
                                        <span>Tocca il pulsante <strong className="text-white/80">Condividi</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-white/10 text-white/70 shrink-0">
                                            <PlusSquare size={12} />
                                        </span>
                                        <span>Poi seleziona <strong className="text-white/80">"Aggiungi alla schermata Home"</strong></span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] text-white/50 leading-relaxed font-medium">
                                    Scarica l'app sul tuo dispositivo per un accesso rapido e l'uso offline.
                                </p>
                            )}
                        </div>
                    </div>

                    {installMode === 'native' && (
                        <button
                            onClick={handleInstallClick}
                            className="w-full py-3 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Installa Ora
                        </button>
                    )}

                    {installMode === 'ios' && (
                        <button
                            onClick={handleDismiss}
                            className="w-full py-3 px-4 rounded-2xl bg-white/10 text-white/70 text-xs font-bold uppercase tracking-widest hover:bg-white/15 active:scale-[0.98] transition-all"
                        >
                            Ho capito!
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
