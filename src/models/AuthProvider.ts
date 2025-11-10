import { model, Schema, Types } from "mongoose";

const AuthProviderSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true },
  provider: { type: String, required: true }, // "google", "microsoft"
  providerUserId: { type: String, required: true },
  email: String,
  metadata: Object,
  createdAt: { type: Date, default: Date.now },
});

AuthProviderSchema.index({ provider: 1, providerUserId: 1 }, { unique: true });

export default model("AuthProvider", AuthProviderSchema);
