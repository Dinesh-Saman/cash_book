import express from 'express';
import cors from 'cors';
import path from 'path';
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

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use(errorHandler);

export default app;
