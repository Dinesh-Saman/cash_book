import { Router } from 'express';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { getDocumentStream, saveDocumentToGridFS } from '../services/documentStorage';
import { UploadChunk } from '../models/UploadChunk';
import { authenticate } from '../middleware/auth';
import {
  compressSingleDocumentBuffer,
  HARD_LIMIT_BYTES,
} from '../services/documentCompression';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per chunk or single file
});

const router = Router();

// Fast in-memory cache for compressed document buffers
const compressedDownloadCache = new Map<string, { buffer: Buffer; contentType: string; originalName: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function serveDocument(req: any, res: any) {
  try {
    const rawFilename = req.params.filename || req.params[0] || (req.path ? path.basename(req.path) : '');
    const filename = rawFilename ? path.basename(rawFilename) : '';
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Filename required' });
    }

    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const cacheKey = filename;

    // Check fast cache
    if (compressedDownloadCache.has(cacheKey)) {
      const cached = compressedDownloadCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        const safeAscii = cached.originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(cached.originalName)}`);
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

    const safeAscii = doc.originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
    let contentType = doc.contentType;

    // Only pipe directly if the stored file is already strictly within the 200 KB hard limit
    if (doc.length && doc.length <= HARD_LIMIT_BYTES) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', doc.length);
      return doc.stream.pipe(res);
    }

    // Read full buffer to apply strict compression rules:
    // - <= 5 pages: strictly < 200 KB
    // - > 5 pages: strictly < 500 KB
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.stream.on('data', (c: Buffer) => chunks.push(c));
      doc.stream.on('end', resolve);
      doc.stream.on('error', reject);
    });
    const rawBuffer = Buffer.concat(chunks);

    const compressed = await compressSingleDocumentBuffer(
      rawBuffer,
      doc.originalName || filename,
      contentType
    );
    const buffer = compressed.buffer;
    contentType = compressed.contentType;

    // Cache the compressed buffer
    if (compressedDownloadCache.size > 200) {
      const oldestKey = compressedDownloadCache.keys().next().value;
      if (oldestKey) compressedDownloadCache.delete(oldestKey);
    }
    compressedDownloadCache.set(cacheKey, {
      buffer,
      contentType,
      originalName: doc.originalName || filename,
      timestamp: Date.now(),
    });

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
    const compressed = await compressSingleDocumentBuffer(
      file.buffer,
      file.originalname,
      file.mimetype
    );
    const isJpegOut = compressed.contentType === 'image/jpeg' && file.mimetype !== 'application/pdf';
    const ext = isJpegOut ? '.jpg' : (path.extname(file.originalname) || '');
    const generatedFilename = `${crypto.randomBytes(16).toString('hex')}${ext.toLowerCase()}`;
    await saveDocumentToGridFS(generatedFilename, compressed.buffer, compressed.contentType, file.originalname);
    res.json({
      success: true,
      data: {
        path: generatedFilename,
        originalName: file.originalname,
        mimeType: compressed.contentType,
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
      const resolvedMime = mimeType || file.mimetype || 'application/pdf';

      const compressed = await compressSingleDocumentBuffer(fullBuffer, origName, resolvedMime);
      const isJpegOut = compressed.contentType === 'image/jpeg' && resolvedMime !== 'application/pdf';
      const ext = isJpegOut ? '.jpg' : (path.extname(origName) || '');
      const generatedFilename = `${crypto.randomBytes(16).toString('hex')}${ext.toLowerCase()}`;

      await saveDocumentToGridFS(generatedFilename, compressed.buffer, compressed.contentType, origName);
      await UploadChunk.deleteMany({ uploadId });

      return res.json({
        success: true,
        data: {
          path: generatedFilename,
          originalName: origName,
          mimeType: compressed.contentType,
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
