/**
 * YouTube Video Protection Utilities
 * 
 * Provides functions to extract, obfuscate, and deobfuscate YouTube video IDs
 * to prevent clients from easily obtaining video links.
 */

/**
 * Extract YouTube video ID from any YouTube URL format.
 * Supports: watch, shorts, live, embed, youtu.be
 */
export function extractYouTubeId(link: string): string | null {
    try {
        const url = new URL(link);
        if (url.hostname.includes('youtu.be')) {
            return url.pathname.slice(1).split(/[?#]/)[0] || null;
        }
        if (url.hostname.includes('youtube.com')) {
            if (url.pathname.includes('/shorts/')) {
                return url.pathname.split('/shorts/')[1]?.split(/[?#]/)[0] || null;
            }
            if (url.pathname.includes('/live/')) {
                return url.pathname.split('/live/')[1]?.split(/[?#]/)[0] || null;
            }
            if (url.pathname.includes('/embed/')) {
                return url.pathname.split('/embed/')[1]?.split(/[?#]/)[0] || null;
            }
            return url.searchParams.get('v') || null;
        }
    } catch {
        // Fallback for malformed URLs
        if (link.includes('v=')) return link.split('v=')[1]?.split('&')[0] || null;
        if (link.includes('youtu.be/')) return link.split('youtu.be/')[1]?.split(/[?#]/)[0] || null;
        if (link.includes('/shorts/')) return link.split('/shorts/')[1]?.split(/[?#]/)[0] || null;
        if (link.includes('/embed/')) return link.split('/embed/')[1]?.split(/[?#]/)[0] || null;
    }
    return null;
}

/**
 * Obfuscate a video ID so it's not immediately recognizable in the DOM/source.
 * Uses base64 encoding with character reversal.
 */
export function obfuscateVideoId(videoId: string): string {
    const reversed = videoId.split('').reverse().join('');
    return btoa(reversed);
}

/**
 * Deobfuscate a previously obfuscated video ID.
 */
export function deobfuscateVideoId(encoded: string): string {
    const reversed = atob(encoded);
    return reversed.split('').reverse().join('');
}

/**
 * Check if a URL is a YouTube link.
 */
export function isYouTubeUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('youtube.com') || lower.includes('youtu.be');
}

