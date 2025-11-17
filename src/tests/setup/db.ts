import mongoose from "mongoose";

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST!);
});

afterAll(async () => {
  await mongoose.connection.close();
});
