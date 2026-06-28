export const ROLES = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Video Editor",
  writer: "Content & Posting",
  designer: "Designer / Creatives",
  client: "Doctor (Client)",
};
// Roles an admin can assign (super_admin is set in the database only)
export const ASSIGNABLE_ROLES = ["admin", "editor", "writer", "designer", "client"];

// `roles` is always an array now. These helpers accept the array.
export const hasRole = (roles, r) => Array.isArray(roles) && roles.includes(r);
export const isAdmin = (roles) => hasRole(roles, "super_admin") || hasRole(roles, "admin");
export const isStaff = (roles) =>
  ["super_admin", "admin", "editor", "writer", "designer"].some((r) => hasRole(roles, r));
export const rolesLabel = (roles = []) => roles.map((r) => ROLES[r] || r).join(", ") || "—";
