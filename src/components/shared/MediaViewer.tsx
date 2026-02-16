import { createPortal } from 'react-dom';
import { X, FileText, Play, Pause, Volume2, Maximize2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import Player from '@vimeo/player';
import clsx from 'clsx';
import { ProtectedYouTubePlayer } from './ProtectedYouTubePlayer';
import { extractYouTubeId } from '@/lib/youtubeProtection';

interface MediaViewerProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'pdf' | 'video' | 'habit' | 'post';
    url: string | null;
    title: string;
    description?: string | null;
    thumbnailUrl?: string | null;
}

export function MediaViewer({ isOpen, onClose, type, url, title, description, thumbnailUrl }: MediaViewerProps) {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showControls, setShowControls] = useState(false);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<Player | null>(null);
    const hideTimeoutRef = useRef<any>(null);

    const resetHideTimeout = () => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            resetHideTimeout();
        } else {
            document.body.style.overflow = 'unset';
            setCurrentTime(0);
            setDuration(0);
            setIsPlaying(true);
            setShowControls(false);
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && iframeRef.current && url?.includes('vimeo.com')) {
            const player = new Player(iframeRef.current);
            playerRef.current = player;

            player.on('timeupdate', (data) => {
                if (!isSeeking) {
                    setCurrentTime(data.seconds);
                }
            });

            player.on('loaded', async () => {
                const d = await player.getDuration();
                setDuration(d);
            });

            player.on('play', () => setIsPlaying(true));
            player.on('pause', () => {
                setIsPlaying(false);
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                setShowControls(true);
            });

            return () => {
                player.unload();
                playerRef.current = null;
            };
        }
    }, [isOpen, url, isSeeking]);

    if (!isOpen) return null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSeek = async (e: React.ChangeEvent<HTMLInputElement>) => {
        resetHideTimeout();
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (playerRef.current) {
            await playerRef.current.setCurrentTime(time);
        }
    };

    const togglePlay = async () => {
        resetHideTimeout();
        if (playerRef.current) {
            const paused = await playerRef.current.getPaused();
            if (paused) {
                playerRef.current.play();
            } else {
                playerRef.current.pause();
            }
        }
    };

    const getEmbedUrl = (link: string) => {
        try {
            const url = new URL(link);
            if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
                let videoId = '';
                if (url.hostname.includes('youtu.be')) {
                    videoId = url.pathname.slice(1);
                } else if (url.pathname.includes('/shorts/')) {
                    videoId = url.pathname.split('/shorts/')[1]?.split(/[?#]/)[0];
                } else if (url.pathname.includes('/live/')) {
                    videoId = url.pathname.split('/live/')[1]?.split(/[?#]/)[0];
                } else {
                    videoId = url.searchParams.get('v') || '';
                }

                if (!videoId && url.pathname.includes('/embed/')) {
                    videoId = url.pathname.split('/embed/')[1]?.split(/[?#]/)[0];
                }

                if (videoId) {
                    const params = new URLSearchParams({
                        autoplay: '1',
                        rel: '0',
                        modestbranding: '1',
                        mute: '0',
                        controls: '1',
                        origin: window.location.origin
                    });
                    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
                }
            } else if (url.hostname.includes('vimeo.com')) {
                // Support both /videoID and /videoID/hash formats
                const match = url.pathname.match(/^\/(\d+)(?:\/([a-z0-9]+))?/);
                if (match) {
                    const videoId = match[1];
                    let hash = match[2] || url.searchParams.get('h');

                    const params = new URLSearchParams({
                        autoplay: '1',
                        title: '0',
                        byline: '0',
                        portrait: '0',
                        controls: '0',
                    });

                    if (hash) params.set('h', hash);
                    return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
                }
            }
        } catch (e) {
            if (link.includes('vimeo.com')) {
                const parts = link.split('vimeo.com/')[1]?.split(/[/?]/);
                const videoId = parts?.[0];
                const hash = parts?.[1]?.length > 5 ? parts[1] : undefined; // Basic heuristic for hash

                const queryParams = new URLSearchParams({
                    autoplay: '1',
                    title: '0',
                    byline: '0',
                    portrait: '0',
                    controls: '0'
                });
                if (hash) queryParams.set('h', hash);

                return `https://player.vimeo.com/video/${videoId}?${queryParams.toString()}`;
            } else if (link.includes('youtube.com') || link.includes('youtu.be')) {
                // Fallback for non-URL-parsable strings if any
                let videoId = '';
                if (link.includes('v=')) videoId = link.split('v=')[1]?.split('&')[0];
                else if (link.includes('youtu.be/')) videoId = link.split('youtu.be/')[1]?.split('?')[0];
                else if (link.includes('/shorts/')) videoId = link.split('/shorts/')[1]?.split(/[?#]/)[0];

                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&controls=1`;
                }
            }
        }
        return null;
    };

    const isVideo = type === 'video' && url;
    const isVimeo = url?.includes('vimeo.com');
    const isYouTube = url ? (url.includes('youtube.com') || url.includes('youtu.be')) : false;
    const youtubeVideoId = (isYouTube && url) ? extractYouTubeId(url) : null;
    const isPDF = type === 'pdf' || (url && url.toLowerCase().split('?')[0].endsWith('.pdf'));

    const isImage = url && (
        url.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i) ||
        (url.includes('/storage/v1/object/public/') &&
            !url.toLowerCase().includes('.pdf') &&
            !url.toLowerCase().includes('.mp4') &&
            !url.toLowerCase().includes('.mov'))
    );
    const embedUrl = url ? getEmbedUrl(url) : null;

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
                    className="relative w-full h-full flex flex-col items-center justify-center max-w-5xl mx-auto rounded-3xl sm:rounded-[3rem] overflow-hidden bg-black/40 border border-white/5 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Overlay */}
                    <div className="absolute top-0 left-0 right-0 p-5 sm:p-8 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
                        <div className="flex flex-col">
                            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] sm:max-w-md">{title}</h3>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1 opacity-80">Media Hub</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-12 w-12 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white transition-all hover:bg-white/10 hover:scale-110 active:scale-90"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="w-full h-full flex flex-col items-center bg-black/20">
                        <div className="w-full flex-1 flex items-center justify-center p-4 pt-24 pb-4 overflow-hidden">
                            {/* Protected YouTube Player */}
                            {isVideo && isYouTube && youtubeVideoId ? (
                                <div
                                    className="relative group w-full sm:w-[360px] max-w-lg aspect-[9/16] max-h-[75vh] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 bg-black"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ProtectedYouTubePlayer
                                        videoId={youtubeVideoId}
                                        className="w-full h-full"
                                        autoplay={true}
                                        thumbnailUrl={thumbnailUrl}
                                    />
                                </div>
                            ) : isVideo && embedUrl ? (
                                <div
                                    className="relative group w-full sm:w-[360px] max-w-lg aspect-[9/16] max-h-[75vh] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 bg-black cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        resetHideTimeout();
                                    }}
                                    onMouseMove={resetHideTimeout}
                                >
                                    <iframe
                                        ref={iframeRef}
                                        src={embedUrl}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        referrerPolicy="strict-origin-when-cross-origin"
                                    />

                                    {/* Custom Controls for Vimeo */}
                                    {isVimeo && (
                                        <div
                                            className={clsx(
                                                "absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-500",
                                                showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex flex-col gap-6">
                                                {/* Progress Bar */}
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-bold text-white/40 tabular-nums w-8">{formatTime(currentTime)}</span>
                                                    <div className="relative flex-1 group/progress">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max={duration || 100}
                                                            value={currentTime}
                                                            onChange={handleSeek}
                                                            onMouseDown={() => {
                                                                setIsSeeking(true);
                                                                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                                                            }}
                                                            onMouseUp={() => {
                                                                setIsSeeking(false);
                                                                resetHideTimeout();
                                                            }}
                                                            className="w-full h-[3px] bg-white/10 rounded-full appearance-none cursor-pointer accent-primary relative z-10"
                                                        />
                                                        <div
                                                            className="absolute top-0 left-0 h-[3px] bg-primary rounded-full transition-all duration-200 pointer-events-none"
                                                            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-white/40 tabular-nums w-8 text-right">{formatTime(duration)}</span>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center justify-between">
                                                    <button
                                                        onClick={togglePlay}
                                                        className="h-10 w-10 flex items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-110 active:scale-95"
                                                    >
                                                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                                                    </button>
                                                    <div className="flex items-center gap-6">
                                                        <button className="text-white/40 hover:text-white transition-colors">
                                                            <Volume2 className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            className="text-white/40 hover:text-white transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                iframeRef.current?.parentElement?.requestFullscreen();
                                                            }}
                                                        >
                                                            <Maximize2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : isPDF ? (
                                <div className="w-full h-full glass-card rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col max-w-3xl">
                                    <iframe
                                        src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                                        className="w-full h-full border-none invert dark:invert-0 opacity-90"
                                        title={title}
                                    />
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4 p-8 rounded-[2rem] glass-card border-white/10 text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="h-16 w-16 flex items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
                                            <FileText className="h-8 w-8" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-white/60">Contenuto Professionale</span>
                                    </div>
                                </div>
                            ) : isImage ? (
                                <div className="relative group">
                                    <motion.img
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        src={url!}
                                        alt={title}
                                        className="max-w-full max-h-[60vh] object-contain rounded-[2rem] shadow-2xl border border-white/5"
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-6 text-center max-w-xs">
                                    <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-white/5 border border-white/5">
                                        <FileText className="h-10 w-10 text-white/20" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-white mb-2">Formato non supportato</h4>
                                        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Visualizza il contenuto in una nuova finestra dedicata.</p>
                                    </div>
                                    {url && (
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            Apri Collegamento Esterno
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Description Section */}
                        {description && (
                            <div className="w-full max-w-3xl px-6 sm:px-8 pb-8 sm:pb-12 overflow-y-auto max-h-[25vh] custom-scrollbar">
                                <div
                                    className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: description }}
                                />
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}
