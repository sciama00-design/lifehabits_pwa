import { useState, useRef, useEffect } from 'react';
import { 
    Upload, 
    Download, 
    Plus, 
    ChevronLeft, 
    ChevronRight,
    Ruler,
    ArrowLeft,
    Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { PostureCanvas } from '@/components/coach/posture/PostureCanvas';
import { PostureToolbar } from '@/components/coach/posture/PostureToolbar';

export interface Point {
    id: string;
    x: number; // 0 to 100 (percentage)
    y: number; // 0 to 100 (percentage)
}

export interface Line {
    id: string;
    p1Id: string;
    p2Id: string;
    type: 'basic' | 'parallel';
    refLineId?: string;
}

export interface PhotoAnalysis {
    id: string;
    url: string;
    points: Point[];
    lines: Line[];
}

export type Tool = 'select' | 'point' | 'line' | 'parallel';

export default function PostureAnalysis() {
    const [photos, setPhotos] = useState<PhotoAnalysis[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeTool, setActiveTool] = useState<Tool>('point');
    const [isExporting, setIsExporting] = useState(false);
    const [selectedItem, setSelectedItem] = useState<{ type: 'point' | 'line', id: string } | null>(null);
    const [history, setHistory] = useState<PhotoAnalysis[][]>([]);
    
    // Save to history before any state change that affects points/lines
    const saveToHistory = (currentPhotos: PhotoAnalysis[]) => {
        setHistory(prev => [JSON.parse(JSON.stringify(currentPhotos)), ...prev].slice(0, 20));
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const [lastState, ...remainingHistory] = history;
        setPhotos(lastState);
        setHistory(remainingHistory);
        setSelectedItem(null);
    };
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newPhotos: PhotoAnalysis[] = Array.from(files).map(file => ({
            id: crypto.randomUUID(),
            url: URL.createObjectURL(file),
            points: [],
            lines: []
        }));

        setPhotos(prev => [...prev, ...newPhotos]);
        if (photos.length === 0) setActiveIndex(0);
    };

    const updateActiveAnalysis = (update: Partial<PhotoAnalysis>) => {
        saveToHistory(photos);
        setPhotos(prev => prev.map((p, i) => i === activeIndex ? { ...p, ...update } : p));
    };

    const handleDeleteSelection = () => {
        if (!selectedItem) return;

        const currentPhoto = photos[activeIndex];
        if (selectedItem.type === 'point') {
            const newPoints = currentPhoto.points.filter(p => p.id !== selectedItem.id);
            // Also delete lines connected to this point
            const newLines = currentPhoto.lines.filter(l => l.p1Id !== selectedItem.id && l.p2Id !== selectedItem.id);
            updateActiveAnalysis({ points: newPoints, lines: newLines });
        } else {
            const newLines = currentPhoto.lines.filter(l => l.id !== selectedItem.id);
            updateActiveAnalysis({ lines: newLines });
        }
        setSelectedItem(null);
    };

    const handleReset = () => {
        if (confirm('Sei sicuro di voler resettare l\'analisi per questa foto?')) {
            updateActiveAnalysis({ points: [], lines: [] });
            setSelectedItem(null);
        }
    };

    const handleDeletePhoto = () => {
        if (photos.length <= 1) {
            if (confirm('Vuoi eliminare l\'unica foto e ricominciare?')) {
                URL.revokeObjectURL(photos[0].url);
                setPhotos([]);
                setActiveIndex(0);
            }
            return;
        }

        if (confirm('Eliminare questa foto dal progetto?')) {
            const photoToDelete = photos[activeIndex];
            URL.revokeObjectURL(photoToDelete.url);
            
            const newPhotos = photos.filter((_, i) => i !== activeIndex);
            setPhotos(newPhotos);
            setActiveIndex(Math.max(0, activeIndex - 1));
            setSelectedItem(null);
        }
    };

    const downloadResult = async () => {
        setIsExporting(true);
        // Logic will be triggered in the canvas component
    };

    const onExportComplete = () => {
        setIsExporting(false);
    };

    // Handle Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                handleDeleteSelection();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, photos, activeIndex]);

    if (photos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in duration-500 max-w-2xl mx-auto">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Ruler className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-black mb-2 tracking-tighter">Analisi Posturale</h1>
                <p className="text-muted-foreground max-w-md mb-8 font-medium">
                    Carica una o due foto del paziente per iniziare l'analisi e valutare i miglioramenti posturali.
                </p>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                    <Upload className="w-5 h-5" />
                    Carica Foto
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleUpload} 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                />
            </div>
        );
    }

    const currentPhoto = photos[activeIndex];

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden animate-in fade-in duration-500"
        >
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 z-50 p-4 md:px-8 pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-10 flex items-center justify-between">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 text-white/70 hover:text-white transition-colors bg-black/20 rounded-full backdrop-blur-md border border-white/10"
                        title="Torna Indietro"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-bold hidden md:block text-white drop-shadow-md">
                        Analisi Posturale
                    </h2>
                    <div className="flex bg-muted/50 p-1 rounded-full border border-border overflow-x-auto no-scrollbar max-w-[200px] md:max-w-md">
                        {photos.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setActiveIndex(idx);
                                    setSelectedItem(null);
                                }}
                                className={clsx(
                                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                                    activeIndex === idx ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Foto {idx + 1}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                    <button 
                        onClick={handleDeletePhoto}
                        className="p-2 text-white/50 hover:text-destructive transition-colors bg-black/20 rounded-full backdrop-blur-md"
                        title="Elimina Foto"
                    >
                        <Trash className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-white/50 hover:text-primary transition-colors bg-black/20 rounded-full backdrop-blur-md"
                        title="Aggiungi Foto"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={downloadResult}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/20"
                    >
                        <Download className="w-4 h-4" />
                        Scarica
                    </button>
                </div>
            </div>

            {/* Workspace */}
            <div className="flex-1 relative overflow-hidden shadow-inner cursor-crosshair bg-black">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPhoto.id}
                        initial={{ opacity: 0, x: activeIndex === 1 ? 50 : -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: activeIndex === 1 ? -50 : 50 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="absolute inset-0"
                    >
                        <PostureCanvas 
                            photo={currentPhoto}
                            activeTool={activeTool}
                            updateAnalysis={updateActiveAnalysis}
                            isExporting={isExporting}
                            onExportComplete={onExportComplete}
                            selectedItem={selectedItem}
                            setSelectedItem={setSelectedItem}
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Navigation Arrows for Swipe Feeling */}
                {photos.length > 1 && (
                    <>
                        <button 
                            onClick={() => {
                                setActiveIndex(prev => (prev === 0 ? 1 : 0));
                                setSelectedItem(null);
                            }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors z-20 border border-white/10"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button 
                            onClick={() => {
                                setActiveIndex(prev => (prev === 0 ? 1 : 0));
                                setSelectedItem(null);
                            }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors z-20 border border-white/10"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </>
                )}

                {/* Tool Selection (Mobile Bottom / Floating) */}
                <PostureToolbar 
                    activeTool={activeTool} 
                    setActiveTool={setActiveTool} 
                    onReset={handleReset}
                    onDelete={handleDeleteSelection}
                    onUndo={handleUndo}
                    canUndo={history.length > 0}
                    hasSelection={!!selectedItem}
                />
            </div>

            {/* Hidden Input for adding more photos if needed (limit is 2 for now) */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                multiple 
                accept="image/*" 
                className="hidden" 
            />
        </div>
    );
}
