import { model, Schema, Types } from "mongoose";

const CredentialSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, unique: true },
  // Type of credential: 'password' | 'google' | 'microsoft' | 'saml' | etc.
  type: {
    type: String,
    enum: ["password", "google", "microsoft", "saml"],
    required: true,
    default: "password",
  },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default model("Credential", CredentialSchema);
