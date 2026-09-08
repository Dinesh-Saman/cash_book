/**
 * Document compression utility
 * Compresses documents exceeding 10 MB without compromising readability or visual quality.
 */

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB threshold

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

/**
 * Compresses an image file if it exceeds the 10 MB threshold.
 * Uses high-resolution canvas scaling (up to 2560px) and 0.85 quality JPEG encoding
 * to preserve crisp text and financial document readability.
 */
async function compressImageFile(file: File): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 2560; // Ultra-sharp document/receipt resolution

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

        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export at 0.85 JPEG quality for optimal text legibility and size reduction
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
 * Inspects a document file and reduces its size if it exceeds 10 MB.
 */
export async function optimizeDocumentIfNeeded(file: File): Promise<CompressionResult> {
  const originalSizeBytes = file.size;

  if (file.size <= MAX_FILE_SIZE_BYTES) {
    return {
      file,
      wasCompressed: false,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
    };
  }

  // File is larger than 10MB
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

  // Non-image files (e.g. PDF) that cannot be re-rasterized without losing selectable text
  return {
    file,
    wasCompressed: false,
    originalSizeBytes,
    compressedSizeBytes: originalSizeBytes,
  };
}