
import { supabase } from './supabase';

/**
 * Uploads a file to Supabase Storage and returns the public URL.
 * @param file The file object to upload
 * @param bucket The name of the storage bucket
 * @param folder Optional folder path inside the bucket
 */
export async function uploadFile(
    file: File,
    bucket: string = 'media',
    folder: string = 'uploads'
): Promise<string | null> {
    try {
        console.log(`Starting upload to bucket: ${bucket}, folder: ${folder}`);

        // 1. Generate a unique file name
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        // 2. Upload to Supabase Storage
        const { error: uploadError, data } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase Storage upload error details:', {
                message: uploadError.message,
                name: uploadError.name,
                status: (uploadError as any).status,
                bucket,
                filePath
            });
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        console.log('Upload successful, retrieving public URL...', data);

        // 3. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        if (!publicUrl) {
            throw new Error('Failed to generate public URL after upload');
        }

        return publicUrl;
    } catch (error: any) {
        console.error('Error in uploadFile helper:', error.message || error);
        // We re-throw or return null depending on how we want the UI to handle it.
        // Returning null allows the UI to check for success.
        return null;
    }
}

/**
 * Deletes a file from Supabase Storage using its public URL.
 * @param publicUrl The public URL of the file to delete
 * @param bucket The name of the storage bucket
 */
export async function deleteFileFromUrl(
    publicUrl: string,
    bucket: string = 'media'
): Promise<boolean> {
    try {
        if (!publicUrl) return false;

        // Extract the path from the public URL
        // Improved extraction to handle various URL formats (including localhost)
        let filePath = '';
        const searchPattern = `/public/${bucket}/`;
        const index = publicUrl.indexOf(searchPattern);

        if (index !== -1) {
            filePath = publicUrl.substring(index + searchPattern.length);
        } else {
            // Fallback: try splitting
            const urlParts = publicUrl.split(searchPattern);
            if (urlParts.length >= 2) {
                filePath = urlParts[1];
            }
        }

        if (!filePath) {
            console.warn('Could not extract file path from URL:', publicUrl);
            return false;
        }

        console.log(`Deleting file: ${filePath} from bucket: ${bucket}`);

        const { error } = await supabase.storage
            .from(bucket)
            .remove([filePath]);

        if (error) {
            console.error('Storage delete error:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('Error in deleteFileFromUrl:', error);
        return false;
    }
}
