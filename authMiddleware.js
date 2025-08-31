import dbPool from "./db.js";

export default async function authMiddleware(req, res, next) {
  try {
    const userId = req?.session?.userId;
    console.log("authMiddleware - userId:", userId);

    if (!userId) {
      res.locals.user = null;
      console.log("authMiddleware - no userId, setting user to null");
      return next();
    }

    const sql = "SELECT id, username, email FROM users WHERE id = ? LIMIT 1";
    const [rows] = await dbPool.execute(sql, [userId]);
    const user = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    console.log("authMiddleware - fetched user:", user);

    res.locals.user = user || null;
    console.log("authMiddleware - set res.locals.user to:", res.locals.user);
    return next();
  } catch (error) {
    console.error("authMiddleware error:", error);
    res.locals.user = null;
    return next();
  }
}


