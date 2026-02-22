import cors from "cors";
import express from "express";
import authRoutes from "./routes/authRoutes";

const app = express();

// Configure CORS for multiple environments
const allowedOrigins = [
  "http://localhost:3000", // Development
  "http://localhost:3001", // Alternative development port
  process.env.FRONTEND_URL, // Production frontend URL
].filter(Boolean); // Remove any undefined values

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests) in development
      if (!origin && process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow cookies, authorization headers, etc.
    methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
  }),
);

app.use(express.json());
app.use("/v1/api/auth", authRoutes);

app.get("/v1/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

export default app;
