import { useState, useEffect, useCallback } from 'react';
import { Download, X, Share, PlusSquare, Chrome, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 'native'  → Chrome/Edge/Android: browser fires beforeinstallprompt
// 'ios'     → iPhone/iPad in Safari: manual share instructions
// 'ios-chrome' → iPhone/iPad in Chrome: redirect to Safari
// 'android-manual' → Android, no prompt (already installed / prompt missed)
type InstallMode = 'native' | 'ios' | 'ios-chrome' | 'android-manual' | null;

const DISMISSED_KEY = 'pwa-install-dismissed-v2';

function detectIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function detectAndroid(): boolean {
    return /android/i.test(navigator.userAgent);
}

function isChrome(): boolean {
    // Chrome on iOS lies about userAgent, check CriOS
    return /CriOS/i.test(navigator.userAgent) || /Chrome/i.test(navigator.userAgent);
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
        // Never show if already installed / standalone
        if (isInStandaloneMode()) return;

        // Never show if user permanently dismissed
        if (localStorage.getItem(DISMISSED_KEY)) return;

        const ios = detectIOS();
        const android = detectAndroid();

        if (ios) {
            // iOS Chrome (CriOS) — can't install from Chrome, must use Safari
            if (isChrome()) {
                setInstallMode('ios-chrome');
                setIsVisible(true);
            } else {
                // Assume Safari (or Firefox which also can't install) → show share guide
                setInstallMode('ios');
                setIsVisible(true);
            }
            return;
        }

        // Android / Desktop Chrome/Edge — listen for native install prompt
        const handler = (e: Event) => {
            e.preventDefault();
            setPromptInstall(e);
            setInstallMode('native');
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Android fallback: if prompt never fires and we're on Android, show manual instructions
        const timer = setTimeout(() => {
            if (android && !promptInstall) {
                setInstallMode('android-manual');
                setIsVisible(true);
            }
        }, 4000);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        const handler = () => {
            setIsVisible(false);
            setPromptInstall(null);
        };
        window.addEventListener('appinstalled', handler);
        return () => window.removeEventListener('appinstalled', handler);
    }, []);

    const handleDismiss = useCallback(() => {
        setIsVisible(false);
        // Permanently dismiss (until browser storage cleared)
        localStorage.setItem(DISMISSED_KEY, 'true');
    }, []);

    const handleInstallClick = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        if (installMode === 'native' && promptInstall) {
            try {
                await promptInstall.prompt();
                await promptInstall.userChoice;
            } catch (err) {
                console.error('Error during PWA installation:', err);
            } finally {
                setIsVisible(false);
                setPromptInstall(null);
            }
        }
    }, [installMode, promptInstall]);

    if (!isVisible || !installMode) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="install-pwa"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed bottom-24 left-4 right-4 z-[90] sm:bottom-8 sm:right-8 sm:left-auto sm:w-80"
            >
                <div className="bg-background/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />

                    {/* Dismiss X */}
                    <button
                        onClick={handleDismiss}
                        aria-label="Chiudi"
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-white/40 hover:text-white transition-colors z-10"
                    >
                        <X size={14} />
                    </button>

                    <div className="flex items-start gap-4 mb-4">
                        <div className="h-11 w-11 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/20 shadow-inner">
                            {installMode === 'ios-chrome' ? <Chrome size={22} /> :
                                installMode === 'android-manual' ? <Smartphone size={22} /> :
                                    <Download size={22} />}
                        </div>
                        <div className="pt-0.5 pr-5">
                            <h3 className="text-sm font-bold text-white mb-1">Installa LifeHabits</h3>

                            {/* iOS Safari */}
                            {installMode === 'ios' && (
                                <div className="text-[11px] text-white/50 leading-relaxed font-medium space-y-2">
                                    <p>Per installare l'app su iPhone:</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-white/10 text-white/70 shrink-0">
                                            <Share size={11} />
                                        </span>
                                        <span>Tocca <strong className="text-white/80">Condividi</strong> (□↑)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-white/10 text-white/70 shrink-0">
                                            <PlusSquare size={11} />
                                        </span>
                                        <span>Poi <strong className="text-white/80">"Aggiungi a Home"</strong></span>
                                    </div>
                                </div>
                            )}

                            {/* iOS Chrome */}
                            {installMode === 'ios-chrome' && (
                                <p className="text-[11px] text-white/50 leading-relaxed font-medium">
                                    Su iPhone, l'installazione PWA funziona solo da <strong className="text-white/70">Safari</strong>.
                                    Apri questa pagina in Safari e segui le istruzioni.
                                </p>
                            )}

                            {/* Android native prompt */}
                            {installMode === 'native' && (
                                <p className="text-[11px] text-white/50 leading-relaxed font-medium">
                                    Aggiungi LifeHabits alla schermata Home per accesso rapido e notifiche.
                                </p>
                            )}

                            {/* Android manual */}
                            {installMode === 'android-manual' && (
                                <div className="text-[11px] text-white/50 leading-relaxed font-medium space-y-1.5">
                                    <p>Per installare su Android:</p>
                                    <p>Menu Chrome (⋮) → <strong className="text-white/70">"Aggiungi a schermata Home"</strong></p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Native install button (Android/Desktop) */}
                    {installMode === 'native' && (
                        <button
                            onClick={handleInstallClick}
                            className="w-full py-3 px-4 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Installa Ora
                        </button>
                    )}

                    {/* Dismiss button for instruction-only modes */}
                    {(installMode === 'ios' || installMode === 'ios-chrome' || installMode === 'android-manual') && (
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
