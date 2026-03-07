import { z } from "zod";

export const emailSchema = z.string().email().max(255);

export const otpCodeSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

export const planSchema = z.enum(["starter", "pro", "scale"]);

export const sendOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

export const createCheckoutSchema = z.object({
  plan: planSchema,
});

// Infer request types from schemas
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
