import { model, Schema, Types } from "mongoose";

const CredentialSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default model("Credential", CredentialSchema);
