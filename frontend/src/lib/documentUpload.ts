import { documentsApi } from './api';
import { optimizeDocumentIfNeeded } from './documentCompression';

export interface UploadedDocumentRef {
  path: string;
  originalName: string;
  mimeType: string;
}

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB chunks (safely below Vercel's 4.5 MB ceiling)
const DIRECT_UPLOAD_LIMIT = 3.5 * 1024 * 1024; // 3.5 MB direct upload limit

/**
 * Uploads a document to the server with zero risk of HTTP 413 "Request Entity Too Large".
 *
 * 1. Automatically optimizes images to crisp, lightweight receipt formats.
 * 2. If <= 3.5 MB: uploads directly in a single request.
 * 3. If > 3.5 MB: automatically slices the file into 2 MB chunks and uploads sequentially.
 *    The server reassembles the chunks in GridFS.
 */
export async function uploadDocumentWithProgress(
  rawFile: File,
  onProgress?: (percent: number) => void
): Promise<UploadedDocumentRef> {
  // Pre-optimize image files (phone camera photos, scans)
  const { file } = await optimizeDocumentIfNeeded(rawFile);

  // If file fits within single request ceiling (<= 3.5 MB)
  if (file.size <= DIRECT_UPLOAD_LIMIT) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await documentsApi.upload(fd, onProgress);
    return res.data.data;
  }

  // Chunked upload for large files (> 3.5 MB, e.g. multi-page PDFs or high-res scans)
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  let finalResult: UploadedDocumentRef | null = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);

    const fd = new FormData();
    fd.append('chunk', chunkBlob, file.name);
    fd.append('uploadId', uploadId);
    fd.append('chunkIndex', String(i));
    fd.append('totalChunks', String(totalChunks));
    fd.append('filename', file.name);
    fd.append('mimeType', file.type || 'application/octet-stream');

    const res = await documentsApi.uploadChunk(fd);

    if (onProgress) {
      const pct = Math.round(((i + 1) / totalChunks) * 100);
      onProgress(pct);
    }

    if (res.data?.data) {
      finalResult = res.data.data;
    }
  }

  if (!finalResult) {
    throw new Error(`Failed to complete chunked upload for ${file.name}`);
  }

  return finalResult;
}
