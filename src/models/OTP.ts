import { model, Schema, Types } from "mongoose";

const OTPSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// TTL index so expired OTPs auto-delete
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model("OTP", OTPSchema);
