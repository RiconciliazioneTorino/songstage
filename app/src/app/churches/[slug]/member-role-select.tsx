'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateChurchMemberRole } from '@/lib/churches/actions';
import { ROLE_LABEL, ROLES, type ChurchRole as Role } from '@/lib/churches/roles';

export function MemberRoleSelect({
  churchId,
  userId,
  role,
}: {
  churchId: string;
  userId: string;
  role: Role;
}) {
  const [local, setLocal] = useState<Role>(role);
  const [pending, startTransition] = useTransition();

  useEffect(() => setLocal(role), [role]);

  return (
    <select
      value={local}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Role;
        const prev = local;
        setLocal(next);
        startTransition(async () => {
          const res = await updateChurchMemberRole(churchId, userId, next);
          if (res.error) {
            setLocal(prev);
            alert(res.error);
          }
        });
      }}
      className="text-xs tracking-wide bg-transparent border border-border rounded px-2 py-0.5 hover:border-accent focus:border-accent outline-none disabled:opacity-50 cursor-pointer"
      title="Cambia ruolo"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  );
}
