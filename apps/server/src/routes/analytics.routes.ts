import { Router, Response, NextFunction } from 'express';
import { db } from '../db/index.js';
import { transactions, customers, inventory, products, transactionItems, dayRemarks } from '../db/schema.js';
import { sql, gte, lt, and, eq, count, desc, between } from 'drizzle-orm';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Dashboard summary
router.get('/summary', async (_req, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayStats, weekStats, monthStats, newCustomers, lowStock, pendingRepairs] =
      await Promise.all([
        db
          .select({
            revenue: sql<string>`COALESCE(SUM(final_amount),0)`,
            txnCount: count(),
          })
          .from(transactions)
          .where(and(gte(transactions.transactionDate, todayStart), eq(transactions.type, 'sale'))),

        db
          .select({ revenue: sql<string>`COALESCE(SUM(final_amount),0)`, txnCount: count() })
          .from(transactions)
          .where(and(gte(transactions.transactionDate, weekStart), eq(transactions.type, 'sale'))),

        db
          .select({ revenue: sql<string>`COALESCE(SUM(final_amount),0)`, txnCount: count() })
          .from(transactions)
          .where(and(gte(transactions.transactionDate, monthStart), eq(transactions.type, 'sale'))),

        db.select({ cnt: count() }).from(customers).where(gte(customers.createdAt, todayStart)),

        db
          .select({ cnt: count() })
          .from(inventory)
          .where(sql`${inventory.quantity} <= ${inventory.minStockAlert}`),

        db
          .select({ cnt: count() })
          .from(transactions)
          .where(
            and(
              eq(transactions.type, 'repair'),
              sql`${transactions.status} != 'completed'`,
            ),
          ),
      ]);

    res.json({
      success: true,
      data: {
        todayRevenue: todayStats[0]?.revenue ?? '0',
        todayTransactions: Number(todayStats[0]?.txnCount ?? 0),
        todayNewCustomers: Number(newCustomers[0]?.cnt ?? 0),
        weekRevenue: weekStats[0]?.revenue ?? '0',
        weekTransactions: Number(weekStats[0]?.txnCount ?? 0),
        monthRevenue: monthStats[0]?.revenue ?? '0',
        monthTransactions: Number(monthStats[0]?.txnCount ?? 0),
        lowStockCount: Number(lowStock[0]?.cnt ?? 0),
        pendingRepairs: Number(pendingRepairs[0]?.cnt ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Sales chart by period
router.get('/sales', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as string) || 'month';
    let groupExpr: string;
    let fromDate: Date;
    const now = new Date();

    if (period === 'day') {
      groupExpr = `DATE_TRUNC('hour', transaction_date)`;
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      groupExpr = `DATE_TRUNC('day', transaction_date)`;
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
    } else if (period === 'month') {
      groupExpr = `DATE_TRUNC('day', transaction_date)`;
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // year
      groupExpr = `DATE_TRUNC('month', transaction_date)`;
      fromDate = new Date(now.getFullYear(), 0, 1);
    }

    const data = await db.execute(sql`
      SELECT
        ${sql.raw(groupExpr)} AS date,
        COALESCE(SUM(final_amount), 0) AS revenue,
        COUNT(*) AS transactions
      FROM transactions
      WHERE type = 'sale'
        AND transaction_date >= ${fromDate}
      GROUP BY 1
      ORDER BY 1
    `);

    res.json({ success: true, data: data.rows });
  } catch (err) {
    next(err);
  }
});

// Heatmap: transactions per day of year
router.get('/heatmap', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);

    const data = await db.execute(sql`
      SELECT
        DATE(transaction_date) AS date,
        COUNT(*) AS count,
        COALESCE(SUM(final_amount), 0) AS revenue
      FROM transactions
      WHERE transaction_date >= ${from} AND transaction_date < ${to}
      GROUP BY 1
      ORDER BY 1
    `);

    res.json({ success: true, data: data.rows });
  } catch (err) {
    next(err);
  }
});

// Top products
router.get('/top-products', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);

    const data = await db.execute(sql`
      SELECT
        ti.product_id AS "productId",
        ti.product_name AS "productName",
        SUM(ti.quantity) AS "quantitySold",
        COALESCE(SUM(ti.total_price), 0) AS revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE t.type = 'sale'
      GROUP BY ti.product_id, ti.product_name
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);

    res.json({ success: true, data: data.rows });
  } catch (err) {
    next(err);
  }
});

// Transaction type breakdown
router.get('/transaction-types', async (_req, res: Response, next: NextFunction) => {
  try {
    const data = await db.execute(sql`
      SELECT
        type,
        COUNT(*) AS count,
        COALESCE(SUM(final_amount), 0) AS revenue
      FROM transactions
      GROUP BY type
      ORDER BY count DESC
    `);
    res.json({ success: true, data: data.rows });
  } catch (err) {
    next(err);
  }
});

// Customer metrics
router.get('/customer-metrics', async (_req, res: Response, next: NextFunction) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);

    const [total, newThisMonth, topCustomers] = await Promise.all([
      db.select({ cnt: count() }).from(customers),

      db.select({ cnt: count() }).from(customers).where(gte(customers.createdAt, monthStart)),

      db.execute(sql`
        SELECT
          c.id AS "customerId",
          c.name AS "customerName",
          COALESCE(SUM(t.final_amount), 0) AS "totalSpent",
          COUNT(t.id) AS "transactionCount"
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id AND t.type = 'sale'
        GROUP BY c.id, c.name
        ORDER BY "totalSpent" DESC
        LIMIT 10
      `),
    ]);

    res.json({
      success: true,
      data: {
        totalCustomers: Number(total[0]?.cnt ?? 0),
        newThisMonth: Number(newThisMonth[0]?.cnt ?? 0),
        topCustomers: topCustomers.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Day Remarks (heatmap notes / festival) ───────────────────────────────────

// GET /analytics/remarks?year=2025
router.get('/remarks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const data = await db.execute(sql`
      SELECT id, date::text, remark FROM day_remarks
      WHERE date >= ${from} AND date <= ${to}
      ORDER BY date
    `);
    res.json({ success: true, data: data.rows });
  } catch (err) {
    next(err);
  }
});

// POST /analytics/remarks
router.post('/remarks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, remark } = req.body;
    if (!date || !remark) {
      res.status(400).json({ success: false, error: 'date and remark required' });
      return;
    }
    const result = await db.execute(sql`
      INSERT INTO day_remarks (date, remark, updated_at)
      VALUES (${date}::date, ${remark}, NOW())
      ON CONFLICT (date) DO UPDATE SET remark = EXCLUDED.remark, updated_at = NOW()
      RETURNING id, date::text, remark
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /analytics/remarks/:date
router.delete('/remarks/:date', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await db.execute(sql`DELETE FROM day_remarks WHERE date = ${req.params.date}::date`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── Stock Consolidated (for Day Book page) ───────────────────────────────────

router.get('/stock-consolidated', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todaySalesRaw, silverWeightRow, goldPiecesRow, silverSoldTodayRow] = await Promise.all([
      // Sales today: qty and weight sold per product
      db.execute(sql`
        SELECT
          ti.product_id AS "productId",
          SUM(ti.quantity) AS "qtySold",
          COALESCE(SUM(ti.weight_g::numeric), 0) AS "weightSold",
          COALESCE(SUM(ti.total_price::numeric), 0) AS "revenue"
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        WHERE t.type = 'sale'
          AND t.transaction_date >= ${todayStart}
          AND ti.is_exchange_item = false
        GROUP BY ti.product_id
      `),

      // Total silver weight currently in stock (opening weight proxy)
      db.execute(sql`
        SELECT COALESCE(SUM(inv.total_weight_g::numeric), 0) AS weight
        FROM inventory inv
        JOIN products p ON p.id = inv.product_id
        WHERE lower(p.metal_type) = 'silver'
          AND p.is_active = true
      `),

      // Gold pieces sold today (any gold variant)
      db.execute(sql`
        SELECT COUNT(ti.id) AS pieces
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        JOIN products p ON p.id = ti.product_id
        WHERE t.type = 'sale'
          AND t.transaction_date >= ${todayStart}
          AND lower(p.metal_type) IN ('gold', 'rose gold', 'white gold')
          AND ti.is_exchange_item = false
      `),

      // Silver weight sold today
      db.execute(sql`
        SELECT COALESCE(SUM(ti.weight_g::numeric), 0) AS weight
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        JOIN products p ON p.id = ti.product_id
        WHERE t.type = 'sale'
          AND t.transaction_date >= ${todayStart}
          AND lower(p.metal_type) = 'silver'
          AND ti.is_exchange_item = false
      `),
    ]);

    const todaySales: Record<string, { qtySold: number; weightSold: number; revenue: number }> = {};
    for (const row of todaySalesRaw.rows as any[]) {
      if (row.productId) {
        todaySales[row.productId] = {
          qtySold: parseInt(row.qtySold ?? 0),
          weightSold: parseFloat(row.weightSold ?? 0),
          revenue: parseFloat(row.revenue ?? 0),
        };
      }
    }

    res.json({
      success: true,
      data: {
        todaySales,
        silverWeightG: parseFloat((silverWeightRow.rows[0] as any)?.weight ?? '0'),
        silverSoldTodayG: parseFloat((silverSoldTodayRow.rows[0] as any)?.weight ?? '0'),
        silverOpeningG: parseFloat((silverWeightRow.rows[0] as any)?.weight ?? '0') + parseFloat((silverSoldTodayRow.rows[0] as any)?.weight ?? '0'),
        silverClosingG: parseFloat((silverWeightRow.rows[0] as any)?.weight ?? '0'),
        goldPiecesSoldToday: parseInt((goldPiecesRow.rows[0] as any)?.pieces ?? '0'),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
