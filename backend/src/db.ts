import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_MONGODB_URI = 'mongodb+srv://saman2020al_db_user:51LZND7cHAFL58kr@cluster0.q4pwqlo.mongodb.net/cashbook?retryWrites=true&w=majority';
const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

let isConnected = false;

export async function connectDB() {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not defined');
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}
