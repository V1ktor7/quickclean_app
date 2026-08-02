import { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
};

export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
  if (!user.active) {
    throw new AppError("Account deactivated", 403, "INACTIVE");
  }
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role as Role,
    active: true,
  };
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }
  return user;
}

export function homeForRole(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return "/admin";
    case Role.SALES:
      return "/sales";
    case Role.TECH:
      return "/tech";
    default:
      return "/login";
  }
}
