const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    console.error('[JWT] CRITICAL ERROR: JWT_SECRET is not defined in environment variables!');
    throw new Error('JWT_SECRET configuration missing on server');
  }

  return jwt.sign(
    {
      id: user.id || user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

module.exports = generateToken;
