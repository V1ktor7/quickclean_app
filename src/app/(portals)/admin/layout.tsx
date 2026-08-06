import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PortalShell } from "@/components/portal-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <PortalShell
      brand="QuickClean"
      roleLabel="Admin"
      userName={session.user.name}
      nav={[
        { href: "/admin", label: "Overview" },
        { href: "/admin/integrations", label: "Integrations" },
        { href: "/admin/clients", label: "Clients" },
        { href: "/admin/campaigns", label: "SMS" },
        { href: "/admin/reviews", label: "Reviews" },
        { href: "/admin/commissions", label: "Commissions" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/leads", label: "Leads" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
