const db = require("../config/db");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    // PostgreSQL query uses $1, $2 syntax
    const checkUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id";
    const result = await db.query(insertQuery, [name, email, hashedPassword, role || "admin"]);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: result.rows[0].id
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`[Auth] Login attempt for email: ${email}`);

    if (!email || !password) {
      console.warn("[Auth] Login failed: Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // This query allows any email from the users table to login
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    console.log(`[Auth] Database query result: ${result.rows.length} users found`);

    if (result.rows.length === 0) {
      console.warn(`[Auth] Login failed: User not found with email: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    // Password comparison (using bcrypt)
    console.log("[Auth] Comparing passwords...");
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`[Auth] Password comparison match: ${isMatch}`);

    if (!isMatch) {
      console.warn(`[Auth] Login failed: Invalid password for email: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const token = generateToken(user);

    console.log(`[Auth] Login successful for user: ${user.name || user.username} (ID: ${user.id})`);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username || user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("[Auth] Login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await db.query("SELECT id, name, username, email, role FROM users WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id || user._id,
        username: user.username || user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe
};
