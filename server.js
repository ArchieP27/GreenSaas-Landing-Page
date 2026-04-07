require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const validator = require("validator");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Model
const User = require("./models/User");

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });
    await user.save();

    // Generate verification link
    const verificationLink = `${process.env.BASE_URL}/verify?id=${user._id}`;

    // **Log the verification link to console instead of sending email**
    console.log(`\n✅ Verification link for ${email}: ${verificationLink}\n`);

    res.json({
      success: true,
      message: "Signup successful. Verification link logged in server console.",
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "An error occurred during signup. Please try again." });
  }
});

app.get("/verify", async (req, res) => {
  try {
    if (!req.query.id) {
      return res.status(400).send("Verification token is missing");
    }

    const user = await User.findByIdAndUpdate(
      req.query.id,
      { verified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).render("error", { message: "Invalid verification link" });
    }

    res.render("dashboard", {
      user: {
        name: user.name,
        email: user.email,
        verified: user.verified,
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).render("error", { message: "An error occurred during verification" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
