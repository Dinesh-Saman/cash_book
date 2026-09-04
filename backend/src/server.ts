import dns from 'dns';
import dotenv from 'dotenv';
dotenv.config();

// Ensure Node.js resolves MongoDB Atlas SRV records reliably even if local ISP DNS fails
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers', e);
}

import mongoose from 'mongoose';
import app from './app';
import { runSeeder } from './seeder';
import { createUploadsDir } from './utils/uploadsDir';

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cashbook';

createUploadsDir();

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await runSeeder();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
