/**
 * Custom build script using electron-builder JS API.
 * Completely disables code signing via the sign callback.
 */
import { build, Platform, Arch } from 'electron-builder';

console.log('🚀 Building ROMS Setup.exe...');

await build({
  targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
  config: {
    appId: 'com.roms.restaurant',
    productName: 'Restaurant Order Management System',
    directories: {
      output: 'release',
    },
    files: [
      'electron/**/*',
      'dist/**/*',
      'server.cjs',
      'node_modules/**/*',
      'package.json',
    ],
    asarUnpack: [
      'server.cjs',
      'node_modules/better-sqlite3/**/*',
      'node_modules/bindings/**/*',
      'node_modules/file-uri-to-path/**/*',
      'node_modules/prebuild-install/**/*',
      'dist/**/*',
    ],
    extraResources: [
      { from: 'roms.db', to: 'roms.db' },
    ],
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: 'electron/icon.ico',
      requestedExecutionLevel: 'asInvoker',
      sign: async () => {},
      signingHashAlgorithms: null,
      verifyUpdateCodeSignature: false,
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'ROMS Restaurant',
    },
  },
});

console.log('✅ Build complete! Check the release/ folder.');
