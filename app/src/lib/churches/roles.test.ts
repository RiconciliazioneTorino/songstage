import { describe, expect, it } from 'vitest';
import { ROLE_LABEL, ROLES, roleLabel } from './roles';

describe('role labels', () => {
  it('has an Italian label for every role the database can store', () => {
    // Mirrors the church_role enum; a new value must land here before it ships.
    expect(ROLES).toEqual(['admin', 'director', 'musico', 'lector']);
    for (const r of ROLES) expect(ROLE_LABEL[r]).toBeTruthy();
  });

  it('never shows the raw enum value', () => {
    expect(roleLabel('musico')).toBe('Musicista');
    expect(roleLabel('lector')).toBe('Lettore');
  });

  it('degrades gracefully', () => {
    expect(roleLabel(null)).toBe('—');
    expect(roleLabel(undefined)).toBe('—');
    expect(roleLabel('qualcosa')).toBe('qualcosa');
  });
});
