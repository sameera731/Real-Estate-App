import dbPool from "./db.js";

export default async function authMiddleware(req, res, next) {
  try {
    const userId = req?.session?.userId;

    if (!userId) {
      res.locals.user = null;
      return next();
    }

    const sql = "SELECT id, username, email FROM users WHERE id = ? LIMIT 1";
    const [rows] = await dbPool.execute(sql, [userId]);
    const user = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    res.locals.user = user || null;
    return next();
  } catch (error) {
    console.error("authMiddleware error:", error);
    res.locals.user = null;
    return next();
  }
}


