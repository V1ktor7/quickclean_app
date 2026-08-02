import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PortalShell } from "@/components/portal-shell";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SALES" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return (
    <PortalShell
      brand="QuickClean"
      roleLabel="Sales"
      userName={session.user.name}
      nav={[
        { href: "/sales", label: "Tools" },
        { href: "/sales/leads", label: "Lead intake" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
