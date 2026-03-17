import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config = {
   packagerConfig: {
      asar: true,
      executableName: 'ginger-media-handler',
      extraResource: ['./docs', './logo.png'],
      icon: './logo',
   },
   rebuildConfig: {},
   makers: [
      new MakerSquirrel({}),
      new MakerZIP({}, ['darwin']),
      new MakerDeb({}),
   ],
   plugins: [
      new VitePlugin({
         build: [
            {
               entry: 'src/main/index.ts',
               config: 'vite.main.config.ts',
               target: 'main',
            },
            {
               entry: 'src/preload/index.ts',
               config: 'vite.preload.config.ts',
               target: 'preload',
            },
         ],
         renderer: [
            {
               name: 'main_window',
               config: 'vite.renderer.config.ts',
            },
         ],
      }),
      new FusesPlugin({
         version: FuseVersion.V1,
         [FuseV1Options.RunAsNode]: false,
         [FuseV1Options.EnableCookieEncryption]: true,
         [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
         [FuseV1Options.EnableNodeCliInspectArguments]: false,
         [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
         [FuseV1Options.OnlyLoadAppFromAsar]: true,
      }),
   ],
};

export default config;
