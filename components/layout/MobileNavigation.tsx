"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
export function MobileNavigation(props: {
  companyId: string;
  companyName: string;
  userRole?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute left-3 top-3 z-40 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation"
            />
          }
        >
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent side="left" className="gap-0 p-0">
          <SheetHeader>
            <SheetTitle>TaxTech — AI-Assisted Withholding Tax Preparation</SheetTitle>
            <SheetDescription>{props.companyName}</SheetDescription>
          </SheetHeader>
          <div
            className="min-h-0 flex-1"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <Sidebar {...props} mobile />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
