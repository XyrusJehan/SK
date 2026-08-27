export default ({ config }) => {
  // EAS exposes the active build profile via EAS_BUILD_PROFILE (e.g. "preview" or "production")
  const profile = process.env.EAS_BUILD_PROFILE || "production";

  // Preview gets a separate package so it can be installed alongside production.
  // Production uses the canonical package id from app.json.
  const androidPackage =
    profile === "preview" ? "com.rizal.sk.preview" : "com.rizal.sk";

  return {
    ...config,
    android: {
      ...config.android,
      package: androidPackage,
    },
  };
};
