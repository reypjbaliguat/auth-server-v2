import dotenv from "dotenv";
import mongoose from "mongoose";
import Credential from "../../models/Credential";
import OTP from "../../models/OTP";
import RefreshSession from "../../models/RefreshSession";
import User from "../../models/User";
dotenv.config();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST!);

  const db = mongoose.connection.db;
  if (!db) {
    return;
  }

  const collection = db.collection("credentials");
  const indexes = await collection.indexes();
  const hasLegacyUserIdIndex = indexes.some(
    (index) => index.name === "userId_1",
  );

  if (hasLegacyUserIdIndex) {
    await collection.dropIndex("userId_1");
  }
});

// clean DB before each individual test run
beforeEach(async () => {
  await User.deleteMany({});
  await Credential.deleteMany({});
  await OTP.deleteMany({});
  await RefreshSession.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});
