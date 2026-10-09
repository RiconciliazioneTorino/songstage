-- Per-user flag for product/release-notes emails.
-- Transactional emails (invitations, auth) are not gated by this.
alter table users
  add column if not exists email_notifications boolean not null default true;
