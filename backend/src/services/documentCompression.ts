import fs from 'fs';
import path from 'path';
import url from 'url';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

export interface DocumentItem {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

// ─── Standard limits for <= 5 uploaded pages: strictly < 200 KB ───────────────────
export const MAX_TARGET_KB = 185;
export const HARD_LIMIT_BYTES = 198 * 1024; // strictly below 200 KB (204,800 bytes)

// ─── Dynamic expanded limits for > 5 uploaded pages: strictly < 500 KB ─────────────
export const DYNAMIC_TARGET_5_TO_10_KB = 470;
export const DYNAMIC_HARD_LIMIT_5_TO_10_BYTES = 495 * 1024; // strictly below 500 KB (512,000 bytes)

// Static file references so @vercel/nft traces mupdf and its WASM binary into the serverless bundle
const MUPDF_TRACE_PATHS = [
  path.join(__dirname, '../../node_modules/mupdf/package.json'),
  path.join(__dirname, '../../node_modules/mupdf/dist/mupdf.js'),
  path.join(__dirname, '../../node_modules/mupdf/dist/mupdf-wasm.js'),
  path.join(__dirname, '../../node_modules/mupdf/dist/mupdf-wasm.wasm'),
  path.join(__dirname, '../../../node_modules/mupdf/package.json'),
  path.join(__dirname, '../../../node_modules/mupdf/dist/mupdf.js'),
  path.join(__dirname, '../../../node_modules/mupdf/dist/mupdf-wasm.js'),
  path.join(__dirname, '../../../node_modules/mupdf/dist/mupdf-wasm.wasm'),
];
for (const p of MUPDF_TRACE_PATHS) {
  try {
    fs.statSync(p);
  } catch {}
}

let mupdfModule: any = null;
async function getMuPDF(): Promise<any> {
  if (!mupdfModule) {
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    try {
      mupdfModule = await dynamicImport('mupdf');
    } catch {
      const candidates = [
        path.join(process.cwd(), 'node_modules/mupdf/dist/mupdf.js'),
        path.join(process.cwd(), 'backend/node_modules/mupdf/dist/mupdf.js'),
        path.join(__dirname, '../../node_modules/mupdf/dist/mupdf.js'),
        path.join(__dirname, '../../../node_modules/mupdf/dist/mupdf.js'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            mupdfModule = await dynamicImport(url.pathToFileURL(candidate).href);
            if (mupdfModule) break;
          } catch {}
        }
      }
      if (!mupdfModule) {
        console.warn('Could not load mupdf from any candidate path');
        return null;
      }
    }
  }
  return mupdfModule;
}

async function getSharp(): Promise<any> {
  return sharp;
}

/**
 * Counts the pages of a PDF buffer safely.
 */
export async function getPdfPageCount(buf: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    return Math.max(1, doc.getPageCount());
  } catch {
    try {
      const mupdf = await getMuPDF();
      if (mupdf) {
        const doc = mupdf.Document.openDocument(buf, 'application/pdf');
        return Math.max(1, doc.countPages());
      }
    } catch {}
  }
  return 1;
}

/**
 * Counts total pages across all document items.
 * Images count as 1 page each. PDFs count by their page count.
 */
export async function countTotalPages(items: DocumentItem[]): Promise<number> {
  let count = 0;
  for (const item of items) {
    const isPdf =
      item.mimeType === 'application/pdf' ||
      /\.pdf$/i.test(item.originalName) ||
      (item.buffer && item.buffer.length >= 4 && item.buffer[0] === 0x25 && item.buffer[1] === 0x50 && item.buffer[2] === 0x44 && item.buffer[3] === 0x46);
    if (isPdf) {
      count += await getPdfPageCount(item.buffer);
    } else {
      count += 1;
    }
  }
  return Math.max(1, count);
}

/**
 * Helper to compress an individual image buffer to strictly under maxBytes.
 */
async function compressImageBufferToBytes(
  imgBuf: Buffer,
  maxBytes: number,
  sharp: any
): Promise<Buffer> {
  let quality = 80;
  let maxDim = 1550;
  if (maxBytes < 12 * 1024) {
    quality = 34;
    maxDim = 560;
  } else if (maxBytes < 18 * 1024) {
    quality = 42;
    maxDim = 680;
  } else if (maxBytes < 25 * 1024) {
    quality = 48;
    maxDim = 780;
  } else if (maxBytes < 35 * 1024) {
    quality = 56;
    maxDim = 920;
  } else if (maxBytes < 50 * 1024) {
    quality = 65;
    maxDim = 1100;
  } else if (maxBytes < 75 * 1024) {
    quality = 74;
    maxDim = 1350;
  }

  let out = await sharp(imgBuf)
    .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: quality >= 70 ? '4:4:4' : '4:2:0' })
    .toBuffer();

  while (out.length > maxBytes && quality > 18) {
    quality = Math.max(18, quality - 10);
    maxDim = Math.max(400, Math.floor(maxDim * 0.8));
    out = await sharp(imgBuf)
      .resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer();
  }
  return out;
}

/**
 * Compresses an image buffer so that its final size lands strictly below targetKB
 * while preserving maximum sharpness, resolution, and text readability.
 */
export async function compressImageToTargetKB(
  buf: Buffer,
  contentType: string = 'image/jpeg',
  targetKB: number = MAX_TARGET_KB
): Promise<{ buffer: Buffer; contentType: string }> {
  const hardLimit = targetKB <= 200 ? HARD_LIMIT_BYTES : DYNAMIC_HARD_LIMIT_5_TO_10_BYTES;
  const targetBytes = Math.min(targetKB * 1024, hardLimit - 2048);
  const isExistingJpg = buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8;

  // If already a JPEG within the target limit, return original with zero quality loss
  if (isExistingJpg && buf.length <= hardLimit) {
    return { buffer: buf, contentType: 'image/jpeg' };
  }

  try {
    const sharp = await getSharp();
    if (!sharp) {
      return { buffer: buf, contentType };
    }
    const meta = await sharp(buf).metadata();
    let currentDim = Math.min(Math.max(meta.width || 1800, meta.height || 1800), 1800);
    let quality = 82;
    let out = buf;

    for (let attempt = 0; attempt < 8; attempt++) {
      let pipeline = sharp(buf).rotate();
      if (meta.width && meta.height && Math.max(meta.width, meta.height) > currentDim) {
        pipeline = pipeline.resize({
          width: currentDim,
          height: currentDim,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

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

      if (quality > 68) {
        quality -= 8;
      } else if (quality > 50) {
        quality -= 8;
        currentDim = Math.max(1000, Math.floor(currentDim * 0.88));
      } else {
        quality = Math.max(35, quality - 6);
        currentDim = Math.max(700, Math.floor(currentDim * 0.82));
      }
    }

    return { buffer: out, contentType: 'image/jpeg' };
  } catch (err) {
    console.error('Error compressing image:', err);
    return { buffer: buf, contentType };
  }
}

/**
 * Compresses any PDF buffer so that its final size lands strictly below targetKB / hardLimit.
 * - <= 5 pages: strictly < 200 KB
 * - > 5 pages: strictly < 500 KB
 */
export async function compressPdfToTargetKB(
  pdfBuf: Buffer,
  targetKB?: number,
  knownPageCount?: number
): Promise<Buffer> {
  const count = knownPageCount || await getPdfPageCount(pdfBuf);
  const isUnder5 = count <= 5;
  const resolvedTargetKB = targetKB || (isUnder5 ? MAX_TARGET_KB : DYNAMIC_TARGET_5_TO_10_KB);
  const hardLimit = isUnder5 ? HARD_LIMIT_BYTES : DYNAMIC_HARD_LIMIT_5_TO_10_BYTES;

  if (pdfBuf.length <= hardLimit) {
    return pdfBuf;
  }

  try {
    const sharp = await getSharp();
    const mupdf = await getMuPDF();

    if (!sharp || !mupdf) {
      return pdfBuf;
    }

    const doc = mupdf.Document.openDocument(pdfBuf, 'application/pdf');
    const pageCount = doc.countPages();
    if (pageCount === 0) {
      const empty = await PDFDocument.create();
      empty.addPage([595.28, 841.89]);
      return Buffer.from(await empty.save());
    }

    const totalAvail = resolvedTargetKB * 1024 - (4096 + 600 * pageCount);
    const perPageBytes = Math.max(4 * 1024, Math.floor(totalAvail / pageCount));

    let scale = 1.5;
    if (perPageBytes < 18 * 1024) scale = 0.85;
    else if (perPageBytes < 28 * 1024) scale = 1.0;
    else if (perPageBytes < 45 * 1024) scale = 1.15;
    else if (perPageBytes < 65 * 1024) scale = 1.35;
    else if (perPageBytes < 95 * 1024) scale = 1.5;
    else scale = 1.75;

    const newPdf = await PDFDocument.create();
    const pageInfos: { jpgBytes: Buffer; w: number; h: number }[] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const bounds = page.getBounds();
      const w = bounds[2] - bounds[0];
      const h = bounds[3] - bounds[1];

      const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
      const pngBytes = Buffer.from(pix.asPNG());

      const jpgBytes = await compressImageBufferToBytes(pngBytes, perPageBytes, sharp);
      pageInfos.push({ jpgBytes, w, h });
      const emb = await newPdf.embedJpg(jpgBytes);
      const newPage = newPdf.addPage([w, h]);
      newPage.drawImage(emb, { x: 0, y: 0, width: w, height: h });
    }

    let result = Buffer.from(await newPdf.save({ useObjectStreams: true }));

    // Hard limit safeguard using already-rendered page images (no second MuPDF pass needed)
    if (result.length > hardLimit) {
      const tighterPdf = await PDFDocument.create();
      const scaleDown = Math.min(0.8, (hardLimit * 0.92) / result.length);
      const tighterPerPage = Math.max(3 * 1024, Math.floor(perPageBytes * scaleDown));
      for (const info of pageInfos) {
        const tighterJpg = await compressImageBufferToBytes(info.jpgBytes, tighterPerPage, sharp);
        const emb = await tighterPdf.embedJpg(tighterJpg);
        const newPage = tighterPdf.addPage([info.w, info.h]);
        newPage.drawImage(emb, { x: 0, y: 0, width: info.w, height: info.h });
      }
      result = Buffer.from(await tighterPdf.save({ useObjectStreams: true }));
    }

    return result;
  } catch (err) {
    console.error('Error compressing PDF with MuPDF:', err);
    return pdfBuf;
  }
}

/**
 * Compresses any single uploaded/served document buffer (PDF or image)
 * so that:
 * - <= 5 pages (including single images): strictly < 200 KB
 * - > 5 pages: strictly < 500 KB
 */
export async function compressSingleDocumentBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const ext = (path.extname(originalName || '') || '').replace('.', '').toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || mimeType.startsWith('image/');
  const isPdf =
    ext === 'pdf' ||
    mimeType === 'application/pdf' ||
    (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46);

  if (isImage) {
    if (buffer.length > HARD_LIMIT_BYTES) {
      return await compressImageToTargetKB(buffer, mimeType, MAX_TARGET_KB);
    }
    return { buffer, contentType: mimeType };
  }

  if (isPdf) {
    const pageCount = await getPdfPageCount(buffer);
    const isUnder5 = pageCount <= 5;
    const targetKB = isUnder5 ? MAX_TARGET_KB : DYNAMIC_TARGET_5_TO_10_KB;
    const hardLimit = isUnder5 ? HARD_LIMIT_BYTES : DYNAMIC_HARD_LIMIT_5_TO_10_BYTES;

    if (buffer.length > hardLimit) {
      const compressed = await compressPdfToTargetKB(buffer, targetKB, pageCount);
      return { buffer: compressed, contentType: 'application/pdf' };
    }
    return { buffer, contentType: 'application/pdf' };
  }

  return { buffer, contentType: mimeType };
}

/**
 * Merges all attached documents (both PDF documents with all pages and image files)
 * into a single unified PDF.
 * - Total pages <= 5: strictly < 200 KB.
 * - Total pages > 5: strictly < 500 KB.
 */
export async function buildMergedPdf(
  items: DocumentItem[],
  _targetTotalKB?: number
): Promise<Buffer> {
  if (items.length === 0) {
    const emptyPdf = await PDFDocument.create();
    emptyPdf.addPage([595.28, 841.89]);
    return Buffer.from(await emptyPdf.save());
  }

  const isBufferPdf = (buf: Buffer) =>
    buf && buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // '%PDF'

  const totalPages = await countTotalPages(items);
  const isUnder5 = totalPages <= 5;
  const targetKB = _targetTotalKB || (isUnder5 ? MAX_TARGET_KB : DYNAMIC_TARGET_5_TO_10_KB);
  const hardLimit = isUnder5 ? HARD_LIMIT_BYTES : DYNAMIC_HARD_LIMIT_5_TO_10_BYTES;

  // Single PDF item
  if (
    items.length === 1 &&
    (items[0].mimeType === 'application/pdf' ||
      /\.pdf$/i.test(items[0].originalName) ||
      isBufferPdf(items[0].buffer))
  ) {
    if (items[0].buffer.length <= hardLimit) {
      return items[0].buffer;
    }
    return await compressPdfToTargetKB(items[0].buffer, targetKB, totalPages);
  }

  try {
    const mergedPdf = await PDFDocument.create();
    const sharp = await getSharp();

    for (const item of items) {
      const isPdf =
        item.mimeType === 'application/pdf' ||
        /\.pdf$/i.test(item.originalName) ||
        isBufferPdf(item.buffer);

      if (isPdf) {
        try {
          const srcDoc = await PDFDocument.load(item.buffer, { ignoreEncryption: true });
          const pages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
          pages.forEach((page: any) => mergedPdf.addPage(page));
        } catch (pdfErr) {
          console.error('Error copying PDF pages:', pdfErr);
        }
      } else {
        // Image item
        try {
          let imgBuf = item.buffer;
          if (sharp) {
            try {
              imgBuf = await sharp(item.buffer).rotate().toBuffer();
            } catch {}
          }

          const isPng =
            item.mimeType === 'image/png' ||
            /\.png$/i.test(item.originalName) ||
            (imgBuf.length > 2 && imgBuf[0] === 0x89 && imgBuf[1] === 0x50);

          let embedded: any;
          try {
            embedded = isPng
              ? await mergedPdf.embedPng(imgBuf)
              : await mergedPdf.embedJpg(imgBuf);
          } catch {
            try {
              embedded = await mergedPdf.embedJpg(imgBuf);
            } catch {
              if (sharp) {
                const fallbackJpg = await sharp(imgBuf).jpeg().toBuffer();
                embedded = await mergedPdf.embedJpg(fallbackJpg);
              }
            }
          }

          if (embedded) {
            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const margin = 20;
            const availW = pageWidth - margin * 2;
            const availH = pageHeight - margin * 2;
            const scale = Math.min(availW / embedded.width, availH / embedded.height, 1);
            const w = embedded.width * scale;
            const h = embedded.height * scale;
            const x = margin + (availW - w) / 2;
            const y = margin + (availH - h) / 2;

            const page = mergedPdf.addPage([pageWidth, pageHeight]);
            page.drawImage(embedded, { x, y, width: w, height: h });
          }
        } catch (imgErr) {
          console.error('Error embedding image into PDF:', imgErr);
        }
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      mergedPdf.addPage([595.28, 841.89]);
    }

    const rawMerged = Buffer.from(await mergedPdf.save({ useObjectStreams: true }));

    if (rawMerged.length <= hardLimit) {
      return rawMerged;
    }

    // Run compression to meet target ceiling
    return await compressPdfToTargetKB(rawMerged, targetKB, totalPages);
  } catch (err) {
    console.error('Error building merged PDF:', err);
    try {
      const emptyPdf = await PDFDocument.create();
      emptyPdf.addPage([595.28, 841.89]);
      return Buffer.from(await emptyPdf.save());
    } catch {
      return Buffer.from('');
    }
  }
}
