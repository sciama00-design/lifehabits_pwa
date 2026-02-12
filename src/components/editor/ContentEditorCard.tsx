import { useState } from 'react';
import { RichTextEditor } from './RichTextEditor';
import { MediaPreview } from './MediaPreview';
import { Image as ImageIcon, Link as LinkIcon, Check } from 'lucide-react';
import { uploadFile } from '@/lib/storage';
import { generateThumbnailFromVideo, getVimeoThumbnail, getYoutubeThumbnail, dataUrlToFile, processExternalThumbnail } from '@/lib/videoUtils';

export interface ContentData {
    title: string;
    description: string; // HTML
    type: 'habit' | 'video' | 'pdf' | 'post';
    link?: string;
    thumbnail_url?: string;
    file?: File;
}

interface ContentEditorCardProps {
    initialData?: Partial<ContentData>;
    onSave: (data: ContentData) => void;
    onCancel?: () => void;
    saveLabel?: string;
    showTitle?: boolean;
}

export function ContentEditorCard({
    initialData,
    onSave,
    onCancel,
    saveLabel = "Salva",
    showTitle = true
}: ContentEditorCardProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [link, setLink] = useState(initialData?.link || '');
    const [file, setFile] = useState<File | undefined>(initialData?.file);
    const [isUploading, setIsUploading] = useState(false);

    const isVideoLink = (url: string) => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('youtube.com') ||
            lowerUrl.includes('youtu.be') ||
            lowerUrl.includes('vimeo.com') ||
            lowerUrl.includes('/shorts/') ||
            lowerUrl.includes('/live/') ||
            lowerUrl.match(/\.(mp4|mov|webm|mkv)(\?.*)?$/);
    };

    const handleSave = async () => {
        setIsUploading(true);
        try {
            let finalLink = link;
            let finalType: 'habit' | 'video' | 'pdf' | 'post' = 'habit';
            const linkChanged = link !== (initialData?.link || '');
            let finalThumbnailUrl = linkChanged ? undefined : (initialData?.thumbnail_url || undefined);

            // 1. Handle File Upload
            if (file) {
                const publicUrl = await uploadFile(file);
                if (publicUrl) {
                    finalLink = publicUrl;

                    // Generate thumbnail for video files
                    if (file.type.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|mov|webm)$/)) {
                        const thumbDataUrl = await generateThumbnailFromVideo(file);
                        if (thumbDataUrl) {
                            const thumbFile = await dataUrlToFile(thumbDataUrl, `thumb_${Date.now()}.jpg`);
                            const thumbUrl = await uploadFile(thumbFile);
                            if (thumbUrl) finalThumbnailUrl = thumbUrl;
                        }
                    }
                } else {
                    throw new Error('Impossibile caricare il file. Verifica la connessione o il formato del file.');
                }
            }

            // 2. Determine Type and Fetch Thumbnail for links
            if (isVideoLink(finalLink)) {
                finalType = 'video';

                // Fetch thumbnail if missing (e.g. link just added)
                if (!finalThumbnailUrl) {
                    let externalThumbUrl = null;
                    if (finalLink.includes('vimeo.com')) {
                        externalThumbUrl = await getVimeoThumbnail(finalLink);
                    } else if (finalLink.includes('youtube.com') || finalLink.includes('youtu.be')) {
                        externalThumbUrl = await getYoutubeThumbnail(finalLink);
                    }

                    if (externalThumbUrl) {
                        try {
                            const processedThumbDataUrl = await processExternalThumbnail(externalThumbUrl);
                            if (processedThumbDataUrl) {
                                const thumbFile = await dataUrlToFile(processedThumbDataUrl, `thumb_${Date.now()}.jpg`);
                                const thumbUrl = await uploadFile(thumbFile);
                                if (thumbUrl) finalThumbnailUrl = thumbUrl;
                            } else {
                                finalThumbnailUrl = externalThumbUrl;
                            }
                        } catch (e) {
                            console.error('Failed to process external thumbnail:', e);
                            finalThumbnailUrl = externalThumbUrl;
                        }
                    }
                }
            } else if (file?.type === 'application/pdf' || (typeof finalLink === 'string' && finalLink.toLowerCase().split('?')[0].endsWith('.pdf'))) {
                finalType = 'pdf';
            } else if (initialData?.type === 'post') {
                finalType = 'post';
            }

            await onSave({
                title,
                description,
                type: finalType,
                link: finalLink,
                thumbnail_url: finalThumbnailUrl || undefined,
                file
            });
        } catch (error: any) {
            console.error('Save error:', error);
            alert(error.message || 'Errore durante il salvataggio');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="rounded-2xl bg-card/60 backdrop-blur-xl border border-white/5 p-5 space-y-5 shadow-2xl">

            {/* Top Bar: Title */}
            <div className="space-y-3">
                {showTitle && (
                    <input
                        type="text"
                        placeholder="Titolo contenuto..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-transparent text-lg font-bold text-foreground placeholder-muted-foreground/30 focus:outline-none border-b border-transparent focus:border-primary/50 transition-transform pb-1.5"
                    />
                )}
            </div>

            {/* Rich Editor */}
            <div>
                <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Scrivi qui i dettagli..."
                />
            </div>

            {/* Media Inputs */}
            <div className="space-y-4">
                <MediaPreview url={link} file={file || null} onClear={() => { setLink(''); setFile(undefined); }} />

                {/* Thumbnail Preview & Manual Upload */}
                {(initialData?.thumbnail_url || link) && (
                    <div className="flex items-center gap-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <div className="h-12 w-20 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
                            {initialData?.thumbnail_url ? (
                                <img src={initialData.thumbnail_url} className="w-full h-full object-cover" alt="Anteprima attuale" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                    <ImageIcon className="h-5 w-5 opacity-40" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-1">Copertina Video</p>
                            <label className="cursor-pointer text-[9px] font-black text-primary uppercase tracking-widest hover:underline">
                                Carica Manuale (opzionale)
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const thumbFile = e.target.files?.[0];
                                        if (thumbFile) {
                                            setIsUploading(true);
                                            try {
                                                const publicUrl = await uploadFile(thumbFile);
                                                if (publicUrl) {
                                                    // Salva subito la nuova thumbnail chiamando onSave con i dati attuali
                                                    onSave({
                                                        title,
                                                        description,
                                                        type: initialData?.type || 'video',
                                                        link: link,
                                                        thumbnail_url: publicUrl,
                                                        file: file
                                                    });
                                                }
                                            } catch (err) {
                                                alert("Errore caricamento miniatura");
                                            } finally {
                                                setIsUploading(false);
                                            }
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}

                <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="url"
                            placeholder="Incolla link o immagine..."
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            className="input-minimal pl-9 py-2.5 text-xs"
                        />
                    </div>

                    <label className="cursor-pointer flex items-center justify-center p-2.5 rounded-xl bg-muted/40 border border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors" title="Carica Immagine o PDF">
                        <ImageIcon className="h-4 w-4" />
                        <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setFile(e.target.files[0]);
                                    setLink('');
                                }
                            }}
                        />
                    </label>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Annulla
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={((!title && showTitle) || isUploading)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-tight hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isUploading ? (
                        <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                            Caricamento...
                        </>
                    ) : (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            {saveLabel}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
