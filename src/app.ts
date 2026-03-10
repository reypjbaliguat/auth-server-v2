import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/authRoutes";

const app = express();
// Configure CORS for a specific origin and allow credentials

//add production url to allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://auth-client-v2-4zfv-git-main-reypjbaliguats-projects.vercel.app",
  "https://auth-client-v2-4zfv.vercel.app",
];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
  // store: ... , // Redis, Memcached, etc. See below.
});

app.use(
  cors({
    origin: allowedOrigins, // Explicitly allow your frontend's origin
    credentials: true, // Allow cookies, authorization headers, etc.
    methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
  }),
);

app.use(limiter);
app.use(express.json());
app.use("/v1/api/auth", authRoutes);

app.get("/v1/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

export default app;
