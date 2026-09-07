import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "google-auth-library",
    "google-gax",
    "gcp-metadata",
  ],
};

export default nextConfig;
