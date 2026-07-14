import { format } from "date-fns";
import type { DocumentPackage } from "@/lib/documents";
import { formatTimestamp } from "@/lib/utils";
import { Markdown } from "./markdown";

/**
 * Read-only, print-friendly rendering of a full SOP package for the public
 * share page. Server-rendered — no client interactivity.
 */

const CHECKLIST_GROUPS = [
  { value: "pre_process", label: "Pre-process checks" },
  { value: "action", label: "Action items" },
  { value: "decision", label: "Decision checks" },
  { value: "quality", label: "Quality checks" },
  { value: "completion", label: "Completion checks" },
  { value: "sign_off", label: "Sign-off" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

export function SharedDocumentView({
  pkg,
  workspaceName,
}: {
  pkg: DocumentPackage;
  workspaceName: string;
}) {
  const doc = pkg.document;
  const metadata: { label: string; value: string }[] = [
    { label: "Department", value: doc.department ?? "—" },
    { label: "Process owner", value: doc.processOwner ?? "—" },
    { label: "Category", value: doc.processCategory ?? "—" },
    { label: "Intended audience", value: doc.intendedAudience ?? "—" },
    {
      label: "Review date",
      value: doc.reviewDate ? format(new Date(doc.reviewDate), "MMMM d, yyyy") : "—",
    },
    {
      label: "Last updated",
      value: format(new Date(doc.updatedAt), "MMMM d, yyyy"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navy header band */}
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <p className="text-sm font-medium uppercase tracking-widest text-gold">
            {workspaceName}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {doc.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <HeaderChip>{doc.sopNumber}</HeaderChip>
            <HeaderChip>Version {doc.versionNumber}</HeaderChip>
            <HeaderChip>{STATUS_LABELS[doc.status] ?? doc.status}</HeaderChip>
            {doc.tags.map((tag) => (
              <HeaderChip key={tag}>#{tag}</HeaderChip>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
        {/* Metadata grid */}
        <section className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border bg-card p-6 sm:grid-cols-3">
          {metadata.map((m) => (
            <div key={m.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.label}
              </dt>
              <dd className="mt-0.5 text-sm font-medium">{m.value}</dd>
            </div>
          ))}
        </section>

        {/* Sections */}
        {pkg.sections.length > 0 && (
          <section className="space-y-6">
            {pkg.sections.map((section) => (
              <div key={section.id}>
                <h2 className="border-b pb-1.5 text-xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                <div className="mt-2 text-sm text-foreground/90">
                  <Markdown content={section.content} />
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Procedure */}
        {pkg.steps.length > 0 && (
          <section>
            <h2 className="border-b pb-1.5 text-xl font-semibold tracking-tight">
              Procedure
            </h2>
            <ol className="mt-4 space-y-5">
              {pkg.steps.map((step) => (
                <li key={step.id} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                    {step.stepNumber}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="flex flex-wrap items-baseline gap-2 font-semibold">
                      {step.title}
                      {step.videoTimestampSeconds !== null && (
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                          {formatTimestamp(step.videoTimestampSeconds)}
                        </span>
                      )}
                    </p>
                    <div className="text-sm text-foreground/90">
                      <Markdown content={step.instruction} />
                    </div>
                    {step.expectedResult && (
                      <Callout tone="success" label="Expected result">
                        {step.expectedResult}
                      </Callout>
                    )}
                    {step.warning && (
                      <Callout tone="warning" label="Warning">
                        {step.warning}
                      </Callout>
                    )}
                    {step.note && (
                      <Callout tone="neutral" label="Note">
                        {step.note}
                      </Callout>
                    )}
                    {step.qualityCheckpoint && (
                      <Callout tone="info" label="Quality checkpoint">
                        {step.qualityCheckpoint}
                      </Callout>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Checklist */}
        {pkg.checklist.length > 0 && (
          <section>
            <h2 className="border-b pb-1.5 text-xl font-semibold tracking-tight">
              Checklist
            </h2>
            <div className="mt-4 space-y-5">
              {CHECKLIST_GROUPS.map((group) => {
                const items = pkg.checklist
                  .filter((i) => i.category === group.value)
                  .sort((a, b) => a.position - b.position);
                if (items.length === 0) return null;
                return (
                  <div key={group.value}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-start gap-2.5 text-sm">
                          <span
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 rounded-sm border-2 border-muted-foreground/50"
                          />
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Quick guide */}
        {pkg.quickGuide && (
          <section>
            <h2 className="border-b pb-1.5 text-xl font-semibold tracking-tight">
              Quick reference guide
            </h2>
            <div className="mt-4 space-y-4 text-sm">
              <LabeledBlock label="Objective">{pkg.quickGuide.objective}</LabeledBlock>
              {pkg.quickGuide.requiredTools.length > 0 && (
                <LabeledList label="Required tools" items={pkg.quickGuide.requiredTools} />
              )}
              {pkg.quickGuide.keySteps.length > 0 && (
                <div>
                  <BlockLabel>Key steps</BlockLabel>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-6">
                    {pkg.quickGuide.keySteps.map((s, i) => (
                      <li key={i}>
                        <span className="font-medium">{s.title}</span>
                        {s.summary ? ` — ${s.summary}` : ""}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {pkg.quickGuide.warnings.length > 0 && (
                <LabeledList label="Warnings" items={pkg.quickGuide.warnings} />
              )}
              {pkg.quickGuide.commonErrors.length > 0 && (
                <LabeledList label="Common errors" items={pkg.quickGuide.commonErrors} />
              )}
              {pkg.quickGuide.escalationContact && (
                <LabeledBlock label="Escalation contact">
                  {pkg.quickGuide.escalationContact}
                </LabeledBlock>
              )}
              {pkg.quickGuide.completionConfirmation && (
                <LabeledBlock label="Completion confirmation">
                  {pkg.quickGuide.completionConfirmation}
                </LabeledBlock>
              )}
            </div>
          </section>
        )}

        {/* Training guide */}
        {pkg.trainingGuide && (
          <section>
            <h2 className="border-b pb-1.5 text-xl font-semibold tracking-tight">
              Training guide
            </h2>
            <div className="mt-4 space-y-4 text-sm">
              <LabeledBlock label="Learning objective">
                {pkg.trainingGuide.learningObjective}
              </LabeledBlock>
              <LabeledBlock label="Process overview">
                {pkg.trainingGuide.processOverview}
              </LabeledBlock>
              {pkg.trainingGuide.keyTerminology.length > 0 && (
                <div>
                  <BlockLabel>Key terminology</BlockLabel>
                  <dl className="mt-1.5 space-y-1.5">
                    {pkg.trainingGuide.keyTerminology.map((t, i) => (
                      <div key={i}>
                        <dt className="inline font-medium">{t.term}</dt>
                        <dd className="inline"> — {t.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {pkg.trainingGuide.walkthrough.length > 0 && (
                <div>
                  <BlockLabel>Guided walkthrough</BlockLabel>
                  <ol className="mt-1.5 list-decimal space-y-2 pl-6">
                    {pkg.trainingGuide.walkthrough.map((w, i) => (
                      <li key={i}>
                        <span className="font-medium">{w.step}</span>
                        {w.detail && <p className="mt-0.5">{w.detail}</p>}
                        {w.whyItMatters && (
                          <p className="mt-0.5 text-muted-foreground">
                            Why it matters: {w.whyItMatters}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {pkg.trainingGuide.practiceExercise && (
                <LabeledBlock label="Practice exercise">
                  {pkg.trainingGuide.practiceExercise}
                </LabeledBlock>
              )}
              {pkg.trainingGuide.knowledgeChecks.length > 0 && (
                <div>
                  <BlockLabel>Knowledge checks</BlockLabel>
                  <ol className="mt-1.5 list-decimal space-y-2 pl-6">
                    {pkg.trainingGuide.knowledgeChecks.map((c, i) => (
                      <li key={i}>
                        <p className="font-medium">{c.question}</p>
                        <p className="mt-0.5 text-muted-foreground">{c.answer}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {pkg.trainingGuide.commonMistakes.length > 0 && (
                <LabeledList
                  label="Common mistakes"
                  items={pkg.trainingGuide.commonMistakes}
                />
              )}
              {pkg.trainingGuide.supervisorReview && (
                <LabeledBlock label="Supervisor review">
                  {pkg.trainingGuide.supervisorReview}
                </LabeledBlock>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t">
        <p className="mx-auto max-w-4xl px-6 py-6 text-center text-xs text-muted-foreground">
          Published with FlowNet SOP Builder
        </p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function HeaderChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

const CALLOUT_TONES = {
  warning:
    "border-l-4 border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-200",
  success:
    "border-l-4 border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-200",
  info: "border-l-4 border-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-500/10 dark:text-sky-200",
  neutral: "border-l-4 border-border bg-muted/50 text-foreground",
} as const;

function Callout({
  tone,
  label,
  children,
}: {
  tone: keyof typeof CALLOUT_TONES;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-r-md px-3 py-2 text-sm ${CALLOUT_TONES[tone]}`}>
      <span className="font-semibold">{label}: </span>
      {children}
    </div>
  );
}

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function LabeledBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <BlockLabel>{label}</BlockLabel>
      <p className="mt-1.5 leading-relaxed">{children}</p>
    </div>
  );
}

function LabeledList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <BlockLabel>{label}</BlockLabel>
      <ul className="mt-1.5 list-disc space-y-1 pl-6">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
