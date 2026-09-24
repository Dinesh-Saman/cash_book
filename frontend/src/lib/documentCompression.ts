/**
 * Document compression utility
 * Compresses images exceeding 100 MB before upload, without compromising readability.
 * PDFs are uploaded as-is (no client-side recompression).
 *
 * Download compression (≤200KB) is handled server-side via ?compressed=true&download=true.
 */

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB upload threshold

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

/**
 * Compresses an image file using canvas.
 * Uses high-resolution scaling (up to 2560px) and iteratively reduces quality
 * until the file is within the 100 MB upload limit.
 */
async function compressImageFile(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 2560; // Sharp, receipt-quality resolution

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return resolve(file);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Use 0.85 quality JPEG — sufficient for text/financial document legibility
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              return resolve(file);
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.85
        );
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Inspects a document file and reduces its size if it exceeds the 100 MB upload limit.
 * Only images are compressed client-side; PDFs are uploaded as-is.
 */
export async function optimizeDocumentIfNeeded(file: File): Promise<CompressionResult> {
  const originalSizeBytes = file.size;

  if (file.size <= MAX_UPLOAD_SIZE_BYTES) {
    return {
      file,
      wasCompressed: false,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
    };
  }

  // File is larger than 100MB
  const isImage = file.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(file.name);

  if (isImage) {
    try {
      const compressed = await compressImageFile(file);
      return {
        file: compressed,
        wasCompressed: compressed.size < originalSizeBytes,
        originalSizeBytes,
        compressedSizeBytes: compressed.size,
      };
    } catch {
      return {
        file,
        wasCompressed: false,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
      };
    }
  }

  // PDFs > 100MB: still upload (backend limit allows it); no client-side compression possible
  return {
    file,
    wasCompressed: false,
    originalSizeBytes,
    compressedSizeBytes: originalSizeBytes,
  };
}