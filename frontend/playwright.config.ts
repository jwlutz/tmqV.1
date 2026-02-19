import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root for backend server
const projectRoot = path.resolve(__dirname, '..');
const envFile = path.join(projectRoot, '.env');
const envVars: Record<string, string> = {};

if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const envKey = key.trim();
      const envVal = valueParts.join('=').trim();
      envVars[envKey] = envVal;
      // Also set in process.env so test files can access (for skip conditions)
      if (!process.env[envKey]) {
        process.env[envKey] = envVal;
      }
    }
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retry AI tests that may fail due to rate limits or timing
  retries: process.env.CI ? 2 : 1,
  // Limit workers to avoid API rate limits (AI tests run serially within describe blocks)
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',

  // Increase timeout for AI responses (real LLM calls can take 10-30s)
  timeout: 120 * 1000,
  expect: {
    timeout: 60 * 1000,
  },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Video helps debug AI tool tests
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start both backend and frontend servers
  webServer: [
    {
      command: 'python -m uvicorn tmq_backend.main:app --host 0.0.0.0 --port 8000',
      cwd: path.join(projectRoot, 'backend'),
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      env: { ...process.env, ...envVars },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
