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

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '127.0.0.1';

createUploadsDir();

// Bind to localhost by default so the port is only reachable through Nginx.
app.listen(PORT, HOST, () => {
  console.log(`Server is running on ${HOST}:${PORT}`);
});

// Initialize MongoDB connection and seeder in the background
connectDB()
  .then(() => {
    console.log('MongoDB initialization & seeding complete.');
  })
  .catch((err) => {
    console.error('Failed to initialize MongoDB on startup', err);
  });

