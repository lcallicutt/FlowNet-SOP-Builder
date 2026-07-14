import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/marketing/mobile-nav";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight"
          aria-label="FlowNet SOP Builder home"
        >
          <span className="text-white">FlowNet</span>{" "}
          <span className="text-gold">SOP Builder</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <SignedOut>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Button
              asChild
              className="bg-gold font-semibold text-navy hover:bg-gold-dark"
            >
              <Link href="/sign-up">Create Your First SOP</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button
              asChild
              className="bg-gold font-semibold text-navy hover:bg-gold-dark"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </SignedIn>
        </div>

        <MobileNav links={NAV_LINKS} />
      </div>
    </header>
  );
}
