"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Calculator,
  ReceiptText,
  BarChart3,
  Users,
  Building2,
  ShieldCheck,
  Settings,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
}

function useNav(companyId: string): NavItem[] {
  const base = `/company/${companyId}`;
  return [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      label: "GL Upload",
      href: `${base}/upload`,
      icon: <Upload className="h-4 w-4" />,
    },
    { label: "Review ledger", href: `${base}/review`, icon: <ShieldCheck className="h-4 w-4" /> },
    {
      label: "Transactions",
      href: `${base}/transactions`,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "Income WHT",
      icon: <Calculator className="h-4 w-4" />,
      children: [
        { label: "Monthly Batches", href: `${base}/wht/monthly` },
        { label: "Salary (Sec 149)", href: `${base}/wht/salary` },
      ],
    },
    {
      label: "Sales Tax WHT",
      icon: <ReceiptText className="h-4 w-4" />,
      children: [
        { label: "Monthly Batches", href: `${base}/st-wht/monthly` },
      ],
    },
    {
      label: "Challans",
      href: `${base}/challans`,
      icon: <ReceiptText className="h-4 w-4" />,
    },
    {
      label: "Reconciliation",
      href: `${base}/recon/annual`,
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      label: "Vendors",
      href: `${base}/vendors`,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "SECP",
      href: `${base}/secp`,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: "WHT Rules",
      href: "/admin/wht-rules",
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      label: "Settings",
      href: `${base}/settings`,
      icon: <Settings className="h-4 w-4" />,
    },
  ];
}

interface SidebarProps {
  companyId: string;
  companyName: string;
  mobile?: boolean;
  userRole?: string;
}

export function Sidebar({ companyId, companyName, mobile = false, userRole }: SidebarProps) {
  const pathname = usePathname();
  const navItems = useNav(companyId).filter(item => item.label !== "WHT Rules" || userRole === "superadmin");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className={`${mobile ? "flex w-full" : "hidden w-60 md:flex"} h-full shrink-0 flex-col border-r bg-background`}>
      {/* Logo / Company */}
      <div className="flex min-h-16 items-center gap-2 border-b px-4 py-2">
        <Building2 className="h-5 w-5 text-primary" />
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-bold tracking-wide text-primary" title="TaxTech — AI-Assisted Withholding Tax Preparation">TaxTech</span>
          <span className="text-[10px] text-muted-foreground">Withholding Tax Preparation</span>
          <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">
            {companyName}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            if (item.children) {
              const isGroupActive = item.children.some((c) => pathname.startsWith(c.href));
              const isOpen = openGroups[item.label] ?? isGroupActive;
              return (
                <li key={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      isGroupActive && "text-foreground"
                    )}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && (
                    <ul className="ml-4 mt-0.5 space-y-0.5 border-l pl-3">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn(
                              "block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                              pathname === child.href && "bg-accent font-medium text-foreground"
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            }

            return (
              <li key={item.label}>
                <Link
                  href={item.href!}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    pathname === item.href && "bg-accent font-medium text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
