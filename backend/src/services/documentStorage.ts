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
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: mimetype,
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
    const originalName = metadata.originalName || file.filename || safeFilename;
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    const contentType = file.contentType || MIME_MAP[ext] || 'application/octet-stream';

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
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
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
