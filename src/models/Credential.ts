import { model, Schema, Types } from "mongoose";

const CredentialSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: ["password", "google", "microsoft", "apple"], // Extensible for future providers
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

// Indexes for efficient queries
CredentialSchema.index({ userId: 1, type: 1 });
CredentialSchema.index(
  { provider: 1, providerUserId: 1 },
  {
    unique: true,
    sparse: true, // Only apply uniqueness when fields exist
  }
);

export default model("Credential", CredentialSchema);
