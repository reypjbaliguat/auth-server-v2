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

// Ensure a user can only have one credential per type (e.g., one password, one google)
CredentialSchema.index({ userId: 1, type: 1 }, { unique: true });

// For OAuth providers, ensure unique combination of provider + providerUserId
CredentialSchema.index(
  { provider: 1, providerUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: { $ne: "password" } },
  },
);

export default model("Credential", CredentialSchema);
