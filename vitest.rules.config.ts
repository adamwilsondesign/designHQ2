import { defineConfig } from 'vitest/config';

// Security-rules tests. Needs the Firestore and Storage emulators: npm run test:rules
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
