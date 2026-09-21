import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

export type LearningMediaUploadResult = {
  url: string;
  storagePath?: string;
  mimetype?: string;
};

/**
 * Upload Learning VIDEO/DOCUMENT media via POST /lms/upload.
 */
export async function uploadLearningMedia(file: File): Promise<LearningMediaUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const authStore = useAuthStore();
  const token = authStore.user?.token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(getApiUrlForFetch('/lms/upload'), {
    method: 'POST',
    headers,
    body: formData,
  });

  const result = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok || !(result as { success?: boolean }).success) {
    const err = result as { message?: string; error?: string };
    throw new Error(err.message || err.error || 'Upload failed');
  }
  const data = ((result as { data?: Record<string, unknown> }).data || result) as Record<
    string,
    unknown
  >;
  const url = data.url || (result as { url?: unknown }).url;
  if (!url) throw new Error('Upload succeeded but no URL returned');
  return {
    url: String(url),
    storagePath: data.storagePath ? String(data.storagePath) : undefined,
    mimetype: data.mimetype ? String(data.mimetype) : undefined,
  };
}
