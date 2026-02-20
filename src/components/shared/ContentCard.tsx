import {
    Pencil,
    Trash2,
    Play,
    FileText,
    CheckSquare,
    User,
    Maximize2,
    CheckCircle2,
    Circle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import clsx from 'clsx';
import { MediaViewer } from './MediaViewer';

export interface ContentCardProps {
    item: {
        id: string;
        title: string;
        description: string | null;
        type: 'pdf' | 'video' | 'habit' | 'post';
        link: string | null;
        thumbnail_url?: string | null;
        created_at: string;
    };
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onAssign?: (id: string) => void;
    isCompleted?: boolean;
    onToggleComplete?: (id: string, completed: boolean) => void;
    isCoachView?: boolean;
}

export function ContentCard({
    item,
    onEdit,
    onDelete,
    onAssign,
    isCompleted,
    onToggleComplete,
    isCoachView = true
}: ContentCardProps) {
    const [viewerOpen, setViewerOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [toggling, setToggling] = useState(false);

    const getThumbnailUrl = (link: string | null) => {
        if (!link) return null;
        if (link.includes('youtube.com') || link.includes('youtu.be')) {
            let videoId = '';
            try {
                const url = new URL(link);
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
            } catch (e) {
                if (link.includes('v=')) videoId = link.split('v=')[1].split('&')[0];
                else if (link.includes('youtu.be/')) videoId = link.split('youtu.be/')[1].split(/[?#]/)[0];
                else if (link.includes('/shorts/')) videoId = link.split('/shorts/')[1]?.split(/[?#]/)[0];
            }
            return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
        }
        if (link.includes('vimeo.com')) {
            const videoId = link.split('vimeo.com/')[1]?.split(/[?#]/)[0];
            return videoId ? `https://vumbnail.com/${videoId}.jpg` : null;
        }
        return null;
    };

    const isVideo = item.type === 'video' && item.link;
    const isPDF = item.type === 'pdf' || (item.link && item.link.toLowerCase().split('?')[0].endsWith('.pdf'));

    const isImageUrl = item.link && (
        item.link.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i) ||
        (item.link.includes('/storage/v1/object/public/') &&
            !item.link.toLowerCase().includes('.pdf') &&
            !item.link.toLowerCase().includes('.mp4') &&
            !item.link.toLowerCase().includes('.mov'))
    );

    const renderMedia = () => {
        if (isVideo && item.link) {
            const thumbnail = item.thumbnail_url || getThumbnailUrl(item.link);
            return (
                <div
                    className="relative aspect-video w-full rounded-t-2xl overflow-hidden bg-muted group/media cursor-pointer border-b border-border"
                    onClick={() => setViewerOpen(true)}
                >
                    {thumbnail ? (
                        <img
                            src={thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-primary/5" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-60" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-white/10 backdrop-blur-md p-3 text-white border border-white/10 shadow-xl transition-all group-hover/media:scale-110 group-hover/media:bg-primary group-hover/media:border-primary">
                            <Play className="h-5 w-5 fill-current" />
                        </div>
                    </div>
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                        <span className="rounded-full bg-black/40 px-2 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider backdrop-blur-md border border-white/5">
                            Video
                        </span>
                    </div>
                </div>
            );
        }

        if (isPDF && item.link) {
            return (
                <div
                    className="relative aspect-video w-full rounded-t-2xl overflow-hidden bg-muted/30 group/pdf cursor-pointer border-b border-border flex items-center justify-center"
                    onClick={() => setViewerOpen(true)}
                >
                    <div className="absolute inset-x-0 inset-y-0 opacity-20 pointer-events-none">
                        <iframe
                            src={`${item.link}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                            className="w-full h-full border-none"
                            title={item.title}
                        />
                    </div>
                    <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="p-3 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            <FileText className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest">Documento PDF</span>
                    </div>
                </div>
            );
        }

        if (isImageUrl && !imageError) {
            return (
                <div
                    className="relative aspect-video w-full rounded-t-2xl overflow-hidden bg-muted border-b border-border cursor-pointer group/img"
                    onClick={() => setViewerOpen(true)}
                >
                    <img
                        src={item.link!}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                        onError={() => setImageError(true)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-40" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <div className="rounded-full bg-black/40 p-2.5 text-white backdrop-blur-md border border-white/10">
                            <Maximize2 className="h-4 w-4" />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="relative aspect-[3/1] w-full rounded-t-2xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center border-b border-border">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary/40 border border-primary/10">
                    <CheckSquare className="h-6 w-6" />
                </div>
            </div>
        );
    };

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={clsx(
                    "group relative flex flex-col rounded-2xl bg-card/40 backdrop-blur-xl border transition-all duration-500 overflow-hidden",
                    !isCoachView && isCompleted
                        ? "border-primary/30 shadow-[0_0_15px_-3px] shadow-primary/10"
                        : "border-border",
                    !isCoachView && onAssign && "cursor-pointer active:scale-[0.98]"
                )}
                onClick={() => {
                    if (!isCoachView && onAssign) {
                        onAssign(item.id);
                    }
                }}
            >
                {/* Media Section */}
                {item.type !== 'habit' || item.link ? renderMedia() : null}

                {/* Content Section */}
                <div className="flex flex-col flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight",
                                    item.type === 'video' ? "bg-blue-500/10 text-blue-400/80 border border-blue-500/10" :
                                        item.type === 'pdf' ? "bg-red-500/10 text-red-400/80 border border-red-500/10" :
                                            "bg-primary/10 text-primary/80 border border-primary/10"
                                )}>
                                    {item.type === 'video' ? 'Video' : item.type === 'post' ? 'Post' : 'Abitudine'}
                                </span>
                            </div>
                            <h3
                                className="text-base font-bold text-foreground transition-colors cursor-pointer group-hover:text-primary leading-tight line-clamp-2"
                                onClick={() => setViewerOpen(true)}
                            >
                                {item.title}
                            </h3>
                        </div>

                        {isCoachView && (
                            <div className="flex gap-0.5 ml-3 flex-shrink-0">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit?.(item.id); }}
                                    className="p-2 sm:p-1.5 rounded-xl sm:rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                    title="Modifica"
                                >
                                    <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete?.(item.id); }}
                                    className="p-2 sm:p-1.5 rounded-xl sm:rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Elimina"
                                >
                                    <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {item.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mb-4 prose dark:prose-invert prose-xs prose-p:leading-normal">
                            <div dangerouslySetInnerHTML={{ __html: item.description }} />
                        </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
                        <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">
                            {new Date(item.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                        </div>

                        {onAssign && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAssign(item.id); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-[9px] font-bold uppercase tracking-tight text-primary hover:bg-primary hover:text-primary-foreground transition-all border border-primary/10"
                            >
                                <User className="h-3 w-3" />
                                Assegna
                            </button>
                        )}

                        {/* Daily Check-off Toggle (Client view) */}
                        {!isCoachView && onToggleComplete && (
                            <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    setToggling(true);
                                    await onToggleComplete(item.id, !!isCompleted);
                                    setToggling(false);
                                }}
                                disabled={toggling}
                                className={clsx(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all duration-300 border ml-auto",
                                    isCompleted
                                        ? "bg-primary/15 text-primary border-primary/20 hover:bg-primary/25"
                                        : "bg-muted/30 text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20"
                                )}
                            >
                                {toggling ? (
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                                ) : isCompleted ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                    <Circle className="h-3.5 w-3.5" />
                                )}
                                {isCompleted ? 'Fatto oggi ✓' : 'Segna come fatto'}
                            </motion.button>
                        )}
                    </div>
                </div>
            </motion.div>

            <MediaViewer
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                type={item.type}
                url={item.link}
                title={item.title}
                description={item.description}
                thumbnailUrl={item.thumbnail_url || getThumbnailUrl(item.link)}
            />
        </>
    );
}
