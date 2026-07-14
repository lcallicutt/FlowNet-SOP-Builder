import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Check,
  FileCheck,
  FileText,
  GraduationCap,
  HeartHandshake,
  Library,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  Package,
  PenLine,
  Rocket,
  ScanText,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  Video,
  Workflow,
  Wrench,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PLANS } from "@/lib/plans";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { SectionHeading } from "@/components/marketing/section-heading";
import { SopPreview } from "@/components/marketing/sop-preview";

const PROBLEMS = [
  {
    icon: Video,
    title: "Knowledge locked in recordings",
    description:
      "Loom walkthroughs and screen recordings pile up, but nobody rewatches a 20-minute video to find one step.",
  },
  {
    icon: MessagesSquare,
    title: "The same questions, again and again",
    description:
      "Your most experienced people spend hours re-explaining processes instead of doing their actual work.",
  },
  {
    icon: LifeBuoy,
    title: "One resignation from chaos",
    description:
      "When the person who knows the process leaves, the process leaves with them. Nothing is written down.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: Upload,
    title: "Upload a recording",
    description:
      "Drop in a Loom video, screen recording, or audio file. Paste a Loom share link if you prefer.",
  },
  {
    icon: ScanText,
    title: "AI transcribes it",
    description:
      "Every word and on-screen action is captured as an accurate, timestamped transcript.",
  },
  {
    icon: Workflow,
    title: "AI extracts the process",
    description:
      "Steps, decision points, risks, and QC checks are identified and structured into documentation.",
  },
  {
    icon: PenLine,
    title: "Review, edit & share",
    description:
      "Refine any detail in the editor, then export to PDF or DOCX and share with your team.",
  },
];

const DELIVERABLES = [
  {
    icon: FileText,
    title: "Standard Operating Procedure",
    description: "Numbered, step-by-step procedure with context and outcomes.",
  },
  {
    icon: ListChecks,
    title: "Step-by-step checklist",
    description: "A tick-through list for running the process every time.",
  },
  {
    icon: BookOpen,
    title: "Quick-reference guide",
    description: "The condensed version for people who already know the job.",
  },
  {
    icon: GraduationCap,
    title: "Training documentation",
    description: "Onboarding-ready material written for someone brand new.",
  },
  {
    icon: ShieldCheck,
    title: "QC checkpoints",
    description: "Verification points that catch mistakes before they ship.",
  },
  {
    icon: Wrench,
    title: "Troubleshooting guidance",
    description: "What to do when the process doesn't go according to plan.",
  },
  {
    icon: Package,
    title: "Tools & prerequisites",
    description: "Everything needed before the first step: access, tools, inputs.",
  },
  {
    icon: Users,
    title: "Roles & responsibilities",
    description: "Who owns each step, who approves, and who gets notified.",
  },
];

const USE_CASES = [
  {
    icon: UserPlus,
    title: "Employee onboarding",
    description:
      "Turn your best employee's walkthrough into training docs that get new hires productive in days, not months.",
  },
  {
    icon: Briefcase,
    title: "Agency client operations",
    description:
      "Document delivery processes once and run every client engagement with the same repeatable playbook.",
  },
  {
    icon: HeartHandshake,
    title: "Churches & nonprofits",
    description:
      "Capture how volunteers and staff run services, events, and programs so knowledge survives every transition.",
  },
  {
    icon: Users,
    title: "HR & training teams",
    description:
      "Build a consistent training library from subject-matter-expert recordings without writing a word yourself.",
  },
  {
    icon: BadgeCheck,
    title: "QA teams",
    description:
      "Convert review sessions into QC checklists and audit-ready procedures your whole team follows.",
  },
  {
    icon: Lightbulb,
    title: "Consultants",
    description:
      "Productize your expertise: record it once, deliver polished, branded process documentation to every client.",
  },
];

const BENEFITS = [
  {
    icon: MessagesSquare,
    title: "Stop re-explaining processes",
    description:
      "Answer once, on video. The documentation handles every question after that.",
  },
  {
    icon: Rocket,
    title: "Onboard faster",
    description:
      "New team members follow clear, step-by-step guides instead of shadowing for weeks.",
  },
  {
    icon: LifeBuoy,
    title: "Survive employee turnover",
    description:
      "Institutional knowledge lives in your process library, not in one person's head.",
  },
  {
    icon: BadgeCheck,
    title: "Consistent quality",
    description:
      "Everyone runs the process the same way, with QC checkpoints built into every procedure.",
  },
  {
    icon: Library,
    title: "Searchable process library",
    description:
      "Every SOP, checklist, and guide in one organized workspace your team can actually find.",
  },
  {
    icon: FileCheck,
    title: "Audit-ready documentation",
    description:
      "Version history and approval workflows keep documentation current and compliant.",
  },
];

const FAQS = [
  {
    question: "What video formats are supported?",
    answer:
      "You can upload MP4, MOV, WebM, and M4V video files, as well as MP3, WAV, and M4A audio files. If you can record it, we can almost certainly process it.",
  },
  {
    question: "Can I import Loom links?",
    answer:
      "Yes — paste a Loom share URL and we'll pull the recording in for you. Direct file upload always works; Loom import depends on the video's sharing permissions, so make sure the link is viewable.",
  },
  {
    question: "Can I edit the AI output?",
    answer:
      "Absolutely. Every generated document is fully editable before you export or share it. Reorder steps, rewrite descriptions, add screenshots of context, or delete anything that doesn't fit.",
  },
  {
    question: "How is my data secured?",
    answer:
      "Your recordings and documents are isolated per workspace, files are served through signed URLs, and everything is encrypted in storage. Only members of your workspace can access your content.",
  },
  {
    question: "What export formats are available?",
    answer:
      "You can export documents as PDF, DOCX, Markdown, or plain text. PDF export is available on every plan, including the free Starter plan.",
  },
  {
    question: "Do unused transcription minutes roll over?",
    answer:
      "No — your transcription allowance resets at the start of each billing cycle. If you regularly run out, upgrading to a higher plan gives you a larger monthly allowance.",
  },
  {
    question: "How accurate is the generated documentation?",
    answer:
      "The AI captures the steps, decisions, and checks it observes in your recording with high fidelity — and because everything is editable, you always review and approve the final document before it goes to your team.",
  },
  {
    question: "Can my whole team use it?",
    answer: `Yes. ${PLANS.professional.name} supports up to ${PLANS.professional.features.maxWorkspaceMembers} workspace members and ${PLANS.business.name} supports up to ${PLANS.business.features.maxWorkspaceMembers}, with shared links, version history, and approval workflows for team review.`,
  },
];

export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
          <div>
            <p className="text-sm font-semibold tracking-widest text-gold uppercase">
              AI-powered process documentation
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
              Turn Process Videos Into Clear, Repeatable SOPs.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/70">
              Upload a Loom video or screen recording. FlowNet SOP Builder
              converts it into an editable SOP, checklist, training guide, and
              process documentation.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-gold px-7 font-semibold text-navy hover:bg-gold-dark"
              >
                <Link href="/sign-up">Create Your First SOP</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="#how-it-works">
                  See How It Works
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-white/50">
              Free plan included. No credit card required.
            </p>
          </div>
          <SopPreview />
        </div>
      </section>

      {/* 2. Problem statement */}
      <section className="bg-background py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="The problem"
            title="Your best processes are trapped in videos"
            description="Every business runs on institutional knowledge — but most of it lives in Loom recordings, screen shares, and one employee's memory. That knowledge is invisible, unsearchable, and one departure away from being lost."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3 lg:gap-8">
            {PROBLEMS.map((problem) => (
              <Card key={problem.title} className="border-border">
                <CardContent>
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary">
                    <problem.icon className="size-5 text-gold" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-primary">
                    {problem.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {problem.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section
        id="how-it-works"
        className="scroll-mt-16 bg-secondary/50 py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="From recording to documentation in minutes"
            description="No templates to fill in, no blank pages to stare at. Record how the work actually gets done and let the AI do the writing."
          />
          <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {HOW_IT_WORKS.map((step, index) => (
              <li
                key={step.title}
                className="relative rounded-xl border border-border bg-card p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary">
                    <step.icon className="size-5 text-gold" />
                  </div>
                  <span className="text-4xl font-bold text-border">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-primary">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. Generated deliverables */}
      <section className="bg-background py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="What you get"
            title="One recording. A complete documentation set."
            description="Each upload can generate the full family of operational documents — structured, consistent, and ready to share."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {DELIVERABLES.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <item.icon className="size-6 text-gold-dark" />
                <h3 className="mt-4 font-semibold text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Use cases */}
      <section
        id="use-cases"
        className="scroll-mt-16 bg-secondary/50 py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Use cases"
            title="Built for teams that run on process"
            description="If your organization depends on people doing things the right way, FlowNet SOP Builder keeps everyone on the same page."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {USE_CASES.map((useCase) => (
              <Card key={useCase.title} className="border-border">
                <CardContent>
                  <div className="flex size-11 items-center justify-center rounded-lg bg-gold/15">
                    <useCase.icon className="size-5 text-gold-dark" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-primary">
                    {useCase.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {useCase.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Benefits */}
      <section className="bg-background py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Why it matters"
            title="Documentation that pays for itself"
            description="Clear processes compound: every documented workflow saves time, reduces errors, and protects your business."
          />
          <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <benefit.icon className="size-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">
                    {benefit.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Pricing */}
      <section className="bg-secondary/50 py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple plans that grow with your team"
            description="Start free, upgrade when your documentation library does. Every plan includes AI-powered SOP generation."
          />
          <div className="mt-16">
            <PricingCards />
          </div>
          <p className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              See full pricing and plan comparison
              <ArrowRight className="size-4" />
            </Link>
          </p>
        </div>
      </section>

      {/* 8. FAQ */}
      <section id="faq" className="scroll-mt-16 bg-background py-20 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
          />
          <Accordion type="single" collapsible className="mt-12">
            {FAQS.map((faq) => (
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

      {/* 9. Final CTA */}
      <section className="bg-navy py-20 text-white lg:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Your next SOP is already recorded.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            Upload the video and have professional process documentation in
            minutes — free to start.
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
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-white/50">
            <Check className="size-4 text-gold" />
            {PLANS.starter.features.transcriptionMinutesPerMonth} free
            transcription minutes every month on the{" "}
            {PLANS.starter.name} plan
          </p>
        </div>
      </section>
    </>
  );
}
