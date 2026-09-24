import { Router } from 'express';
import path from 'path';
import { getDocumentStream } from '../services/documentStorage';
import { compressImageToTargetKB, compressPdfToTargetKB, MAX_TARGET_KB } from '../services/documentCompression';

const router = Router();

export async function serveDocument(req: any, res: any) {
  try {
    const rawFilename = req.params.filename || req.params[0] || (req.path ? path.basename(req.path) : '');
    const filename = rawFilename ? path.basename(rawFilename) : '';
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Filename required' });
    }

    const doc = await getDocumentStream(filename);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const isOriginalOnly = req.query.original === 'true' || req.query.original === '1';
    const dispositionType = isDownload ? 'attachment' : 'inline';

    const isImage = doc.contentType.startsWith('image/') || /\.(jpe?g|png)$/i.test(doc.originalName);
    const isPdf = doc.contentType === 'application/pdf' || /\.pdf$/i.test(doc.originalName);

    // If requested original archive explicitly without compression
    if (isOriginalOnly) {
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(doc.originalName)}"`);
      if (doc.length) res.setHeader('Content-Length', doc.length);
      return doc.stream.pipe(res);
    }

    // Read stream into buffer
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.stream.on('end', () => resolve());
      doc.stream.on('error', reject);
    });
    const rawBuffer = Buffer.concat(chunks);

    // If already strictly under target limit (<= 185 KB), serve untouched for 100% original quality
    if (rawBuffer.length <= MAX_TARGET_KB * 1024) {
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(doc.originalName)}"`);
      res.setHeader('Content-Length', rawBuffer.length);
      res.setHeader('X-Original-Size', rawBuffer.length.toString());
      res.setHeader('X-Final-Size', rawBuffer.length.toString());
      return res.end(rawBuffer);
    }

    // If > 185 KB, compress while preserving maximum text sharpness and readability
    if (isImage) {
      const { buffer: compressedBuffer, contentType: finalContentType } = await compressImageToTargetKB(
        rawBuffer,
        doc.contentType,
        MAX_TARGET_KB
      );

      res.setHeader('Content-Type', finalContentType);
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(doc.originalName)}"`);
      res.setHeader('Content-Length', compressedBuffer.length);
      res.setHeader('X-Original-Size', rawBuffer.length.toString());
      res.setHeader('X-Final-Size', compressedBuffer.length.toString());
      return res.end(compressedBuffer);
    } else if (isPdf) {
      const finalBuffer = await compressPdfToTargetKB(rawBuffer, MAX_TARGET_KB);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(doc.originalName)}"`);
      res.setHeader('Content-Length', finalBuffer.length);
      res.setHeader('X-Original-Size', rawBuffer.length.toString());
      res.setHeader('X-Final-Size', finalBuffer.length.toString());
      return res.end(finalBuffer);
    }

    // Other file types: serve rawBuffer
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader('Content-Length', rawBuffer.length);
    return res.end(rawBuffer);
  } catch (error) {
    console.error('Failed to serve document:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to serve document' });
    }
  }
}

router.get('/:filename', serveDocument);

export default router;
