import bcrypt from "bcryptjs";

export const createOTP = async () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(otp, 10);
  return { otp, hash };
};

export const verifyOTP = async (input: string, hash: string) => {
  return bcrypt.compare(input, hash);
};
