const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const podfilePath = path.join(projectRoot, 'ios', 'Podfile');
const marker = '# Xcode 27 no longer supports simulator deployment targets below iOS 15.';
const postInstallCall = `    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )`;
const deploymentTargetPatch = `${postInstallCall}

    ${marker}
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |build_config|
        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
      end
    end`;

if (!fs.existsSync(podfilePath)) {
  throw new Error('ios/Podfile is missing. Run Expo prebuild before applying the patch.');
}

const podfile = fs.readFileSync(podfilePath, 'utf8');

if (podfile.includes(marker)) {
  console.log('PASS iOS Podfile already supports Xcode 27');
  process.exit(0);
}

if (!podfile.includes(postInstallCall)) {
  throw new Error('Unable to find the Expo post_install block in ios/Podfile.');
}

fs.writeFileSync(
  podfilePath,
  podfile.replace(postInstallCall, deploymentTargetPatch),
);

console.log('PASS patched iOS Pod deployment targets to 15.1');
