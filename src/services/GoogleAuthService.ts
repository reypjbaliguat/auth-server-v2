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
  credential: string,
): Promise<GoogleTokenInfo> => {
  try {
    const googleRes = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      { timeout: 5000 },
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
 * Implements secure account linking with profile data merging
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
  let profileUpdated = false;

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
          avatarUrl: picture || "",
        },
      });
    } else {
      // User exists but doesn't have Google provider linked
      isLinkedAccount = true;

      // Check if user account is active
      if (!user.isActive) {
        throw new Error("Account is deactivated. Please contact support.");
      }

      // Update email verification status if not already verified
      if (!user.emailVerified) {
        user.emailVerified = true;
        profileUpdated = true;
      }

      // Ensure profile object exists
      if (!user.profile) {
        user.profile = {
          firstName: "",
          lastName: "",
          avatarUrl: "",
        };
      }

      // Smart profile data merging - only update if current data is empty/default
      const shouldUpdateProfile =
        !user.profile.firstName ||
        user.profile.firstName === "User" ||
        !user.profile.avatarUrl;

      if (shouldUpdateProfile && name) {
        const [firstName, ...lastNameParts] = name.split(" ");

        // Only update if we have better data
        if (!user.profile.firstName || user.profile.firstName === "User") {
          user.profile.firstName = firstName;
          profileUpdated = true;
        }

        if (!user.profile.lastName && lastNameParts.length > 0) {
          user.profile.lastName = lastNameParts.join(" ");
          profileUpdated = true;
        }

        if (!user.profile.avatarUrl && picture) {
          user.profile.avatarUrl = picture;
          profileUpdated = true;
        }
      }

      if (profileUpdated) {
        await user.save();
      }
    }

    // Create credential entry with enhanced metadata
    credential = await Credential.create({
      userId: user._id,
      type: "google",
      provider: "google",
      providerUserId: sub,
      providerEmail: email,
      metadata: {
        name,
        picture,
        linkedAt: new Date(),
        accountLinking: isLinkedAccount,
      },
    });

    // Log account linking for security monitoring
    if (isLinkedAccount) {
      console.log(
        `Account linking: Google account linked to existing user ${user._id} (${email})`,
      );
    }
  } else {
    // Existing Google credential, get user
    user = await User.findById(credential.userId);

    if (!user) {
      throw new Error("User account not found");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated. Please contact support.");
    }

    // Update Google profile data if it has changed
    const currentMetadata = credential.metadata as any;
    if (currentMetadata?.picture !== picture && picture) {
      credential.metadata = {
        ...currentMetadata,
        picture,
        name,
        lastUpdated: new Date(),
      };
      await credential.save();

      // Ensure profile object exists
      if (!user.profile) {
        user.profile = {
          firstName: "",
          lastName: "",
          avatarUrl: "",
        };
      }

      // Update user avatar if they don't have one or it's the old Google avatar
      if (
        !user.profile.avatarUrl ||
        user.profile.avatarUrl === currentMetadata?.picture
      ) {
        user.profile.avatarUrl = picture;
        await user.save();
        profileUpdated = true;
      }
    }
  }

  // Generate appropriate response message
  let responseMessage = "Login successful";

  if (isNewUser) {
    responseMessage = "Account created successfully with Google";
  } else if (isLinkedAccount) {
    responseMessage = profileUpdated
      ? "Google account linked and profile updated"
      : "Google account linked to your existing account";
  } else if (profileUpdated) {
    responseMessage = "Login successful - profile updated";
  }

  return {
    user,
    message: responseMessage,
    metadata: {
      isNewUser,
      isLinkedAccount,
      profileUpdated,
    },
  };
};

export const googleAuthService = {
  verifyGoogleToken,
  processGoogleLogin,
};
