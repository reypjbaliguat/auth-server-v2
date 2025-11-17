import dotenv from "dotenv";
import mongoose from "mongoose";
import Credential from "../../models/Credential";
import User from "../../models/User";
dotenv.config();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST!);
});

// clean DB before each individual test run
beforeEach(async () => {
  await User.deleteMany({});
  await Credential.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
});
