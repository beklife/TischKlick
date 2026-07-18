import {defineConfig} from 'vitest/config';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({path: '.env.local'});

export default defineConfig({
  resolve: {alias: {'@': path.resolve(__dirname, 'src')}},
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000
  }
});
