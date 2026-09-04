import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { CashBookEntry } from '../models/CashBookEntry';

const router = Router();

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export async function serveDocument(req: any, res: any) {
  try {
    const filename = req.params.filename;
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Filename required' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Lookup original filename to determine proper MIME type and download name
    const entry = await CashBookEntry.findOne({ documentPath: safeFilename });
    const originalName = entry?.documentOriginalName || safeFilename;
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const dispositionType = isDownload ? 'attachment' : 'inline';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${encodeURIComponent(originalName)}"`
    );

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to serve document' });
  }
}

router.get('/:filename', serveDocument);

export default router;
