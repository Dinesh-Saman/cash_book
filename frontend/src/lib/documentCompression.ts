/**
 * Document compression utility
 *
 * Pre-optimizes large client-side images (> 3.5 MB, e.g. phone camera captures)
 * to ensure fast uploads and compatibility with serverless payload limits.
 *
 * Download compression rules:
 * - Total uploaded pages <= 5: strictly < 200 KB
 * - Total uploaded pages > 5: strictly < 500 KB
 * Handled automatically on download via `/api/entries/:id/merged-pdf` and `/uploads/:filename?download=true`.
 */

const PRE_UPLOAD_OPTIMIZE_THRESHOLD_BYTES = 3.5 * 1024 * 1024; // 3.5 MB upload threshold

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

/**
 * Compresses an image file using canvas.
 * Uses high-resolution scaling (up to 2560px) and 0.85 quality JPEG
 * to retain crisp financial text, receipts, and line items.
 */
async function compressImageFile(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 2560; // High-resolution receipt quality

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

        // 0.85 quality JPEG — crisp text and readable numbers
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
 * Inspects a document file and optimizes it if it exceeds the pre-upload threshold.
 */
export async function optimizeDocumentIfNeeded(file: File): Promise<CompressionResult> {
  const originalSizeBytes = file.size;

  if (file.size <= PRE_UPLOAD_OPTIMIZE_THRESHOLD_BYTES) {
    return {
      file,
      wasCompressed: false,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
    };
  }

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

  // PDFs are uploaded as-is; server compresses on download to meet <200KB / <500KB rule
  return {
    file,
    wasCompressed: false,
    originalSizeBytes,
    compressedSizeBytes: originalSizeBytes,
  };
}