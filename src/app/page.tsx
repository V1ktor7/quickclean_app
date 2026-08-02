import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeForRole } from "@/lib/rbac";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.role || session.user.active === false) {
    redirect("/login");
  }
  redirect(homeForRole(session.user.role));
}
