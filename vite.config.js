import { fileURLToPath, URL } from 'node:url';
import statamic from '@statamic/cms/vite-plugin';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    plugins: [
        laravel({
            input: ['resources/js/addon.js'],
            publicDirectory: 'resources/dist',
        }),
        statamic(),
    ],
});
