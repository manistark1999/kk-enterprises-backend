const pool = require("../db");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");

const registerUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = "INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id";
    const result = await pool.query(insertQuery, [email, hashedPassword, role || "user"]);

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
  const { email, password } = req.body;

  try {
    const userResult = await pool.query(
      `SELECT u.*, r.permissions 
       FROM users u 
       LEFT JOIN roles r ON LOWER(u.role) = LOWER(r.role_name) 
       WHERE LOWER(u.email) = LOWER($1) AND u.is_deleted = false`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login success",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.email.split('@')[0],
        role: user.role,
        must_change_password: user.must_change_password || false,
        permissions: user.permissions || []
      },
    });
  } catch (error) {
    console.error('[AUTH_LOGIN_ERROR]', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, r.permissions 
       FROM users u 
       LEFT JOIN roles r ON LOWER(u.role) = LOWER(r.role_name) 
       WHERE u.id = $1`, 
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const user = result.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "New password is required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      "UPDATE users SET password = $1, must_change_password = false WHERE id = $2",
      [hashedPassword, req.user.id]
    );

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  changePassword
};

