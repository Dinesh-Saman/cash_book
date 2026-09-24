import mongoose from 'mongoose';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { CashBookEntry } from '../models/CashBookEntry';

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function getGridFSBucket(): mongoose.mongo.GridFSBucket {
  if (!mongoose.connection.db) {
    throw new Error('Database connection not established');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'documents',
  });
}

/**
 * Saves an uploaded file buffer directly to MongoDB GridFS.
 */
export async function saveDocumentToGridFS(
  filename: string,
  buffer: Buffer,
  mimetype: string,
  originalName: string
): Promise<void> {
  const bucket = getGridFSBucket();
  const ext = (originalName || filename).split('.').pop()?.toLowerCase() || '';
  const resolvedMime = mimetype && mimetype !== 'application/octet-stream'
    ? mimetype
    : (['jpg', 'jpeg', 'png'].includes(ext) ? (ext === 'png' ? 'image/png' : 'image/jpeg') : 'application/pdf');

  const uploadStream = bucket.openUploadStream(filename, {
    contentType: resolvedMime,
    metadata: {
      originalName,
      size: buffer.length,
      createdAt: new Date(),
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve());
    uploadStream.end(buffer);
  });
}

export interface RetrievedDocument {
  stream: NodeJS.ReadableStream;
  contentType: string;
  originalName: string;
  length?: number;
}

/**
 * Retrieves a document stream and metadata from GridFS or local filesystem fallback.
 */
export async function getDocumentStream(filename: string): Promise<RetrievedDocument | null> {
  const safeFilename = path.basename(filename);
  const bucket = getGridFSBucket();

  // 1. Try finding in GridFS directly by safeFilename
  let files = await bucket.find({ filename: safeFilename }).toArray();

  // 2. If not found directly, check if a CashBookEntry matches documentPath
  if (files.length === 0) {
    const entry = await CashBookEntry.findOne({
      $or: [{ documentPath: safeFilename }, { documentPath: filename }],
    });
    if (entry && entry.documentPath && entry.documentPath !== safeFilename) {
      files = await bucket.find({ filename: entry.documentPath }).toArray();
    }
  }

  // If found in GridFS, stream it
  if (files.length > 0) {
    const file = files[0];
    const metadata = (file.metadata as any) || {};
    let originalName = metadata.originalName || file.filename || safeFilename;
    let ext = originalName.split('.').pop()?.toLowerCase() || '';

    // If originalName has no known extension, look up CashBookEntry for real filename
    if (!MIME_MAP[ext] || originalName === safeFilename) {
      try {
        const entry = await CashBookEntry.findOne({
          $or: [
            { documentPath: safeFilename },
            { documentPath: file.filename },
            { 'documents.path': safeFilename },
            { 'documents.path': file.filename },
          ]
        }).lean();
        if (entry) {
          if (entry.documentPath === safeFilename && entry.documentOriginalName) {
            originalName = entry.documentOriginalName;
            ext = originalName.split('.').pop()?.toLowerCase() || '';
          } else if (Array.isArray(entry.documents)) {
            const matchedDoc = entry.documents.find((d: any) => d.path === safeFilename || d.path === file.filename);
            if (matchedDoc && matchedDoc.originalName) {
              originalName = matchedDoc.originalName;
              ext = originalName.split('.').pop()?.toLowerCase() || '';
            }
          }
        }
      } catch {}
    }

    // Determine content type: prefer MIME_MAP[ext] over generic application/octet-stream
    let contentType = MIME_MAP[ext];
    if (!contentType) {
      contentType = (file.contentType && file.contentType !== 'application/octet-stream')
        ? file.contentType
        : 'application/octet-stream';
    }

    // If still octet-stream, check file.filename extension
    if (contentType === 'application/octet-stream') {
      const fnExt = (file.filename || '').split('.').pop()?.toLowerCase() || '';
      if (MIME_MAP[fnExt]) {
        contentType = MIME_MAP[fnExt];
        ext = fnExt;
      }
    }

    // Default to application/pdf for any non-image document in the cash book
    if (contentType === 'application/octet-stream') {
      const isImg = ['jpg', 'jpeg', 'png'].includes(ext);
      contentType = isImg ? (ext === 'png' ? 'image/png' : 'image/jpeg') : 'application/pdf';
    }

    // Ensure extension exists on originalName if contentType is known
    if (contentType === 'application/pdf' && !originalName.toLowerCase().endsWith('.pdf')) {
      originalName += '.pdf';
    } else if (contentType === 'image/jpeg' && !/\.(jpe?g)$/i.test(originalName)) {
      originalName += '.jpg';
    } else if (contentType === 'image/png' && !/\.png$/i.test(originalName)) {
      originalName += '.png';
    }

    const downloadStream = bucket.openDownloadStreamByName(file.filename);
    return {
      stream: downloadStream,
      contentType,
      originalName,
      length: file.length,
    };
  }

  // 3. Fallback: check local filesystem paths (for legacy local dev uploads)
  const candidatePaths = [
    path.join(process.cwd(), 'uploads', safeFilename),
    path.join(process.cwd(), 'backend', 'uploads', safeFilename),
    path.join(require('os').tmpdir(), 'uploads', safeFilename),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const entry = await CashBookEntry.findOne({ documentPath: safeFilename });
      const originalName = entry?.documentOriginalName || safeFilename;
      const ext = originalName.split('.').pop()?.toLowerCase() || '';
      const isImg = ['jpg', 'jpeg', 'png'].includes(ext);
      const contentType = MIME_MAP[ext] || (isImg ? (ext === 'png' ? 'image/png' : 'image/jpeg') : 'application/pdf');
      const stats = fs.statSync(candidate);

      return {
        stream: fs.createReadStream(candidate),
        contentType,
        originalName,
        length: stats.size,
      };
    }
  }

  return null;
}
