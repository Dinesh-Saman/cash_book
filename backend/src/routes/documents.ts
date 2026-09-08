import { Router } from 'express';
import path from 'path';
import { getDocumentStream } from '../services/documentStorage';

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
    const dispositionType = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', doc.contentType);
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(doc.originalName)}"`
    );
    if (doc.length) {
      res.setHeader('Content-Length', doc.length);
    }

    doc.stream.on('error', (err: any) => {
      console.error('Error streaming document:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error streaming document' });
      }
    });

    doc.stream.pipe(res);
  } catch (error) {
    console.error('Failed to serve document:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to serve document' });
    }
  }
}

router.get('/:filename', serveDocument);

export default router;
