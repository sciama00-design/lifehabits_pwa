
import { useState, useEffect } from 'react';
import { X, FileText, Leaf } from 'lucide-react';

interface MediaPreviewProps {
    url?: string | null; // For external links (Youtube, Vimeo, Image URL)
    file?: File | null; // For uploaded files
    onClear?: () => void;
}

export function MediaPreview({ url, file, onClear }: MediaPreviewProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [type, setType] = useState<'video' | 'image' | 'pdf' | 'unknown'>('unknown');
    const [embedUrl, setEmbedUrl] = useState<string | null>(null);

    // Helper to get embed URL for Youtube/Vimeo
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
                    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
                }
            } else if (url.hostname.includes('vimeo.com')) {
                const match = url.pathname.match(/^\/(\d+)(?:\/([a-z0-9]+))?/);
                if (match) {
                    const videoId = match[1];
                    const hash = match[2] || url.searchParams.get('h');
                    return `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ''}`;
                }
            }
        } catch (e) {
            if (link.includes('youtube.com') || link.includes('youtu.be')) {
                let videoId = '';
                if (link.includes('v=')) videoId = link.split('v=')[1].split('&')[0];
                else if (link.includes('youtu.be/')) videoId = link.split('youtu.be/')[1].split(/[?#]/)[0];
                else if (link.includes('/shorts/')) videoId = link.split('/shorts/')[1]?.split(/[?#]/)[0];
                if (videoId) return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
            } else if (link.includes('vimeo.com')) {
                const parts = link.split('vimeo.com/')[1]?.split(/[/?]/);
                const videoId = parts?.[0];
                const hash = parts?.[1]?.length > 5 ? parts[1] : undefined;
                if (videoId) {
                    return `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ''}`;
                }
            }
        }

        return null;
    };

    useEffect(() => {
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            if (file.type.startsWith('video')) setType('video');
            else if (file.type === 'application/pdf') setType('pdf');
            else setType('image');

            return () => URL.revokeObjectURL(objectUrl);
        } else if (url) {
            const embed = getEmbedUrl(url);
            if (embed) {
                setType('video');
                setEmbedUrl(embed);
            } else if (url.toLowerCase().split('?')[0].endsWith('.pdf')) {
                setType('pdf');
                setPreviewUrl(url);
            } else if (url.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i) || url.includes('/storage/v1/object/public/')) {
                setType('image');
                setPreviewUrl(url);
            } else {
                setType('unknown');
            }
        } else {
            setPreviewUrl(null);
            setEmbedUrl(null);
            setType('unknown');
        }
    }, [url, file]);

    if (!url && !file) return null;

    if (type === 'unknown' && url) {
        return (
            <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-white/10 p-4">
                <p className="text-slate-400 text-sm break-all">Link allegato: <a href={url} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">{url}</a></p>
                {onClear && (
                    <button
                        onClick={onClear}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 group">
            {type === 'video' && embedUrl && (
                <div className="aspect-video w-full">
                    <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                </div>
            )}

            {type === 'image' && previewUrl && (
                <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[400px] object-cover" />
            )}

            {type === 'pdf' && (
                <div className="aspect-video w-full bg-slate-900 flex flex-col items-center justify-center gap-4 p-8 text-slate-400">
                    <div className="relative rounded-2xl bg-red-500/10 p-6 text-red-500 shadow-2xl border border-red-500/20 transform transition-transform group-hover:scale-105">
                        <FileText className="h-12 w-12" />
                        <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white uppercase">
                            PDF
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold text-white tracking-tight flex items-center justify-center gap-2">Abitudini <Leaf className="h-4 w-4 text-green-500" /></p>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-[240px] truncate font-medium uppercase tracking-widest">{file?.name || url?.split('/').pop() || 'file.pdf'}</p>
                    </div>
                </div>
            )}

            {onClear && (
                <button
                    onClick={onClear}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow-lg border border-white/10"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
