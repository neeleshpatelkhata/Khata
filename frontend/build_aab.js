const { execSync } = require('child_process');
const path = require('path');

const javaHome = 'C:\\Users\\HP\\jdk17\\jdk-17.0.20.1+1';
const androidHome = 'C:\\Users\\HP\\.android-sdk';
const gradlePath = 'C:\\Users\\HP\\.gradle\\wrapper\\dists\\gradle-8.9-bin\\90cnw93cvbtalezasaz0blq0a\\gradle-8.9\\bin\\gradle.bat';
const androidDir = path.join(__dirname, 'android');

console.log('🚀 Compiling Khata Enterprise Signed Android App Bundle (.aab) & APK...');

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${javaHome}\\bin;${process.env.PATH}`,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome
};

try {
  const cmd = `"${gradlePath}" bundleRelease assembleRelease --no-daemon`;
  console.log('Executing:', cmd);
  const stdout = execSync(cmd, { cwd: androidDir, env, encoding: 'utf-8', stdio: 'inherit' });
  console.log('✅ Android Bundle Build Completed Successfully!');
} catch (err) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}
