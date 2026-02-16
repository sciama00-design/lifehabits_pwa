import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import clsx from 'clsx';

/// <reference types="youtube" />

declare global {
    interface Window {
        onYouTubeIframeAPIReady: (() => void) | undefined;
    }
}

interface ProtectedYouTubePlayerProps {
    videoId: string;
    className?: string;
    autoplay?: boolean;
    thumbnailUrl?: string | null;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onReady?: () => void;
}

// ── Script loader singleton ────────────────────────────────────────────────
let apiReady = false;
let apiLoading = false;
const readyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
    return new Promise((resolve) => {
        if (apiReady) { resolve(); return; }
        readyCallbacks.push(resolve);
        if (apiLoading) return;
        apiLoading = true;

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);

        window.onYouTubeIframeAPIReady = () => {
            apiReady = true;
            readyCallbacks.forEach((cb) => cb());
            readyCallbacks.length = 0;
        };
    });
}

// ── Component ──────────────────────────────────────────────────────────────
export function ProtectedYouTubePlayer({
    videoId,
    className,
    autoplay = true,
    thumbnailUrl,
    onTimeUpdate,
    onReady,
}: ProtectedYouTubePlayerProps) {
    const mountRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YT.Player | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isEnded, setIsEnded] = useState(false);

    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetHideTimeout = useCallback(() => {
        setShowControls(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    }, []);

    // ── Bootstrap YT Player ────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            await loadYouTubeAPI();
            if (cancelled || !mountRef.current) return;

            const el = document.createElement('div');
            el.id = `yt-protected-${Date.now()}`;
            mountRef.current.innerHTML = '';
            mountRef.current.appendChild(el);

            playerRef.current = new window.YT.Player(el.id, {
                videoId,
                width: '100%',
                height: '100%',
                playerVars: {
                    autoplay: autoplay ? 1 : 0,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    playsinline: 1,
                    origin: window.location.origin,
                },
                events: {
                    onReady: (e: YT.PlayerEvent) => {
                        if (cancelled) return;
                        setIsReady(true);
                        setDuration(e.target.getDuration());

                        try {
                            const iframe = e.target.getIframe();
                            iframe.style.width = '100%';
                            iframe.style.height = '100%';
                            iframe.style.position = 'absolute';
                            iframe.style.top = '0';
                            iframe.style.left = '0';
                        } catch { /* ignore */ }

                        if (intervalRef.current) clearInterval(intervalRef.current);
                        intervalRef.current = setInterval(() => {
                            const p = playerRef.current;
                            if (!p) return;
                            try {
                                const t = p.getCurrentTime?.() ?? 0;
                                const d = p.getDuration?.() ?? 0;
                                setCurrentTime(t);
                                if (d > 0) setDuration(d);
                                onTimeUpdate?.(t, d);
                            } catch { /* player not ready */ }
                        }, 500);

                        onReady?.();
                    },
                    onStateChange: (e: YT.OnStateChangeEvent) => {
                        if (cancelled) return;
                        switch (e.data) {
                            case window.YT.PlayerState.PLAYING:
                                setIsPlaying(true);
                                setIsEnded(false);
                                break;
                            case window.YT.PlayerState.PAUSED:
                                setIsPlaying(false);
                                break;
                            case window.YT.PlayerState.ENDED:
                                setIsPlaying(false);
                                setIsEnded(true);
                                setShowControls(false);
                                break;
                        }
                    },
                },
            });
        })();

        return () => {
            cancelled = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            try { playerRef.current?.destroy(); } catch { /* ignore */ }
            playerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    const togglePlay = useCallback(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
            const state = p.getPlayerState();
            if (state === window.YT.PlayerState.PLAYING) {
                p.pauseVideo();
            } else {
                p.playVideo();
            }
        } catch { /* ignore */ }
    }, []);

    const toggleMute = useCallback(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
            if (p.isMuted()) {
                p.unMute();
                setIsMuted(false);
            } else {
                p.mute();
                setIsMuted(true);
            }
        } catch { /* ignore */ }
    }, []);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        playerRef.current?.seekTo(time, true);
    };

    const handleFullscreen = () => {
        containerRef.current?.requestFullscreen?.();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            className={clsx('relative overflow-hidden bg-black select-none', className)}
            onContextMenu={(e) => e.preventDefault()}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        >
            {/* YT Player mount point */}
            <div
                ref={mountRef}
                className="absolute inset-0"
                style={{ pointerEvents: 'none' }}
            />

            {/* Transparent overlay — blocks direct iframe interaction, toggles controls on tap */}
            <div
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    if (showControls) {
                        setShowControls(false);
                        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                    } else {
                        resetHideTimeout();
                    }
                }}
                aria-hidden="true"
            />

            {/* Loading spinner */}
            {!isReady && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
            )}

            {/* End screen — thumbnail + replay */}
            {isEnded && (
                <div
                    className="absolute inset-0 z-30 flex items-center justify-center bg-black cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        playerRef.current?.seekTo(0, true);
                        playerRef.current?.playVideo();
                    }}
                >
                    {thumbnailUrl && (
                        <img
                            src={thumbnailUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-80"
                        />
                    )}
                    <div className="relative flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95">
                            <Play className="w-6 h-6 text-black fill-current ml-0.5" />
                        </div>
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Riproduci</span>
                    </div>
                </div>
            )}

            {/* Custom Control Bar */}
            <div
                className={clsx(
                    'absolute inset-x-0 bottom-0 z-20 px-5 pb-5 pt-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-500 pointer-events-none',
                    showControls ? 'opacity-100' : 'opacity-0'
                )}
            >
                <div className="flex flex-col gap-4 pointer-events-auto">
                    {/* Progress Bar — custom styled */}
                    <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-bold text-white/50 tabular-nums w-8 text-center">
                            {formatTime(currentTime)}
                        </span>

                        <div
                            className="relative flex-1 h-5 flex items-center cursor-pointer group/seek"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Track background */}
                            <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/15" />
                            {/* Track fill */}
                            <div
                                className="absolute left-0 h-[3px] rounded-full bg-primary transition-[width] duration-150"
                                style={{ width: `${progressPercent}%` }}
                            />
                            {/* Thumb dot */}
                            <div
                                className="absolute h-3 w-3 rounded-full bg-primary shadow-lg shadow-primary/30 -translate-x-1/2 transition-[left] duration-150 group-hover/seek:scale-125"
                                style={{ left: `${progressPercent}%` }}
                            />
                            {/* Invisible range input on top for interaction */}
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                                style={{ margin: 0 }}
                            />
                        </div>

                        <span className="text-[10px] font-bold text-white/50 tabular-nums w-8 text-center">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={(e) => { e.stopPropagation(); togglePlay(); resetHideTimeout(); }}
                            className="h-10 w-10 flex items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-110 active:scale-95"
                        >
                            {isPlaying
                                ? <Pause className="w-5 h-5 fill-current" />
                                : <Play className="w-5 h-5 fill-current ml-0.5" />
                            }
                        </button>
                        <div className="flex items-center gap-5">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleMute(); resetHideTimeout(); }}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                {isMuted
                                    ? <VolumeX className="w-5 h-5" />
                                    : <Volume2 className="w-5 h-5" />
                                }
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleFullscreen(); resetHideTimeout(); }}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <Maximize2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
