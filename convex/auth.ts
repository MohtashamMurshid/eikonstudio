import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL!;
const isProduction = process.env.NODE_ENV === "production";
const localDevUrl =
  process.env.DEV_SITE_URL ??
  process.env.LOCAL_DEV_URL ??
  "http://localhost:3000";
const authBaseUrl = isProduction ? siteUrl : localDevUrl;
const trustedOrigins = isProduction
  ? [siteUrl]
  : Array.from(new Set([siteUrl, localDevUrl]));

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: authBaseUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "email-password"],
      },
    },
    plugins: [
      convex({ authConfig }),
    ],
  })
}

// Example function for getting the current user
// Using safeGetAuthUser to avoid throwing errors during auth state sync (e.g., on page reload)
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.safeGetAuthUser(ctx);
  },
});
