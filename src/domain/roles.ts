export type UserRole = "ADMIN" | "STAFF";

export const USER_ROLES: UserRole[] = ["ADMIN", "STAFF"];

/** Pages staff can open (admin has full access). */
export const STAFF_PAGE_PREFIXES = ["/pos", "/sales", "/bookings", "/clients"] as const;

/** API routes staff may call — method-specific. */
export const STAFF_API_RULES: Array<{
  prefix: string;
  methods: string[];
}> = [
  { prefix: "/api/auth/me", methods: ["GET"] },
  { prefix: "/api/auth/logout", methods: ["POST"] },
  { prefix: "/api/businesses", methods: ["GET"] },
  { prefix: "/api/products", methods: ["GET"] },
  { prefix: "/api/sales", methods: ["POST"] },
  { prefix: "/api/uploads/receipt", methods: ["POST"] },
  { prefix: "/api/services", methods: ["GET"] },
  { prefix: "/api/clients", methods: ["GET"] },
  { prefix: "/api/clients/", methods: ["GET", "POST"] },
  { prefix: "/api/appointments", methods: ["GET", "POST"] },
  { prefix: "/api/transactions", methods: ["GET"] },
];

export function normalizeRole(role: string | undefined | null): UserRole {
  return role === "STAFF" ? "STAFF" : "ADMIN";
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

export function staffHomePath(): string {
  return "/pos";
}

export function canStaffAccessPage(pathname: string): boolean {
  if (pathname === "/login") return true;
  return STAFF_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function canStaffAccessApi(pathname: string, method: string): boolean {
  const upper = method.toUpperCase();
  return STAFF_API_RULES.some(
    (rule) =>
      (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) &&
      rule.methods.includes(upper)
  );
}

export function canAccessPage(role: UserRole, pathname: string): boolean {
  if (isAdmin(role)) return true;
  return canStaffAccessPage(pathname);
}

export function canAccessApi(
  role: UserRole,
  pathname: string,
  method: string
): boolean {
  if (isAdmin(role)) return true;
  return canStaffAccessApi(pathname, method);
}
