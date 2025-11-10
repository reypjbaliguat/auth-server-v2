import { Schema, model } from "mongoose";

const UserSchema = new Schema({
  email: { type: String, required: true, lowercase: true, unique: true },
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default model("User", UserSchema);
