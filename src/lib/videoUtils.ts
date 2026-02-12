
export async function generateThumbnailFromVideo(file: File): Promise<string | null> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.autoplay = false;
        video.muted = true;
        video.src = URL.createObjectURL(file);

        video.onloadeddata = () => {
            // Seek to 1 second (or 0 if video is shorter)
            video.currentTime = Math.min(video.duration, 1);
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            // Set a low resolution as requested (e.g., max width 480)
            const targetWidth = 480;
            const scaleFactor = targetWidth / video.videoWidth;
            canvas.width = targetWidth;
            canvas.height = video.videoHeight * scaleFactor;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(video.src);
                resolve(null);
                return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality jpeg for low resolution
            URL.revokeObjectURL(video.src);
            resolve(dataUrl);
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            resolve(null);
        };
    });
}

export async function getVimeoThumbnail(link: string): Promise<string | null> {
    try {
        const videoId = link.split('vimeo.com/')[1]?.split('?')[0];
        if (!videoId) return null;

        // Use Vimeo's OEmbed API
        const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link)}&width=480`);
        const data = await response.json();
        return data.thumbnail_url || null;
    } catch (error) {
        console.error('Error fetching Vimeo thumbnail:', error);
        return null;
    }
}

export async function getYoutubeThumbnail(link: string): Promise<string | null> {
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
        if (link.includes('v=')) videoId = link.split('v=')[1]?.split('&')[0];
        else if (link.includes('youtu.be/')) videoId = link.split('youtu.be/')[1]?.split(/[?#]/)[0];
        else if (link.includes('/shorts/')) videoId = link.split('/shorts/')[1]?.split(/[?#]/)[0];
    }

    if (!videoId) return null;
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

export async function processExternalThumbnail(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const targetWidth = 480;
                const scaleFactor = targetWidth / img.width;
                canvas.width = targetWidth;
                canvas.height = img.height * scaleFactor;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(objectUrl);
                    resolve(null);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                URL.revokeObjectURL(objectUrl);
                resolve(dataUrl);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(null);
            };
            img.src = objectUrl;
        });
    } catch (e) {
        console.error('Failed to fetch external thumb via proxy/direct:', e);
        return null; // Fallback to raw URL handling in component
    }
}

export async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
    const res: Response = await fetch(dataUrl);
    const blob: Blob = await res.blob();
    return new File([blob], fileName, { type: 'image/jpeg' });
}
