import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';

// Clear localStorage before each test to prevent state leakage
beforeEach(() => {
  localStorage.clear();
});
