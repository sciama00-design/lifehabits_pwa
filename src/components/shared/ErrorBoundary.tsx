import { Component, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, Home, AlertCircle } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        window.location.href = '/';
    };

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-background p-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card max-w-md p-10 space-y-6 flex flex-col items-center shadow-2xl border-destructive/10"
                    >
                        <div className="bg-destructive/10 p-4 rounded-full border border-destructive/20 mb-2">
                            <AlertCircle className="w-10 h-10 text-destructive" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight">Oops! Qualcosa è andato storto</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Si è verificato un errore imprevisto. Abbiamo registrato l'accaduto e siamo al lavoro per risolverlo.
                            </p>
                        </div>

                        {import.meta.env.DEV && (
                            <div className="text-[10px] bg-muted/50 p-3 rounded-lg w-full text-left overflow-auto max-h-32 font-mono opacity-60 text-foreground">
                                {this.state.error?.message}
                            </div>
                        )}

                        <div className="flex flex-col w-full gap-3 pt-4">
                            <button
                                onClick={this.handleReload}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Riprova
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
                            >
                                <Home className="w-4 h-4" />
                                Torna alla Home
                            </button>
                        </div>
                    </motion.div>
                </div>
            );
        }

        return this.props.children;
    }
}
