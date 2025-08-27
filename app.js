import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from "express-session";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import dbPool from "./db.js";
import multer from "multer";
import fs from "fs";
import authMiddleware from "./authMiddleware.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }
  })
);

// Attach current user (if any) to res.locals for all routes
app.use(authMiddleware);

// File uploads (multer) configuration
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Routes
app.get("/", (req, res) => {
  res.render("index", { title: "Home" });
});

app.get("/signup", (req, res) => {
  res.render("signup", { title: "Sign Up" });
});

app.get("/login", (req, res) => {
  res.render("login", { title: "Log In" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).render("login", {
      title: "Log In",
      error: "Email and password are required."
    });
  }

  try {
    const selectSql = `SELECT id, password FROM users WHERE email = ? LIMIT 1`;
    const [rows] = await dbPool.execute(selectSql, [email]);
    const user = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!user) {
      return res.status(401).render("login", {
        title: "Log In",
        error: "Invalid email or password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).render("login", {
        title: "Log In",
        error: "Invalid email or password."
      });
    }

    req.session.userId = user.id;
    return res.redirect("/");
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).render("login", {
      title: "Log In",
      error: error?.message || "An unexpected error occurred. Please try again."
    });
  }
});
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).render("signup", {
      title: "Sign Up",
      error: "All fields are required."
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const sql = `
      INSERT INTO users (username, email, password)
      VALUES (?, ?, ?)
    `;
    await dbPool.execute(sql, [username, email, passwordHash]);

    return res.status(201).render("signup", {
      title: "Sign Up",
      success: "Account created successfully. You can now log in."
    });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).render("signup", {
        title: "Sign Up",
        error: "Username or email already exists."
      });
    }

    console.error("Signup error:", error);
    return res.status(500).render("signup", {
      title: "Sign Up",
      error: error?.message || "An unexpected error occurred. Please try again."
    });
  }
});

// Add Property routes
app.get("/add-property", (req, res) => {
  if (!req?.session?.userId) {
    return res.redirect("/login");
  }
  return res.render("add-property", { title: "Add Property" });
});

app.post("/add-property", upload.array("photos", 5), async (req, res) => {
  if (!req?.session?.userId) {
    return res.redirect("/login");
  }

  const {
    title,
    description,
    price,
    area_sqm,
    property_type,
    location_city,
    listing_type
  } = req.body || {};

  if (!title || !description || !price || !area_sqm || !property_type || !location_city || !listing_type) {
    return res.status(400).render("add-property", {
      title: "Add Property",
      error: "All fields are required."
    });
  }

  const userId = req.session.userId;
  const files = Array.isArray(req.files) ? req.files : [];

  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const insertPropertySql = `
      INSERT INTO properties (owner_id, title, description, price, area_sqm, property_type, location_city, listing_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [propertyResult] = await connection.execute(insertPropertySql, [
      userId,
      title,
      description,
      Number(price),
      Number(area_sqm),
      property_type,
      location_city,
      listing_type
    ]);

    const propertyId = propertyResult?.insertId;

    if (Array.isArray(req.files) && req.files.length > 0) {
      const insertImageSql = `
        INSERT INTO property_images (property_id, image_url)
        VALUES (?, ?)
      `;
      for (const file of req.files) {
        const relativePath = `/uploads/${file.filename}`;
        await connection.execute(insertImageSql, [propertyId, relativePath]);
      }
    }

    await connection.commit();
    return res.redirect("/");
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    console.error("Add property error:", error);
    return res.status(500).render("add-property", {
      title: "Add Property",
      error: error?.message || "An unexpected error occurred. Please try again."
    });
  } finally {
    if (connection) connection.release();
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


