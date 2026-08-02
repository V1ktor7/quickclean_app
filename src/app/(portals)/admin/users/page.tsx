"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, H1, Input, Label, Muted } from "@/components/ui";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "TECH",
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Create failed");
      return;
    }
    setOk("User created.");
    setForm({ name: "", email: "", password: "", role: "TECH" });
    await load();
  }

  async function toggleActive(user: User) {
    setBusy(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Update failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>User management</H1>
        <Muted>Create, edit, or revoke Tech and Sales access.</Muted>
      </div>

      <Card>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg font-semibold">
          Create account
        </h2>
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div>
            <Label>Role</Label>
            <select
              className="w-full rounded-xl border border-[var(--qc-line)] bg-white px-3 py-2.5 text-sm"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="TECH">Tech</option>
              <option value="SALES">Sales</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {error ? (
            <div className="md:col-span-2">
              <Alert tone="bad">{error}</Alert>
            </div>
          ) : null}
          {ok ? (
            <div className="md:col-span-2">
              <Alert tone="ok">{ok}</Alert>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              Create user
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--qc-bg)] px-3 py-3 text-sm"
            >
              <div>
                <div className="font-semibold">{user.name}</div>
                <div className="text-[var(--qc-muted)]">{user.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{user.role}</Badge>
                <Badge tone={user.active ? "ok" : "bad"}>
                  {user.active ? "Active" : "Revoked"}
                </Badge>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => toggleActive(user)}
                >
                  {user.active ? "Revoke" : "Restore"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
