// ─── CUSTOM CONFIG PLUGIN — with-android-apk-name ─────────────────────────────
//
// Renames the APK produced by `assembleRelease` / `assembleDebug` so the file
// you download from EAS has a meaningful name (e.g. SK-RIZAL-0.1.apk or
// SK-RIZAL-0.1-preview.apk) instead of `app-release.apk`.
//
// How it works: after `npx expo prebuild`, this plugin patches
// `android/app/build.gradle` to add a `android.applicationVariants.all`
// block that sets `outputFileName` for every variant. EAS Build runs
// prebuild automatically before the native build, so the rename takes
// effect on every cloud build with no extra steps.
//
// Install path: `app/plugins/with-android-apk-name.js`.
//
// `app.config.js` (or `app.json` with a plugins entry) wires it up:
//
//   plugins: [
//     "./app/plugins/with-android-apk-name",
//     {
//       name: "SK-RIZAL",
//       versionName: "0.1",
//       versionSuffix: "preview", // omit for production
//     },
//   ]
// ─────────────────────────────────────────────────────────────────────────────

const { withAppBuildGradle } = require('@expo/config-plugins');

function withAndroidApkName(config, options = {}) {
  const name = options.name || 'app';
  const versionName = options.versionName || '0.0';
  const versionSuffix = options.versionSuffix || '';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  const suffix = versionSuffix ? `-${versionSuffix}` : '';
  const finalName = `${name}-${versionName}${suffix}-${date}.apk`;

  return withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents;
    if (gradle.includes('// >>> APK rename hook')) {
      return mod; // already patched
    }

    const hook = `
// >>> APK rename hook (custom config plugin)
android.applicationVariants.all { variant ->
    def date = new Date().format("yyyyMMdd")
    def baseName = "${name}-${versionName}${suffix}"
    variant.outputs.all {
        def buildType = variant.buildType.name
        outputFileName = "\${baseName}-\${date}-\${buildType}.apk"
    }
}
// <<< APK rename hook
`;

    // Insert just before the closing brace of the `android {` block.
    // We look for the last top-level `}` in the file — good enough for the
    // standard Expo `app/build.gradle` shape.
    const lastBrace = gradle.lastIndexOf('}');
    if (lastBrace === -1) {
      throw new Error('Could not locate closing brace in app/build.gradle');
    }
    mod.modResults.contents =
      gradle.slice(0, lastBrace) + hook + gradle.slice(lastBrace);
    return mod;
  });
}

module.exports = withAndroidApkName;
