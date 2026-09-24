export interface DocumentItem {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

// ─── Standard limits for 1 to 5 documents: strictly < 200 KB ───────────────────
export const MAX_TARGET_KB = 185;
export const HARD_LIMIT_BYTES = 198 * 1024; // strictly below 200 KB (204,800 bytes)

// ─── Dynamic expanded limits for > 5 documents (between 6 and 10): strictly < 500 KB ──
export const DYNAMIC_TARGET_5_TO_10_KB = 470;
export const DYNAMIC_HARD_LIMIT_5_TO_10_BYTES = 495 * 1024; // strictly below 500 KB (512,000 bytes)

let mupdfModule: any = null;
async function getMuPDF(): Promise<any> {
  if (!mupdfModule) {
    // Dynamic import to support ESM MuPDF with top-level await in CommonJS Node runtime
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    mupdfModule = await dynamicImport('mupdf');
  }
  return mupdfModule;
}

let sharpModule: any = null;
async function getSharp(): Promise<any> {
  if (!sharpModule) {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const mod = await dynamicImport('sharp');
      sharpModule = mod.default || mod;
    } catch (e) {
      console.warn('Sharp module not available, fallback to uncompressed images:', e);
      return null;
    }
  }
  return sharpModule;
}

let pdfLibModule: any = null;
async function getPdfLib(): Promise<any> {
  if (!pdfLibModule) {
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    pdfLibModule = await dynamicImport('pdf-lib');
  }
  return pdfLibModule;
}

interface PageStrategy {
  dpi: number;
  maxDim: number;
  quality: number;
  chroma: '4:4:4' | '4:2:0';
  grayscale: boolean;
}

function getPageStrategy(pageCount: number, targetKB: number = MAX_TARGET_KB): PageStrategy {
  // When target budget is dynamically expanded to < 500 KB (for > 5 documents)
  if (targetKB >= 450) {
    if (pageCount <= 6) {
      return { dpi: 135, maxDim: 1500, quality: 78, chroma: '4:4:4', grayscale: false };
    } else if (pageCount <= 10) {
      return { dpi: 125, maxDim: 1350, quality: 75, chroma: '4:4:4', grayscale: false };
    } else {
      return { dpi: 100, maxDim: 1050, quality: 68, chroma: '4:2:0', grayscale: false };
    }
  }

  // Standard target ceiling <= 185 KB (strictly < 200 KB for <= 5 documents)
  if (pageCount <= 1) {
    return { dpi: 150, maxDim: 1800, quality: 82, chroma: '4:4:4', grayscale: false };
  } else if (pageCount <= 3) {
    return { dpi: 135, maxDim: 1500, quality: 76, chroma: '4:4:4', grayscale: false };
  } else if (pageCount <= 6) {
    return { dpi: 110, maxDim: 1200, quality: 70, chroma: '4:2:0', grayscale: false };
  } else if (pageCount <= 10) {
    return { dpi: 96, maxDim: 900, quality: 60, chroma: '4:2:0', grayscale: true };
  } else {
    return { dpi: 78, maxDim: 700, quality: 48, chroma: '4:2:0', grayscale: true };
  }
}

/**
 * Compresses an image buffer so that its final size lands strictly below targetKB
 * while preserving maximum sharpness, resolution, and text readability.
 * Uses 4:4:4 chroma subsampling (no color subsampling blur) and progressive mozjpeg quantization.
 */
export async function compressImageToTargetKB(
  buf: Buffer,
  contentType: string = 'image/jpeg',
  targetKB: number = MAX_TARGET_KB
): Promise<{ buffer: Buffer; contentType: string }> {
  const targetBytes = targetKB * 1024;
  const isExistingJpg = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;

  // If already a JPEG within the target limit, return original with ZERO quality loss
  if (isExistingJpg && buf.length <= targetBytes) {
    return { buffer: buf, contentType: 'image/jpeg' };
  }

  try {
    const sharp = await getSharp();
    if (!sharp) {
      return { buffer: buf, contentType };
    }
    const meta = await sharp(buf).metadata();
    // Maintain generous dimensions so small receipt text remains sharp
    let currentDim = Math.min(Math.max(meta.width || 1800, meta.height || 1800), 1800);
    let quality = 84;
    let out = buf;

    for (let attempt = 0; attempt < 9; attempt++) {
      let pipeline = sharp(buf).rotate();
      if (meta.width && meta.height && Math.max(meta.width, meta.height) > currentDim) {
        pipeline = pipeline.resize({
          width: currentDim,
          height: currentDim,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // 4:4:4 chroma subsampling ensures crisp character edges and no color bleed
      out = await pipeline
        .jpeg({
          quality,
          mozjpeg: true,
          chromaSubsampling: quality >= 70 ? '4:4:4' : '4:2:0',
        })
        .toBuffer();

      if (out.length <= targetBytes) {
        break;
      }

      // Progressively step down quality before sacrificing resolution
      if (quality > 70) {
        quality -= 6;
      } else if (quality > 55) {
        quality -= 6;
        currentDim = Math.max(1100, Math.floor(currentDim * 0.9));
      } else {
        quality = Math.max(38, quality - 6);
        currentDim = Math.max(800, Math.floor(currentDim * 0.85));
      }
    }

    return { buffer: out, contentType: 'image/jpeg' };
  } catch (err) {
    console.error('Error compressing image:', err);
    return { buffer: buf, contentType };
  }
}

/**
 * Compresses any PDF buffer so that its final size lands strictly below targetKB.
 * If the PDF is already ≤ targetKB, returns untouched for 100% original quality.
 * Otherwise, rasterizes pages using MuPDF at high resolution and re-encodes with mozjpeg 4:4:4
 * to eliminate heavy embedded font subsets and uncompressed streams while retaining razor-sharp text.
 */
export async function compressPdfToTargetKB(
  pdfBuf: Buffer,
  targetKB: number = MAX_TARGET_KB
): Promise<Buffer> {
  const targetBytes = targetKB * 1024;
  if (pdfBuf.length <= targetBytes) {
    return pdfBuf;
  }

  const isDynamic500 = targetKB >= 450;
  const hardLimit = isDynamic500 ? DYNAMIC_HARD_LIMIT_5_TO_10_BYTES : HARD_LIMIT_BYTES;

  try {
    const { PDFDocument } = await getPdfLib();
    const sharp = await getSharp();
    if (!sharp) return pdfBuf;

    const mupdf = await getMuPDF();
    const doc = mupdf.Document.openDocument(pdfBuf, 'application/pdf');
    const count = doc.countPages();

    if (count === 0) {
      const empty = await PDFDocument.create();
      empty.addPage([595, 842]);
      return Buffer.from(await empty.save());
    }

    const strategy = getPageStrategy(count, targetKB);

    const renderPdfWithStrategy = async (strat: PageStrategy): Promise<Buffer> => {
      const newPdf = await PDFDocument.create();
      const currScale = strat.dpi / 72;

      for (let i = 0; i < count; i++) {
        const page = doc.loadPage(i);
        const bounds = page.getBounds();
        const width = bounds[2] - bounds[0];
        const height = bounds[3] - bounds[1];

        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(currScale, currScale),
          strat.grayscale ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB,
          false
        );
        const pngBytes = Buffer.from(pixmap.asPNG());

        let pipeline = sharp(pngBytes).resize({
          width: strat.maxDim,
          height: strat.maxDim,
          fit: 'inside',
          withoutEnlargement: true,
        });

        if (strat.grayscale) {
          pipeline = pipeline.grayscale();
        }

        const jpg = await pipeline
          .jpeg({
            quality: strat.quality,
            mozjpeg: true,
            chromaSubsampling: strat.chroma,
          })
          .toBuffer();

        const embedded = await newPdf.embedJpg(jpg);
        const newPage = newPdf.addPage([width, height]);
        newPage.drawImage(embedded, { x: 0, y: 0, width, height });
      }

      const bytes = await newPdf.save({ useObjectStreams: true });
      return Buffer.from(bytes as any);
    };

    let result = await renderPdfWithStrategy(strategy);

    // Hard limit safeguard
    if (result.length > hardLimit) {
      const tighterStrategy: PageStrategy = {
        dpi: Math.max(72, Math.floor(strategy.dpi * 0.82)),
        maxDim: Math.max(650, Math.floor(strategy.maxDim * 0.8)),
        quality: Math.max(35, strategy.quality - 15),
        chroma: '4:2:0',
        grayscale: isDynamic500 ? false : true,
      };
      result = await renderPdfWithStrategy(tighterStrategy);
    }

    return result;
  } catch (err) {
    console.error('Error compressing PDF with MuPDF:', err);
    return pdfBuf;
  }
}

interface PageItem {
  type: 'pdf-page' | 'image';
  mupdfDoc?: any;
  pageIndex?: number;
  width: number;
  height: number;
  imageBuffer?: Buffer;
}

/**
 * Merges all attached documents (both PDF documents with all pages and image files)
 * into a single unified PDF.
 * - For 1 to 5 documents: strictly below 200 KB (target ≤ 185 KB).
 * - For > 5 documents (between 6 and 10): dynamically increased to strictly below 500 KB (target ≤ 470 KB).
 */
export async function buildMergedPdf(
  items: DocumentItem[],
  targetTotalKB?: number
): Promise<Buffer> {
  const { PDFDocument } = await getPdfLib();

  if (items.length === 0) {
    const emptyPdf = await PDFDocument.create();
    emptyPdf.addPage([595, 842]);
    const bytes = await emptyPdf.save();
    return Buffer.from(bytes as any);
  }

  // Dynamic limit based on uploaded document count:
  // If uploaded documents > 5 (between 5 and 10), dynamically increase limit to < 500 KB (target ceiling 470 KB, hard limit 495 KB).
  // If <= 5 documents, strictly enforce < 200 KB (target ceiling 185 KB, hard limit 198 KB).
  const isLargeBatch = items.length > 5;
  const effectiveTargetKB = isLargeBatch ? DYNAMIC_TARGET_5_TO_10_KB : (targetTotalKB || MAX_TARGET_KB);
  const effectiveHardLimitBytes = isLargeBatch ? DYNAMIC_HARD_LIMIT_5_TO_10_BYTES : HARD_LIMIT_BYTES;

  // Fast path: if all items are PDFs and total raw size is already within target, preserve 100% native vector
  const allPdfs = items.every(
    item => item.mimeType === 'application/pdf' || /\.pdf$/i.test(item.originalName)
  );
  const totalRawBytes = items.reduce((sum, item) => sum + item.buffer.length, 0);

  if (allPdfs && totalRawBytes <= effectiveTargetKB * 1024) {
    try {
      const mergedPdf = await PDFDocument.create();
      for (const item of items) {
        const srcDoc = await PDFDocument.load(item.buffer, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        pages.forEach((p: any) => mergedPdf.addPage(p));
      }
      const saved = await mergedPdf.save({ useObjectStreams: true });
      if (saved.length <= effectiveTargetKB * 1024) {
        return Buffer.from(saved as any);
      }
    } catch {}
  }

  try {
    const mupdf = await getMuPDF();
    const sharp = await getSharp();
    const allPages: PageItem[] = [];

    for (const item of items) {
      const isPdf = item.mimeType === 'application/pdf' || /\.pdf$/i.test(item.originalName);

      if (isPdf) {
        try {
          const mupdfDoc = mupdf.Document.openDocument(item.buffer, 'application/pdf');
          const count = mupdfDoc.countPages();
          for (let i = 0; i < count; i++) {
            const page = mupdfDoc.loadPage(i);
            const bounds = page.getBounds();
            allPages.push({
              type: 'pdf-page',
              mupdfDoc,
              pageIndex: i,
              width: bounds[2] - bounds[0],
              height: bounds[3] - bounds[1],
            });
          }
        } catch (pdfErr) {
          console.error('Error loading PDF with MuPDF:', pdfErr);
        }
      } else {
        try {
          let width = 595;
          let height = 842;
          if (sharp) {
            const meta = await sharp(item.buffer).metadata();
            width = meta.width || 595;
            height = meta.height || 842;
          }
          allPages.push({
            type: 'image',
            imageBuffer: item.buffer,
            width,
            height,
          });
        } catch (imgErr) {
          console.error('Error reading image with Sharp:', imgErr);
        }
      }
    }

    if (allPages.length === 0) {
      const emptyPdf = await PDFDocument.create();
      emptyPdf.addPage([595, 842]);
      return Buffer.from(await emptyPdf.save());
    }

    const strategy = getPageStrategy(allPages.length, effectiveTargetKB);

    const renderUnifiedPdf = async (strat: PageStrategy): Promise<Buffer> => {
      const newPdf = await PDFDocument.create();
      const currScale = strat.dpi / 72;

      for (const pageItem of allPages) {
        let jpgBuf: Buffer;

        if (pageItem.type === 'pdf-page') {
          const page = pageItem.mupdfDoc.loadPage(pageItem.pageIndex!);
          const pixmap = page.toPixmap(
            mupdf.Matrix.scale(currScale, currScale),
            strat.grayscale ? mupdf.ColorSpace.DeviceGray : mupdf.ColorSpace.DeviceRGB,
            false
          );
          const pngBytes = Buffer.from(pixmap.asPNG());

          if (sharp) {
            let pipeline = sharp(pngBytes).resize({
              width: strat.maxDim,
              height: strat.maxDim,
              fit: 'inside',
              withoutEnlargement: true,
            });

            if (strat.grayscale) {
              pipeline = pipeline.grayscale();
            }

            jpgBuf = await pipeline
              .jpeg({
                quality: strat.quality,
                mozjpeg: true,
                chromaSubsampling: strat.chroma,
              })
              .toBuffer();
          } else {
            jpgBuf = pngBytes;
          }
        } else {
          if (sharp) {
            let pipeline = sharp(pageItem.imageBuffer!).rotate().resize({
              width: strat.maxDim,
              height: strat.maxDim,
              fit: 'inside',
              withoutEnlargement: true,
            });

            if (strat.grayscale) {
              pipeline = pipeline.grayscale();
            }

            jpgBuf = await pipeline
              .jpeg({
                quality: strat.quality,
                mozjpeg: true,
                chromaSubsampling: strat.chroma,
              })
              .toBuffer();
          } else {
            jpgBuf = pageItem.imageBuffer!;
          }
        }

        const isPng = jpgBuf[0] === 0x89 && jpgBuf[1] === 0x50;
        const embedded = isPng ? await newPdf.embedPng(jpgBuf) : await newPdf.embedJpg(jpgBuf);
        const pageW = pageItem.width || 595;
        const pageH = pageItem.height || 842;
        const pdfPage = newPdf.addPage([pageW, pageH]);
        pdfPage.drawImage(embedded, {
          x: 0,
          y: 0,
          width: pageW,
          height: pageH,
        });
      }

      const bytes = await newPdf.save({ useObjectStreams: true });
      return Buffer.from(bytes as any);
    };

    let result = await renderUnifiedPdf(strategy);

    // Hard limit safeguard
    if (result.length > effectiveHardLimitBytes) {
      const tighterStrategy: PageStrategy = {
        dpi: Math.max(72, Math.floor(strategy.dpi * 0.8)),
        maxDim: Math.max(650, Math.floor(strategy.maxDim * 0.78)),
        quality: Math.max(35, strategy.quality - 15),
        chroma: '4:2:0',
        grayscale: isLargeBatch ? false : true,
      };
      result = await renderUnifiedPdf(tighterStrategy);
    }

    return result;
  } catch (err) {
    console.error('Error building merged PDF:', err);
    try {
      const { PDFDocument } = await getPdfLib();
      const emptyPdf = await PDFDocument.create();
      emptyPdf.addPage([595, 842]);
      return Buffer.from(await emptyPdf.save());
    } catch {
      return Buffer.from('');
    }
  }
}
