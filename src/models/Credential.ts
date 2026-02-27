import { model, Schema, Types } from "mongoose";

const CredentialSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["password", "google"], // Extensible for future providers
    required: true,
  },
  // For password auth
  passwordHash: {
    type: String,
    required: function (this: any) {
      return this.type === "password";
    },
  },
  // For OAuth providers
  provider: {
    type: String,
    required: function (this: any) {
      return this.type !== "password";
    },
  },
  providerUserId: {
    type: String,
    required: function (this: any) {
      return this.type !== "password";
    },
  },
  providerEmail: String, // Email from OAuth provider
  metadata: Object, // For storing additional provider-specific data
  createdAt: { type: Date, default: Date.now },
});

export default model("Credential", CredentialSchema);
