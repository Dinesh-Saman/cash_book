import mongoose, { Schema, Document } from 'mongoose';

export interface IUploadChunk extends Document {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Buffer;
  filename: string;
  mimeType: string;
  createdAt: Date;
}

const uploadChunkSchema = new Schema<IUploadChunk>({
  uploadId: { type: String, required: true, index: true },
  chunkIndex: { type: Number, required: true },
  totalChunks: { type: Number, required: true },
  data: { type: Buffer, required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // Auto-expire after 1 hour (TTL index)
});

uploadChunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });

export const UploadChunk = mongoose.model<IUploadChunk>('UploadChunk', uploadChunkSchema);
