import { betterAuth } from "better-auth";
import { getAuthConfig } from "@/lib/auth/shared-config";

export const auth = betterAuth(getAuthConfig());
