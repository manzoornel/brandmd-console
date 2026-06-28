export const ROLES = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Video Editor",
  writer: "Content & Posting",
  client: "Doctor (Client)",
};
export const ASSIGNABLE_ROLES = ["admin", "editor", "writer", "client"]; // super_admin set in DB
export const isAdmin = (r) => r === "super_admin" || r === "admin";
export const isStaff = (r) => ["super_admin", "admin", "editor", "writer"].includes(r);
