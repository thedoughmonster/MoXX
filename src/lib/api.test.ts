import { describe, expect, test } from 'vitest';
import { buildPreorderBootstrapUrl } from './api';
import * as config from './config';

describe('preorder function client boundary', () => {
  test('builds the accepted bootstrap URL with exact origin', () => {
    const originalOrigin = config.apiOrigin;
    expect(buildPreorderBootstrapUrl()).toBe(
      `${originalOrigin}/functions/v1/momi-preorder-bootstrap-v1?surface_key=preorder`
    );
  });

  test('does not expose table-specific paths', () => {
    const path = buildPreorderBootstrapUrl();
    expect(path.includes('/rest/v1/')).toBe(false);
  });
});
