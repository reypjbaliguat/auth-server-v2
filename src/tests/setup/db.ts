import dotenv from "dotenv";
import mongoose from "mongoose";
import Credential from "../../models/Credential";
import OTP from "../../models/OTP";
import User from "../../models/User";
dotenv.config();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST!);
});

// clean DB before each individual test run
beforeEach(async () => {
  await User.deleteMany({});
  await Credential.deleteMany({});
  await OTP.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});
