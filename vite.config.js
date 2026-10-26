import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const IMAGE = /\.(jpe?g|png|webp|avif|gif|svg)$/i;
const VIDEO = /\.(mp4|webm|m4v|mov)$/i;
const ID = 'virtual:media';

// Lists whatever is in public/photos and public/video, so new files show up without editing config.js.
function mediaFolders() {
  const root = path.resolve('public');
  const list = (dir, re) => {
    try {
      return fs
        .readdirSync(path.join(root, dir))
        .filter((f) => re.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } catch {
      return [];
    }
  };
  return {
    name: 'media-folders',
    resolveId: (id) => (id === ID ? '\0' + ID : null),
    load(id) {
      if (id !== '\0' + ID) return null;
      return `export default ${JSON.stringify({ photos: list('photos', IMAGE), videos: list('video', VIDEO) })};`;
    },
    configureServer(server) {
      const refresh = (file) => {
        if (!/[\\/]public[\\/](photos|video)[\\/]/.test(file)) return;
        const mod = server.moduleGraph.getModuleById('\0' + ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(path.join(root, 'photos'));
      server.watcher.add(path.join(root, 'video'));
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  plugins: [mediaFolders()],
  build: {
    chunkSizeWarningLimit: 1500, // three.js is big; that's expected
  },
});
