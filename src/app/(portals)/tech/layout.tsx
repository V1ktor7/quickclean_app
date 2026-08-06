import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PortalShell } from "@/components/portal-shell";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "TECH" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return (
    <PortalShell
      brand="QuickClean"
      roleLabel="Tech"
      userName={session.user.name}
      nav={[
        { href: "/tech/schedule", label: "Schedule" },
        { href: "/tech", label: "Time clock" },
        { href: "/tech/upsells", label: "Upsells" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
