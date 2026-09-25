import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_MONGODB_URI = 'mongodb+srv://saman2020al_db_user:51LZND7cHAFL58kr@cluster0.q4pwqlo.mongodb.net/cashbook?retryWrites=true&w=majority';
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

let connectionPromise: Promise<void> | null = null;

export async function connectDB() {
  if (mongoose.connection.readyState >= 2) {
    return;
  }

  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not defined');
    return;
  }

  // Reuse a single connection promise to prevent multiple simultaneous connect attempts
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 20000,
        bufferCommands: false,
        maxPoolSize: 5,
        minPoolSize: 0,
      })
      .then(() => {
        console.log('Connected to MongoDB');
        connectionPromise = null;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}
