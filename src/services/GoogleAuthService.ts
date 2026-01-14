import axios from "axios";
import Credential from "../models/Credential";
import User from "../models/User";

interface GoogleTokenInfo {
  email: string;
  sub: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
}

/**
 * Verifies Google credential token
 */
const verifyGoogleToken = async (
  credential: string
): Promise<GoogleTokenInfo> => {
  try {
    const googleRes = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      { timeout: 5000 }
    );

    const { email, sub, name, picture, email_verified } = googleRes.data;

    if (!email || !sub) {
      throw new Error("Invalid Google credential - missing required user data");
    }

    if (!email_verified) {
      throw new Error("Google account email is not verified");
    }

    return { email, sub, name, picture, email_verified };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error("Invalid Google credential");
      }
      throw new Error("Failed to verify Google credential");
    }
    throw error;
  }
};

/**
 * Handles Google login process - finds existing user or creates new one
 */
const processGoogleLogin = async (tokenInfo: GoogleTokenInfo) => {
  const { email, sub, name, picture } = tokenInfo;

  let credential = await Credential.findOne({
    type: "google",
    provider: "google",
    providerUserId: sub,
  });

  let user;
  let isNewUser = false;
  let isLinkedAccount = false;

  if (!credential) {
    // Check if user already exists with this email
    user = await User.findOne({ email });

    if (!user) {
      // Create new user
      isNewUser = true;
      user = await User.create({
        email,
        emailVerified: true,
        profile: {
          firstName: name?.split(" ")[0] || "User",
          lastName: name?.split(" ").slice(1).join(" ") || "",
          avatarUrl: picture,
        },
      });
    } else {
      // User exists but doesn't have Google provider linked
      isLinkedAccount = true;
      // Update email verification status if not already verified
      if (!user.emailVerified) {
        user.emailVerified = true;
        await user.save();
      }
    }

    // Create credential entry
    credential = await Credential.create({
      userId: user._id,
      type: "google",
      provider: "google",
      providerUserId: sub,
      providerEmail: email,
      metadata: { name, picture },
    });
  } else {
    // Existing Google credential, get user
    user = await User.findById(credential.userId);

    if (!user) {
      throw new Error("User account not found");
    }
  }

  const responseMessage = isNewUser
    ? "Account created successfully with Google"
    : isLinkedAccount
    ? "Google account linked to your existing account"
    : "Login successful";

  return { user, message: responseMessage };
};

export const googleAuthService = {
  verifyGoogleToken,
  processGoogleLogin,
};
