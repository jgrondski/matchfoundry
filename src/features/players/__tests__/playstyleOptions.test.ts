import { describe, it, expect } from 'vitest';
import { PLAYSTYLE_OPTIONS } from '../playstyleOptions';

describe('PLAYSTYLE_OPTIONS', () => {
  it('offers every canonical playstyle, including Hybrid', () => {
    // Regression: the review-queue "register new player" form offered only DAS, Rolling and Hypertap.
    expect(PLAYSTYLE_OPTIONS.map(o => o.value)).toEqual(['Rolling', 'DAS', 'Hypertap', 'Hybrid']);
  });
});
