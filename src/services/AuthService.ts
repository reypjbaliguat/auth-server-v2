import Credential from "../models/Credential";
import User from "../models/User";
import { comparePassword, hashPassword } from "../utils/hashPassword";

/**
 * Validates user credentials for email/password login
 */
const validateCredentials = async (email: string, password: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const credential = await Credential.findOne({
    userId: user._id,
    type: "password",
  });

  if (!credential) {
    return { success: false, error: "Invalid credentials" };
  }

  const valid = await comparePassword(password, credential.passwordHash ?? "");
  if (!valid) {
    return { success: false, error: "Invalid credentials" };
  }

  return { success: true, user };
};

/**
 * Registers a new user with email/password
 */
const registerUser = async (email: string, password: string) => {
  const existing = await User.findOne({ email });

  if (existing) {
    // Check if they only have social login (no password set)
    const hasPassword = await Credential.findOne({
      userId: existing._id,
      type: "password",
    });

    if (!hasPassword) {
      // User exists with social login only, allow adding password
      const passwordHash = await hashPassword(password);
      await Credential.create({
        userId: existing._id,
        passwordHash,
        type: "password",
      });
      return {
        success: true,
        user: existing,
        message: "Password added to your existing account successfully.",
      };
    }

    return {
      success: false,
      error: "Email already exists with password login",
    };
  }

  const user = await User.create({ email });
  const passwordHash = await hashPassword(password);

  await Credential.create({
    userId: user._id,
    passwordHash,
    type: "password",
  });

  return { success: true, user };
};

/**
 * Initiates password reset process for a user
 */
const initiatePasswordReset = async (email: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Check if user has a password credential (not just social login)
  const credential = await Credential.findOne({
    userId: user._id,
    type: "password",
  });

  if (!credential) {
    return {
      success: false,
      error:
        "This account uses social login. Please sign in with your social account.",
    };
  }

  if (!user.isActive) {
    return { success: false, error: "Account is deactivated" };
  }

  return { success: true, user };
};

/**
 * Resets user password after OTP verification
 */
const resetPassword = async (email: string, newPassword: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Check if user has a password credential
  const credential = await Credential.findOne({
    userId: user._id,
    type: "password",
  });

  if (!credential) {
    return {
      success: false,
      error: "This account uses social login. Cannot reset password.",
    };
  }

  // Update password
  const passwordHash = await hashPassword(newPassword);
  credential.passwordHash = passwordHash;
  await credential.save();

  return { success: true, user };
};

export const authService = {
  validateCredentials,
  registerUser,
  initiatePasswordReset,
  resetPassword,
};
