import dns from 'dns';
import dotenv from 'dotenv';
dotenv.config();

// Ensure Node.js resolves MongoDB Atlas SRV records reliably even if local ISP DNS fails
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers', e);
}

import app from './app';
import { connectDB } from './db';
import { createUploadsDir } from './utils/uploadsDir';

const PORT = process.env.PORT || 5000;

createUploadsDir();

// Start HTTP server immediately so port 5000 is open and Vite/clients don't get ECONNREFUSED
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Initialize MongoDB connection and seeder in the background
connectDB()
  .then(() => {
    console.log('MongoDB initialization & seeding complete.');
  })
  .catch((err) => {
    console.error('Failed to initialize MongoDB on startup', err);
  });

