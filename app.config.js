export default ({ config }) => {
  // EAS exposes the active build profile via EAS_BUILD_PROFILE
  // (e.g. "preview" or "production"). Locally it falls back to "production".
  const profile = process.env.EAS_BUILD_PROFILE || "production";

  // Preview gets a separate package so it can be installed alongside
  // production on the same device. Production uses the canonical id.
  const androidPackage =
    profile === "preview" ? "com.rizal.sk.preview" : "com.rizal.sk";

  // Read version from app.json so app.json stays the single source of truth.
  const expoVersion = config.version || "0.1.0";

  // Derive a short "0.1" from "0.1.0" for the APK filename.
  const versionShort = expoVersion.split(".").slice(0, 2).join(".");

  // Per-profile APK rename options consumed by ./plugins/with-android-apk-name
  const apkNameOptions = {
    name: "SK-RIZAL",
    versionName: versionShort,
    versionSuffix: profile === "preview" ? "preview" : "",
  };

  return {
    ...config,
    android: {
      ...config.android,
      package: androidPackage,
    },
    plugins: [
      ...(config.plugins || []),
      ["./app/plugins/with-android-apk-name", apkNameOptions],
    ],
  };
};
