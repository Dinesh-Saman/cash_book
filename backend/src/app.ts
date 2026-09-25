import express from 'express';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import entriesRoutes from './routes/entries';
import bookingRulesRoutes from './routes/bookingRules';
import settingsRoutes from './routes/settings';
import reportsRoutes from './routes/reports';
import exportsRoutes from './routes/exports';
import usersRoutes from './routes/users';
import auditRoutes from './routes/audit';
import documentsRoutes from './routes/documents';

import { connectDB } from './db';

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin in production or local dev
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health check endpoint (responds immediately)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbState: mongoose.connection.readyState
  });
});

// Ensure MongoDB is connected before handling database API requests (Serverless support)
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/booking-rules', bookingRulesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/uploads', documentsRoutes);

// Serve frontend build in production
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res, next) => {
  // If it's an API route that wasn't matched, proceed to 404/error handler
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.use(errorHandler);

export default app;
