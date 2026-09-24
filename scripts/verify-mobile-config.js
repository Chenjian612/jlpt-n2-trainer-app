const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appConfig = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'),
).expo;
const easConfig = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'eas.json'), 'utf8'),
);
const appConstants = fs.readFileSync(
  path.join(projectRoot, 'src/config/constants.ts'),
  'utf8',
);
const aiCoachClient = fs.readFileSync(
  path.join(projectRoot, 'src/services/aiCoachClient.ts'),
  'utf8',
);

function assertAsset(relativePath, label) {
  assert.equal(typeof relativePath, 'string', `${label} must be configured.`);
  const absolutePath = path.resolve(projectRoot, relativePath);
  assert.equal(
    absolutePath.startsWith(`${projectRoot}${path.sep}`),
    true,
    `${label} must stay inside the project.`,
  );
  assert.equal(fs.existsSync(absolutePath), true, `${label} does not exist: ${relativePath}`);
}

function findPlugin(name) {
  return appConfig.plugins.find((plugin) => (
    plugin === name || (Array.isArray(plugin) && plugin[0] === name)
  ));
}

assert.equal(appConfig.name, 'JLPT N2 Trainer');
assert.equal(appConfig.slug, 'jlpt-n2-trainer-app');
assert.equal(appConfig.scheme, 'jlptn2trainer');
assert.match(appConfig.version, /^\d+\.\d+\.\d+$/);

assert.equal(appConfig.ios.bundleIdentifier, 'com.chenjian612.jlptn2trainer');
assert.match(appConfig.ios.buildNumber, /^\d+$/);
assert.ok(Number(appConfig.ios.buildNumber) >= 1, 'iOS build number must be positive.');
assert.equal(
  appConfig.ios.infoPlist?.ITSAppUsesNonExemptEncryption,
  false,
  'iOS export-compliance declaration must remain explicit.',
);

assert.equal(appConfig.android.package, appConfig.ios.bundleIdentifier);
assert.ok(
  Number.isInteger(appConfig.android.versionCode) && appConfig.android.versionCode >= 1,
  'Android versionCode must be a positive integer.',
);

for (const permission of [
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]) {
  assert.ok(
    appConfig.android.blockedPermissions.includes(permission),
    `Android permission must remain blocked: ${permission}`,
  );
}

const audioPlugin = findPlugin('expo-audio');
assert.ok(Array.isArray(audioPlugin), 'expo-audio must declare explicit permission settings.');
assert.equal(audioPlugin[1].microphonePermission, false);
assert.equal(audioPlugin[1].recordAudioAndroid, false);
assert.equal(audioPlugin[1].enableBackgroundRecording, false);
assert.ok(findPlugin('expo-asset'), 'expo-asset plugin must remain configured.');

assertAsset(appConfig.icon, 'App icon');
assertAsset(appConfig.splash.image, 'Splash image');
assertAsset(appConfig.android.adaptiveIcon.foregroundImage, 'Android foreground icon');
assertAsset(appConfig.android.adaptiveIcon.backgroundImage, 'Android background icon');
assertAsset(appConfig.android.adaptiveIcon.monochromeImage, 'Android monochrome icon');

assert.match(easConfig.cli.version, /^>=\s*\d+\.\d+\.\d+$/);
assert.equal(easConfig.cli.appVersionSource, 'remote');
assert.equal(easConfig.build.preview.distribution, 'internal');
assert.equal(easConfig.build.preview.environment, 'preview');
assert.equal(easConfig.build.preview.android.buildType, 'apk');
assert.equal(easConfig.build.production.environment, 'production');
assert.equal(easConfig.build.production.autoIncrement, true);
assert.deepEqual(easConfig.submit.production, {});

assert.match(
  appConstants,
  /const defaultAiProxyUrl = 'https:\/\/[^']+\.pages\.dev\/api\/ai';/,
  'Shipped clients must use the phone-reachable Pages AI route by default.',
);
assert.match(
  appConstants,
  /EXPO_PUBLIC_AI_PROVIDER \?\? 'deepseek'/,
  'Release builds must default to the provider implemented by the bundled proxy.',
);
assert.match(
  aiCoachClient,
  /navigator\.product === 'ReactNative'[\s\S]*localhost\|127\\\.0\\\.0\\\.1/,
  'Native clients must not request a loopback AI service that points to the phone itself.',
);
assert.match(
  aiCoachClient,
  /if \(APP_CONFIG\.DEEPSEEK_PROXY_URL\) \{\s*return callDeepSeekWithSystem/,
  'Shipped AI features must prefer the key-hiding proxy over direct provider calls.',
);

console.log('PASS mobile identity, versions, permissions, plugins, and assets');
console.log('PASS iOS export-compliance declaration');
console.log('PASS EAS preview APK and production build profiles');
console.log('PASS native AI proxy fallback, provider default, and loopback protection');
if (appConfig.extra?.eas?.projectId) {
  console.log(`PASS EAS project linked: ${appConfig.extra.eas.projectId}`);
} else {
  console.log('INFO EAS project link is optional for the local Xcode workflow');
}
