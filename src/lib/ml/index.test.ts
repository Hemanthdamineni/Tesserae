import { describe, expect, it } from 'vitest';
import * as ml from './index';

describe('ml barrel', () => {
  it('exposes the documented public surface without pulling in the runtime', () => {
    expect(typeof ml.loadModel).toBe('function');
    expect(typeof ml.estimateDownloadSize).toBe('function');
    expect(typeof ml.setMlRuntimeLoader).toBe('function');
    expect(typeof ml.assertAllowedModel).toBe('function');
    expect(typeof ml.resolveBackend).toBe('function');
    expect(typeof ml.ProgressTracker).toBe('function');
    expect(typeof ml.ModelCache).toBe('function');
    expect(typeof ml.createModelFetch).toBe('function');
    expect(ml.ModelCache.defaultName).toBe('tesserae-ml-v1');
  });
});
