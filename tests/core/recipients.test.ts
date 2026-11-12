import { describe, expect, it } from 'vitest';
import { isTestAddress, maskEmail, normalizeEmail } from '../../core/recipients';

describe('isTestAddress', () => {
  it.each([
    ['ion@turbo-garaj.test', true],
    ['Ion@Turbo-Garaj.TEST ', true],
    ['ion@gmail.com', false],
    ['ion@test', false],
    ['@x.test', false],
    ['a b@x.test', false],
  ])('%j -> %s', (input, expected) => {
    expect(isTestAddress(input)).toBe(expected);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('Ion@Turbo-Garaj.TEST ')).toBe('ion@turbo-garaj.test');
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('ion@turbo-garaj.test')).toBe('i***@turbo-garaj.test');
  });
});
