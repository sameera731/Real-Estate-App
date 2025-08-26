import dotenv from "dotenv";
import { createPool } from "mysql2/promise";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;

export async function testConnection() {
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS result");
    const result = rows?.[0]?.result;
    console.log(`Database test query result: ${result}`);
    return true;
  } catch (error) {
    console.error("Database connection test failed:", error);
    return false;
  }
}

// If this file is run directly: `node db.js`, perform the test query
const isDirectRun = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  testConnection().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}


