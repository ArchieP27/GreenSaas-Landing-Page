require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
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
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Model
const User = require("./models/User");

// Email Transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    // Check for existing user
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

    // Send verification email
    const verificationLink = `${process.env.BASE_URL}/verify?id=${user._id}`;

    await transporter.sendMail({
      from: `GreenSaaS <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4F46E5; text-align: center;">Welcome to GreenSaaS!</h2>
          <p style="margin: 20px 0;">Hi ${name},</p>
          <p>Please verify your email address to complete your registration:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Verify Email
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f8fafc; padding: 10px; border-radius: 4px; font-size: 14px;">
            ${verificationLink}
          </p>
          <p style="margin-top: 30px;">If you didn't create an account with GreenSaaS, you can safely ignore this email.</p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    res
      .status(500)
      .json({ error: "An error occurred during signup. Please try again." });
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
      return res
        .status(404)
        .render("error", { message: "Invalid verification link" });
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
    res
      .status(500)
      .render("error", { message: "An error occurred during verification" });
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
