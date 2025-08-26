import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from "express-session";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import dbPool from "./db.js";

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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


