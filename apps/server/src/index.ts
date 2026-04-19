import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/products.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import customerRoutes from './routes/customers.routes.js';
import transactionRoutes from './routes/transactions.routes.js';
import invoiceRoutes from './routes/invoices.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import ratesRoutes from './routes/rates.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import piecesRoutes from './routes/pieces.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploads
  }),
);
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many login attempts. Try again later.' },
});

// ─── Static Uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(env.UPLOADS_DIR)));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/rates', ratesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/pieces', piecesRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🪙 Jever Jwellers API running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});

export default app;
