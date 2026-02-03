// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { readFileSync } from 'fs';

// Leer versión del package.json
const packageJson = JSON.parse(
  readFileSync('./package.json', 'utf-8')
);

// https://astro.build/config
export default defineConfig({
  output: 'static', // Modo estático con rutas dinámicas manejadas por .htaccess en producción
  integrations: [react(), tailwind()],
  vite: {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
    }
  }
});
