import cors from "cors";
import express from "express";
import authRoutes from "./routes/authRoutes";

const app = express();
// Configure CORS for a specific origin and allow credentials
app.use(
  cors({
    origin: "http://localhost:3000", // Explicitly allow your frontend's origin
    credentials: true, // Allow cookies, authorization headers, etc.
    methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
  })
);

app.use(express.json());
app.use("/v1/api/auth", authRoutes);

app.get("/v1/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

export default app;
