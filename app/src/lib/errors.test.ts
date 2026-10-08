import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('translates an RLS denial by SQLSTATE', () => {
    expect(friendlyError({ code: '42501', message: 'permission denied' })).toMatch(/permessi/i);
  });

  it('translates an RLS denial reported only as prose', () => {
    expect(
      friendlyError({ message: 'new row violates row-level security policy for table "songs"' })
    ).toMatch(/permessi/i);
  });

  it('recognises a unique violation both ways', () => {
    expect(friendlyError({ code: '23505' })).toMatch(/già/i);
    expect(friendlyError({ message: 'duplicate key value violates unique constraint' })).toMatch(/già/i);
  });

  it('recognises a foreign key violation', () => {
    expect(friendlyError({ code: '23503' })).toMatch(/riferimenti/i);
    expect(friendlyError({ message: 'violates foreign key constraint' })).toMatch(/riferimenti/i);
  });

  it('maps the PostgREST not-found code', () => {
    expect(friendlyError({ code: 'PGRST116' })).toMatch(/non trovato/i);
  });

  it('never leaks the raw database message', () => {
    const raw = 'relation "public.songs" does not exist';
    expect(friendlyError({ code: '42P01', message: raw })).not.toContain(raw);
  });

  it('uses the caller fallback for anything unrecognised', () => {
    expect(friendlyError({ code: 'XX000', message: 'boom' }, 'Non si è potuto salvare.')).toBe(
      'Non si è potuto salvare.'
    );
  });

  it('handles a missing error object', () => {
    expect(friendlyError(null, 'fallback')).toBe('fallback');
    expect(friendlyError(undefined)).toBeTruthy();
  });
});
