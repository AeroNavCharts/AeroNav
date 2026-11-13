import { defineConfig } from 'astro/config';

const drivePdfDev = {
  name: 'drive-pdf-dev',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const match = (req.url || '').match(/^\/pdf\/([A-Za-z0-9_-]{20,80})$/);
      if (!match) return next();
      try {
        const upstream = await fetch(`https://drive.usercontent.google.com/download?id=${match[1]}&export=download`);
        if (!upstream.ok) throw new Error(String(upstream.status));
        res.setHeader('content-type', 'application/pdf');
        res.end(Buffer.from(await upstream.arrayBuffer()));
      } catch (error) {
        res.statusCode = 502;
        res.end('Document unavailable');
      }
    });
  },
};

export default defineConfig({
  site: 'https://aeronav.space',
  build: {
    format: 'file',
  },
  vite: {
    plugins: [drivePdfDev],
  },
});
