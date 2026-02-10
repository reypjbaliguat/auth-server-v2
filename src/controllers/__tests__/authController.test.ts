import { Request, Response } from "express";
import User from "../../models/User";
import { authService } from "../../services/AuthService";
import { googleAuthService } from "../../services/GoogleAuthService";
import { otpService } from "../../services/OTPService";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/generateToken";
import {
  getOTPStatus,
  googleLogin,
  login,
  register,
  resendOTP,
  verifyUserOTP,
} from "../authController";

// Mock all dependencies
jest.mock("../../services/AuthService");
jest.mock("../../services/GoogleAuthService");
jest.mock("../../services/OTPService");
jest.mock("../../models/User");
jest.mock("../../utils/generateToken");

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockGoogleAuthService = googleAuthService as jest.Mocked<
  typeof googleAuthService
>;
const mockOtpService = otpService as jest.Mocked<typeof otpService>;
const mockUser = User as jest.Mocked<typeof User>;
const mockGenerateAccessToken = generateAccessToken as jest.MockedFunction<
  typeof generateAccessToken
>;
const mockGenerateRefreshToken = generateRefreshToken as jest.MockedFunction<
  typeof generateRefreshToken
>;

describe("AuthController", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockStatus: jest.Mock;
  let mockJson: jest.Mock;

  beforeEach(() => {
    mockStatus = jest.fn().mockReturnThis();
    mockJson = jest.fn().mockReturnThis();

    mockRes = {
      status: mockStatus,
      json: mockJson,
    };

    // Clear all mocks
    jest.clearAllMocks();

    // Setup console.error mock to avoid noise in tests
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("register", () => {
    beforeEach(() => {
      mockReq = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };
    });

    it("should register user successfully and send OTP", async () => {
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
      } as any;

      mockAuthService.registerUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });
      mockOtpService.generateAndSendOTP.mockResolvedValue(undefined);

      await register(mockReq as Request, mockRes as Response);

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(
        "test@example.com",
        "password123",
      );
      expect(mockOtpService.generateAndSendOTP).toHaveBeenCalledWith(
        "user123",
        "test@example.com",
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: "OTP sent to your email",
      });
    });

    it("should return success message when password added to social account", async () => {
      mockAuthService.registerUser.mockResolvedValue({
        success: true,
        user: {} as any,
        message: "Password added to your social account",
      });

      await register(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Password added to your social account",
      });
      expect(mockOtpService.generateAndSendOTP).not.toHaveBeenCalled();
    });

    it("should return error when registration fails", async () => {
      mockAuthService.registerUser.mockResolvedValue({
        success: false,
        error: "Email already exists",
      });

      await register(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Email already exists",
      });
    });

    it("should handle server errors", async () => {
      mockAuthService.registerUser.mockRejectedValue(new Error("DB Error"));

      await register(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Server error",
      });
    });
  });

  describe("login", () => {
    beforeEach(() => {
      mockReq = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };
    });

    it("should login successfully and send OTP", async () => {
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
      } as any;

      mockAuthService.validateCredentials.mockResolvedValue({
        success: true,
        user: mockUser,
      });
      mockOtpService.generateAndSendOTP.mockResolvedValue(undefined);

      await login(mockReq as Request, mockRes as Response);

      expect(mockAuthService.validateCredentials).toHaveBeenCalledWith(
        "test@example.com",
        "password123",
      );
      expect(mockOtpService.generateAndSendOTP).toHaveBeenCalledWith(
        "user123",
        "test@example.com",
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: "OTP sent to your email",
      });
    });

    it("should return 404 when user not found", async () => {
      mockAuthService.validateCredentials.mockResolvedValue({
        success: false,
        error: "User not found",
      });

      await login(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should return 401 when invalid password", async () => {
      mockAuthService.validateCredentials.mockResolvedValue({
        success: false,
        error: "Invalid password",
      });

      await login(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Invalid password",
      });
    });

    it("should return 400 for other validation errors", async () => {
      mockAuthService.validateCredentials.mockResolvedValue({
        success: false,
        error: "Account locked",
      });

      await login(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Account locked",
      });
    });
  });

  describe("verifyUserOTP", () => {
    beforeEach(() => {
      mockReq = {
        body: {
          email: "test@example.com",
          otp: "123456",
        },
      };
    });

    it("should verify OTP and return tokens for unverified user", async () => {
      const mockUserDoc = {
        _id: "user123",
        email: "test@example.com",
        emailVerified: false,
        save: jest.fn(),
      };

      mockUser.findOne.mockResolvedValue(mockUserDoc);
      mockOtpService.verifyAndConsumeOTP.mockResolvedValue(true);
      mockGenerateAccessToken.mockReturnValue("access-token");
      mockGenerateRefreshToken.mockReturnValue("refresh-token");

      await verifyUserOTP(mockReq as Request, mockRes as Response);

      expect(mockUser.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(mockOtpService.verifyAndConsumeOTP).toHaveBeenCalledWith(
        "user123",
        "123456",
      );
      expect(mockUserDoc.emailVerified).toBe(true);
      expect(mockUserDoc.save).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: mockUserDoc,
      });
    });

    it("should verify OTP and return tokens for already verified user", async () => {
      const mockUserDoc = {
        _id: "user123",
        email: "test@example.com",
        emailVerified: true,
        save: jest.fn(),
      };

      mockUser.findOne.mockResolvedValue(mockUserDoc);
      mockOtpService.verifyAndConsumeOTP.mockResolvedValue(true);
      mockGenerateAccessToken.mockReturnValue("access-token");
      mockGenerateRefreshToken.mockReturnValue("refresh-token");

      await verifyUserOTP(mockReq as Request, mockRes as Response);

      expect(mockUserDoc.save).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("should return 404 when user not found", async () => {
      mockUser.findOne.mockResolvedValue(null);

      await verifyUserOTP(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    it("should return 400 when OTP is invalid", async () => {
      const mockUserDoc = {
        _id: "user123",
        email: "test@example.com",
      };

      mockUser.findOne.mockResolvedValue(mockUserDoc);
      mockOtpService.verifyAndConsumeOTP.mockResolvedValue(false);

      await verifyUserOTP(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: "OTP expired or invalid",
      });
    });
  });

  describe("googleLogin", () => {
    beforeEach(() => {
      mockReq = {
        body: {
          credential: "google-token",
        },
      };
    });

    it("should login with Google successfully", async () => {
      const mockTokenInfo = {
        email: "test@example.com",
        sub: "google123",
        email_verified: true,
      };
      const mockUser = {
        _id: "user123",
        email: "test@example.com",
        emailVerified: true,
        profile: {},
      } as any;

      mockGoogleAuthService.verifyGoogleToken.mockResolvedValue(mockTokenInfo);
      mockGoogleAuthService.processGoogleLogin.mockResolvedValue({
        user: mockUser,
        message: "Login successful",
      });
      mockGenerateAccessToken.mockReturnValue("access-token");
      mockGenerateRefreshToken.mockReturnValue("refresh-token");

      await googleLogin(mockReq as Request, mockRes as Response);

      expect(mockGoogleAuthService.verifyGoogleToken).toHaveBeenCalledWith(
        "google-token",
      );
      expect(mockGoogleAuthService.processGoogleLogin).toHaveBeenCalledWith(
        mockTokenInfo,
      );
      expect(mockJson).toHaveBeenCalledWith({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        message: "Login successful",
        user: {
          id: "user123",
          email: "test@example.com",
          emailVerified: true,
          profile: {},
        },
      });
    });

    it("should return 400 when credential is missing", async () => {
      mockReq.body = {};

      await googleLogin(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Google credential is required",
      });
    });

    it("should handle Google token verification errors", async () => {
      mockGoogleAuthService.verifyGoogleToken.mockRejectedValue(
        new Error("Invalid token"),
      );

      await googleLogin(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Invalid token",
      });
    });
  });

  describe("getOTPStatus", () => {
    beforeEach(() => {
      mockReq = {
        params: {
          email: "test@example.com",
        },
      };
    });

    it("should return OTP status successfully", async () => {
      const mockUserDoc = {
        _id: "user123",
        email: "test@example.com",
      };
      const mockOTPStatus = {
        canResend: true,
        remainingTime: 0,
      };

      mockUser.findOne.mockResolvedValue(mockUserDoc);
      mockOtpService.getOTPStatus.mockResolvedValue(mockOTPStatus);

      await getOTPStatus(mockReq as Request, mockRes as Response);

      expect(mockUser.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(mockOtpService.getOTPStatus).toHaveBeenCalledWith("user123");
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(mockOTPStatus);
    });

    it("should return 400 when email is missing", async () => {
      mockReq.params = {};

      await getOTPStatus(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Email is required",
      });
    });

    it("should return 404 when user not found", async () => {
      mockUser.findOne.mockResolvedValue(null);

      await getOTPStatus(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        message: "User not found",
      });
    });
  });

  describe("resendOTP", () => {
    beforeEach(() => {
      mockReq = {
        body: {
          email: "test@example.com",
        },
      };
    });

    it("should resend OTP successfully", async () => {
      const mockUserDoc = {
        _id: "user123",
        email: "test@example.com",
      };
      const mockResult = {
        success: true,
        message: "OTP sent successfully",
        canResendAt: Date.now(),
      };

      mockUser.findOne.mockResolvedValue(mockUserDoc);
      mockOtpService.resendOTP.mockResolvedValue(mockResult);

      await resendOTP(mockReq as Request, mockRes as Response);

      expect(mockUser.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
      expect(mockOtpService.resendOTP).toHaveBeenCalledWith(
        "user123",
        "test@example.com",
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        message: "OTP sent successfully",
        canResendAt: mockResult.canResendAt,
      });
    });

    it("should return 429 when resend limit exceeded", async () => {
      const mockUserDoc = {
        _id: "user123",
        email: "test@example.com",
      };
      const mockResult = {
        success: false,
        message: "Please wait before requesting another OTP",
        canResendAt: Date.now(),
      };

      mockUser.findOne.mockResolvedValue(mockUserDoc);
      mockOtpService.resendOTP.mockResolvedValue(mockResult);

      await resendOTP(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Please wait before requesting another OTP",
        canResendAt: mockResult.canResendAt,
      });
    });

    it("should return 400 when email is missing", async () => {
      mockReq.body = {};

      await resendOTP(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: "Email is required",
      });
    });

    it("should return 404 when user not found", async () => {
      mockUser.findOne.mockResolvedValue(null);

      await resendOTP(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        message: "User not found",
      });
    });
  });
});
