"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "./Logo";
import { isAdmin } from "@/lib/roles";

export default function Sidebar({ roles }) {
  const path = usePathname();
  const items = [
    { href: "/dashboard", label: "Pipeline", icon: "▦" },
    { href: "/team", label: "Team", icon: "◷", admin: true },
    { href: "/doctors", label: "Doctors", icon: "✚" },
    { href: "/analytics", label: "Analytics", icon: "◎" },
    { href: "/accounts", label: "Accounts", icon: "₹", admin: true },
    { href: "/users", label: "Users", icon: "⚇", admin: true },
    { href: "/account", label: "My account", icon: "⚙" },
  ];
  return (
    <aside className="side">
      <div className="brand">
        <Logo size={40} />
        <div><div className="bname">Brand MD</div><div className="bsub">Solutions</div></div>
      </div>
      <nav className="nav">
        {items.filter((i) => !i.admin || isAdmin(roles)).map((i) => (
          <Link key={i.href} href={i.href} className={"nav-item" + (path === i.href ? " active" : "")}>
            <i>{i.icon}</i> <span>{i.label}</span>
          </Link>
        ))}
      </nav>
      <div className="side-foot"><span className="signal-dot" />Live workspace</div>
    </aside>
  );
}
