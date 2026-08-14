const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const userRoute = require("./routes/user.route");
const courseRoute = require("./routes/course.route");
const enrollmentRoute = require("./routes/enrollment.route");
const quizRoute = require("./routes/quiz.route");
const submissionRoute = require("./routes/submission.route");
const quizAttendanceRoute = require("./routes/quiz_attendance.route");
const prisma = require("./config/prisma");

const app = express();
// Required when the API runs behind a HTTPS reverse proxy (Render, Railway, etc.).
app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:5173,https://light-lms.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Light LMS API!" });
});

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Health check database failure:", error);
    return res.status(503).json({ status: "degraded", database: "unavailable" });
  }
});

app.use("/api/users", userRoute);
app.use("/api/courses", courseRoute);
app.use("/api/enrollments", enrollmentRoute);
app.use("/api/quizzes", quizRoute);
app.use("/api/submissions", submissionRoute);
app.use("/api/quiz_attendances", quizAttendanceRoute);

const db = require("./config/db");

app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");

    res.json(rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Database connection failed",
    });
  }
});
module.exports = app;
