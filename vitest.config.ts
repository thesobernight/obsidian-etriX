import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
    },
    resolve: {
        alias: {
            electron: path.resolve(__dirname, './electron-mock.ts'),
        },
    },
});
