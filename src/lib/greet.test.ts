import { describe, it, expect } from 'vitest';
import { greet } from './greet';

describe('greet', () => {
  it('greets a named user', () => {
    expect(greet('Ada')).toBe('Hello, Ada!');
  });

  it('falls back when name is blank', () => {
    expect(greet('   ')).toBe('Hello, stranger!');
  });

  it('trims whitespace', () => {
    expect(greet('  Linus  ')).toBe('Hello, Linus!');
  });
});
