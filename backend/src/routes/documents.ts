import { Router } from 'express';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { getDocumentStream, saveDocumentToGridFS } from '../services/documentStorage';
import { UploadChunk } from '../models/UploadChunk';
import { authenticate } from '../middleware/auth';
import {
  compressImageToTargetKB,
  compressPdfToTargetKB,
  getPdfPageCount,
  MAX_TARGET_KB,
  HARD_LIMIT_BYTES,
  DYNAMIC_TARGET_5_TO_10_KB,
  DYNAMIC_HARD_LIMIT_5_TO_10_BYTES,
} from '../services/documentCompression';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per chunk or single file
});

const router = Router();

// Fast in-memory cache for compressed download buffers
const compressedDownloadCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function serveDocument(req: any, res: any) {
  try {
    const rawFilename = req.params.filename || req.params[0] || (req.path ? path.basename(req.path) : '');
    const filename = rawFilename ? path.basename(rawFilename) : '';
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Filename required' });
    }

    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const isCompressedReq = req.query.compressed === 'true' || req.query.compressed === '1';
    const cacheKey = `${filename}_dl_${isDownload ? '1' : '0'}`;

    // Check fast cache
    if (compressedDownloadCache.has(cacheKey)) {
      const cached = compressedDownloadCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        const dispositionType = isDownload ? 'attachment' : 'inline';
        const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader('Content-Length', cached.buffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.end(cached.buffer);
      } else {
        compressedDownloadCache.delete(cacheKey);
      }
    }

    const doc = await getDocumentStream(filename);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const dispositionType = isDownload ? 'attachment' : 'inline';
    const safeAscii = doc.originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
    let contentType = doc.contentType;

    // If inline preview without download request and document is reasonably sized, pipe directly
    if (!isDownload && !isCompressedReq && doc.length && doc.length < 2 * 1024 * 1024) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', doc.length);
      return doc.stream.pipe(res);
    }

    // Read full buffer to apply compression rules on downloaded/large files
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.stream.on('data', (c: Buffer) => chunks.push(c));
      doc.stream.on('end', resolve);
      doc.stream.on('error', reject);
    });
    let buffer: any = Buffer.concat(chunks);

    const ext = (path.extname(doc.originalName || filename) || '').replace('.', '').toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || contentType.startsWith('image/');
    const isPdf = ext === 'pdf' || contentType === 'application/pdf' || (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50);

    // Apply strict file download limits:
    // - <= 5 pages: strictly < 200 KB
    // - > 5 pages: strictly < 500 KB
    if (isDownload || isCompressedReq || buffer.length > HARD_LIMIT_BYTES) {
      if (isImage) {
        // Single image = 1 page (<= 5 pages) -> strictly < 200 KB
        if (buffer.length > HARD_LIMIT_BYTES) {
          const comp = await compressImageToTargetKB(buffer, contentType, MAX_TARGET_KB);
          buffer = comp.buffer;
          contentType = comp.contentType;
        }
      } else if (isPdf) {
        const pageCount = await getPdfPageCount(buffer);
        const isUnder5 = pageCount <= 5;
        const targetKB = isUnder5 ? MAX_TARGET_KB : DYNAMIC_TARGET_5_TO_10_KB;
        const hardLimit = isUnder5 ? HARD_LIMIT_BYTES : DYNAMIC_HARD_LIMIT_5_TO_10_BYTES;

        if (buffer.length > hardLimit) {
          buffer = await compressPdfToTargetKB(buffer, targetKB, pageCount);
          contentType = 'application/pdf';
        }
      }

      // Cache the compressed buffer
      if (compressedDownloadCache.size > 200) {
        const oldestKey = compressedDownloadCache.keys().next().value;
        if (oldestKey) compressedDownloadCache.delete(oldestKey);
      }
      compressedDownloadCache.set(cacheKey, { buffer, contentType, timestamp: Date.now() });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(buffer);
  } catch (error) {
    console.error('Failed to serve document:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to serve document' });
    }
  }
}

// ─── POST /upload ─────────────────────────────────────────────────────────────
// Uploads a single document (<= 3.5 MB, well within 4.5 MB serverless limit)
router.post('/upload', authenticate, upload.single('file'), async (req: any, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const ext = path.extname(file.originalname) || '';
    const generatedFilename = `${crypto.randomBytes(16).toString('hex')}${ext.toLowerCase()}`;
    await saveDocumentToGridFS(generatedFilename, file.buffer, file.mimetype, file.originalname);
    res.json({
      success: true,
      data: {
        path: generatedFilename,
        originalName: file.originalname,
        mimeType: file.mimetype,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /upload-chunk ───────────────────────────────────────────────────────
// Uploads a chunk of a document (> 3.5 MB, e.g. multi-MB PDFs or high-res scans)
router.post('/upload-chunk', authenticate, upload.single('chunk'), async (req: any, res, next) => {
  try {
    const file = req.file;
    const { uploadId, chunkIndex, totalChunks, filename, mimeType } = req.body;
    if (!file || !uploadId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ success: false, message: 'Missing chunk parameters' });
    }

    const cIdx = Number(chunkIndex);
    const tChunks = Number(totalChunks);

    await UploadChunk.create({
      uploadId,
      chunkIndex: cIdx,
      totalChunks: tChunks,
      data: file.buffer,
      filename: filename || file.originalname,
      mimeType: mimeType || file.mimetype || 'application/octet-stream',
    });

    const savedCount = await UploadChunk.countDocuments({ uploadId });
    if (savedCount === tChunks) {
      // All chunks received: assemble in exact chunkIndex order
      const allChunks = await UploadChunk.find({ uploadId }).sort({ chunkIndex: 1 });
      const fullBuffer = Buffer.concat(allChunks.map((c) => c.data));
      const origName = filename || file.originalname || 'document.pdf';
      const ext = path.extname(origName) || '';
      const generatedFilename = `${crypto.randomBytes(16).toString('hex')}${ext.toLowerCase()}`;
      const resolvedMime = mimeType || file.mimetype || 'application/pdf';

      await saveDocumentToGridFS(generatedFilename, fullBuffer, resolvedMime, origName);
      await UploadChunk.deleteMany({ uploadId });

      return res.json({
        success: true,
        data: {
          path: generatedFilename,
          originalName: origName,
          mimeType: resolvedMime,
        },
      });
    }

    res.json({
      success: true,
      message: `Chunk ${cIdx + 1}/${tChunks} stored`,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:filename', serveDocument);
router.get('/*', serveDocument);

export default router;
