import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PLANS, PLAN_ORDER, type PlanFeatures } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for FlowNet SOP Builder. Start free and upgrade as your documentation library grows.",
};

type ComparisonRow = {
  label: string;
  value: (features: PlanFeatures) => string | boolean;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Transcription minutes / month",
    value: (f) => f.transcriptionMinutesPerMonth.toLocaleString("en-US"),
  },
  {
    label: "Team members",
    value: (f) => f.maxWorkspaceMembers.toLocaleString("en-US"),
  },
  {
    label: "Document types",
    value: (f) => (f.allDocumentTypes ? "All types" : "SOP only"),
  },
  { label: "PDF export", value: (f) => f.pdfExport },
  { label: "DOCX export", value: (f) => f.docxExport },
  { label: "Version history", value: (f) => f.versionHistory },
  { label: "Shared links", value: (f) => f.sharedLinks },
  { label: "Approval workflow", value: (f) => f.approvalWorkflow },
  { label: "Workspace branding", value: (f) => f.workspaceBranding },
  { label: "Priority processing", value: (f) => f.priorityProcessing },
];

const BILLING_FAQS = [
  {
    question: "Can I change plans at any time?",
    answer:
      "Yes. You can upgrade, downgrade, or cancel whenever you like. Upgrades take effect immediately; downgrades and cancellations apply at the end of your current billing cycle.",
  },
  {
    question: "What happens when I run out of transcription minutes?",
    answer:
      "New uploads pause until your allowance resets at the start of the next billing cycle — or immediately if you upgrade to a plan with a larger allowance. Everything you've already generated stays fully accessible.",
  },
  {
    question: "Do unused minutes roll over to the next month?",
    answer:
      "No. Your transcription allowance resets at the start of each billing cycle, so plan around your typical monthly recording volume.",
  },
  {
    question: "Is there a free trial of the paid plans?",
    answer:
      "The Starter plan is free forever, so you can experience the full generation workflow before paying anything. When you need more minutes, team seats, or document types, upgrading takes under a minute.",
  },
  {
    question: "How do I cancel?",
    answer:
      "You can cancel from your workspace billing settings at any time. Your plan stays active until the end of the paid period, and your documents remain yours.",
  },
];

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <span className="text-sm font-medium text-foreground">{value}</span>;
  }
  return value ? (
    <Check aria-label="Included" className="mx-auto size-5 text-gold-dark" />
  ) : (
    <Minus
      aria-label="Not included"
      className="mx-auto size-5 text-muted-foreground/40"
    />
  );
}

export default function PricingPage() {
  return (
    <>
      {/* Header + plan cards */}
      <section className="bg-navy pt-20 pb-40 text-white lg:pt-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold tracking-widest text-gold uppercase">
            Pricing
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/70">
            Start free and upgrade as your documentation library grows. No
            hidden fees, no per-document charges.
          </p>
        </div>
      </section>
      <section className="bg-secondary/50 pb-20 lg:pb-24">
        <div className="mx-auto -mt-28 max-w-6xl px-4 sm:px-6 lg:px-8">
          <PricingCards />
        </div>
      </section>

      {/* Feature comparison */}
      <section className="bg-background py-20 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Compare plans"
            title="Everything in every plan, side by side"
          />
          <div className="mt-12 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/60">
                  <th
                    scope="col"
                    className="px-6 py-4 text-sm font-semibold text-primary"
                  >
                    Features
                  </th>
                  {PLAN_ORDER.map((planId) => (
                    <th
                      key={planId}
                      scope="col"
                      className="px-6 py-4 text-center"
                    >
                      <span className="block text-sm font-semibold text-primary">
                        {PLANS[planId].name}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {PLANS[planId].monthlyPriceUsd === 0
                          ? "Free"
                          : `$${PLANS[planId].monthlyPriceUsd}/mo`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-border last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-6 py-4 text-sm font-medium text-foreground/80"
                    >
                      {row.label}
                    </th>
                    {PLAN_ORDER.map((planId) => (
                      <td key={planId} className="px-6 py-4 text-center">
                        <ComparisonCell
                          value={row.value(PLANS[planId].features)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Billing FAQ */}
      <section className="bg-secondary/50 py-20 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Billing FAQ"
            title="Questions about plans & billing"
          />
          <Accordion type="single" collapsible className="mt-12">
            {BILLING_FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="text-base font-semibold text-primary hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 text-white lg:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Start documenting today
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            The {PLANS.starter.name} plan is free — upload your first recording
            and see the documentation for yourself.
          </p>
          <div className="mt-9">
            <Button
              asChild
              size="lg"
              className="bg-gold px-8 font-semibold text-navy hover:bg-gold-dark"
            >
              <Link href="/sign-up">Create Your First SOP</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
