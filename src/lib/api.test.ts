import { describe, expect, test } from 'vitest';
import { buildPreorderFunctionUrl } from './api';
import * as config from './config';

describe('preorder function client boundary', () => {
  test('builds versioned function URL with exact origin', () => {
    const originalOrigin = config.apiOrigin;
    expect(buildPreorderFunctionUrl('health')).toBe(
      `${originalOrigin}/functions/v1/preorder-v1/health`
    );
  });

  test('does not expose table-specific paths', () => {
    const path = buildPreorderFunctionUrl('health');
    expect(path.includes('/rest/v1/')).toBe(false);
  });
});
