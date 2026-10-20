"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  FileUp,
  ShieldCheck,
  Users,
  Calculator,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { tourSteps } from "@/lib/app-tour";
const icons = [Compass, FileUp, ShieldCheck, Users, Calculator, CheckCircle2];
export function AppTour({
  autoStart,
  companyId,
  viewer,
}: {
  autoStart: boolean;
  companyId: string;
  viewer: boolean;
}) {
  const [open, setOpen] = useState(autoStart);
  const [step, setStep] = useState(0);
  const recorded = useRef(false);
  const router = useRouter();
  const steps = tourSteps(viewer),
    current = steps[step],
    Icon = icons[step];
  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("taxtech:start-tour", replay);
    return () => window.removeEventListener("taxtech:start-tour", replay);
  }, []);
  useEffect(() => {
    if (!open || recorded.current) return;
    recorded.current = true;
    // Mark the first display, including skipped/closed tours, so it doesn't
    // reopen on the next sign-in. Guidance never mutates financial records.
    void fetch("/api/account/tour", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Tour preference not saved");
      })
      .catch(() => {
        recorded.current = false;
        toast.error(
          "Your tour preference couldn’t be saved. The tour may appear next time.",
        );
      });
  }, [open]);
  function visitPage() {
    if (!current.page) return;
    setOpen(false);
    router.push(`/company/${companyId}/${current.page}`);
  }
  return (
    <div data-tour-autostart={autoStart ? "true" : "false"}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <div className="border-b bg-muted/40 px-6 pb-5 pt-6 sm:px-8">
            <p className="mb-5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Compass className="size-4" /> TaxTech · App tour
            </p>
            <div
              aria-hidden="true"
              className="mb-5 flex size-12 items-center justify-center rounded-xl border bg-background text-primary"
            >
              <Icon className="size-6" />
            </div>
            <DialogHeader>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {current.eyebrow}
              </p>
              <DialogTitle className="text-2xl leading-tight">
                {current.title}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-relaxed">
                {current.description}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 py-5 sm:px-8">
            <ul className="space-y-3 text-sm leading-relaxed">
              {current.points.map((point) => (
                <li className="flex gap-3" key={point}>
                  <Check
                    className="mt-1 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {current.page && (
              <Button
                variant="outline"
                className="h-auto whitespace-normal py-2"
                onClick={visitPage}
              >
                Open{" "}
                {current.page === "wht/monthly"
                  ? "Income WHT"
                  : current.page === "upload"
                    ? "GL Upload"
                    : current.page === "review"
                      ? "Review ledger"
                      : current.page === "vendors"
                        ? "Vendors"
                        : current.page === "transactions"
                          ? "Transactions"
                          : "Challans"}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Skip tour
              </Button>
              <span
                role="status"
                className="text-xs tabular-nums text-muted-foreground"
              >
                Step {step + 1} of {steps.length}
              </span>
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              )}
              <Button
                onClick={() =>
                  step === steps.length - 1
                    ? setOpen(false)
                    : setStep((s) => s + 1)
                }
              >
                {step === steps.length - 1 ? "Finish tour" : "Next"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
