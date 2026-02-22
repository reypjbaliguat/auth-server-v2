import cors from "cors";
import express from "express";
import authRoutes from "./routes/authRoutes";

const app = express();
// Configure CORS for a specific origin and allow credentials

//add production url to allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://auth-client-v2-4zfv-git-main-reypjbaliguats-projects.vercel.app",
  "https://auth-client-v2-4zfv.vercel.app",
];
app.use(
  cors({
    origin: allowedOrigins, // Explicitly allow your frontend's origin
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
