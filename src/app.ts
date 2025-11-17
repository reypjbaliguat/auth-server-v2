import express from "express";
import authRoutes from "./routes/authRoutes";

const app = express();

app.use(express.json());
app.use("/v1/api/auth", authRoutes);

app.get("/v1/api/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

export default app;
