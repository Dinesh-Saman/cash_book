import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runSeeder } from './seeder';

dotenv.config();

// Ensure Node.js resolves MongoDB Atlas SRV records reliably even if local ISP DNS fails
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setting DNS servers is not allowed
}

const DEFAULT_MONGODB_URI = 'mongodb+srv://saman2020al_db_user:51LZND7cHAFL58kr@cluster0.q4pwqlo.mongodb.net/cashbook?retryWrites=true&w=majority';
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

let connectionPromise: Promise<void> | null = null;
let seederRan = false;

export async function connectDB(): Promise<void> {
  // 1 = connected
  if (mongoose.connection.readyState === 1) {
    if (!seederRan) {
      try {
        await runSeeder();
        seederRan = true;
      } catch (err) {
        console.warn('Seeder check error:', err);
      }
    }
    return;
  }

  // If a connection attempt is currently in progress, wait for it
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  // 2 = connecting (initiated elsewhere)
  if (mongoose.connection.readyState === 2) {
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => { cleanup(); resolve(); };
      const onError = (err: any) => { cleanup(); reject(err); };
      const cleanup = () => {
        mongoose.connection.removeListener('open', onOpen);
        mongoose.connection.removeListener('error', onError);
      };
      mongoose.connection.once('open', onOpen);
      mongoose.connection.once('error', onError);
    });
    return;
  }

  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not defined');
    return;
  }

  // Reuse a single connection promise to prevent multiple simultaneous connect attempts
  connectionPromise = (async () => {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 30000,
        bufferCommands: true,
        maxPoolSize: 10,
        minPoolSize: 0,
      });
      console.log('Connected to MongoDB');
      if (!seederRan) {
        try {
          await runSeeder();
          seederRan = true;
        } catch (err) {
          console.warn('Seeder check error:', err);
        }
      }
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  await connectionPromise;
}

