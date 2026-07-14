import { FileText, ShieldCheck, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  {
    title: "Open the client intake form",
    detail: "Navigate to the shared intake workspace and duplicate the template.",
  },
  {
    title: "Verify billing details",
    detail: "Confirm the plan, billing contact, and payment method on file.",
  },
  {
    title: "Schedule the kickoff call",
    detail: "Send the calendar invite with the agenda attached.",
  },
  {
    title: "Create the project workspace",
    detail: "Apply the onboarding checklist and assign an owner to each task.",
  },
];

export function SopPreview() {
  return (
    <div className="relative">
      {/* Source-video chip, layered behind the document */}
      <div className="absolute -top-6 -right-2 hidden items-center gap-2 rounded-lg border border-white/15 bg-navy-light px-3 py-2 text-xs font-medium text-white/80 shadow-md sm:flex lg:-right-6">
        <Video className="size-3.5 text-gold" />
        client-onboarding-walkthrough.mp4
        <span className="text-white/40">14:32</span>
      </div>

      <div className="rounded-xl border border-white/10 bg-card text-card-foreground shadow-2xl">
        {/* Document header */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary">
              <FileText className="size-4 text-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Standard Operating Procedure
              </p>
              <p className="text-sm font-semibold text-primary">
                New Client Onboarding
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-gold-dark/40 bg-gold/10 text-xs font-medium text-gold-dark"
          >
            Generated from video
          </Badge>
        </div>

        {/* Steps */}
        <ol className="space-y-4 px-6 py-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {step.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {/* QC callout */}
        <div className="mx-6 mb-5 flex items-start gap-3 rounded-md border border-gold-dark/30 bg-gold/10 px-4 py-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-dark" />
          <p className="text-xs leading-relaxed text-foreground/80">
            <span className="font-semibold">QC checkpoint:</span> Confirm the
            signed agreement is on file before granting workspace access.
          </p>
        </div>

        {/* Deliverable chips */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
          <span className="text-xs font-medium text-muted-foreground">
            Also generated:
          </span>
          {["Checklist", "Quick-reference guide", "Training doc"].map(
            (label) => (
              <span
                key={label}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
              >
                {label}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
