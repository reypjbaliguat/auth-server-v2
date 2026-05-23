import { model, Schema, Types } from "mongoose";

export type RefreshSessionStatus = "active" | "rotated" | "revoked";

interface IRefreshSession {
  userId: Types.ObjectId;
  familyId: string;
  jti: string;
  tokenHash: string;
  status: RefreshSessionStatus;
  replacedByJti?: string;
  revokedReason?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefreshSessionSchema = new Schema<IRefreshSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    familyId: { type: String, required: true, index: true },
    jti: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "rotated", "revoked"],
      default: "active",
      index: true,
    },
    replacedByJti: { type: String },
    revokedReason: { type: String },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

RefreshSessionSchema.index({ familyId: 1, status: 1 });
RefreshSessionSchema.index({ userId: 1, createdAt: -1 });

export default model<IRefreshSession>("RefreshSession", RefreshSessionSchema);
