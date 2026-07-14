"use client";

import * as React from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type NavLink = { href: string; label: string };

export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-white/10 bg-navy shadow-lg">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-4">
              <SignedOut>
                <Button
                  asChild
                  variant="ghost"
                  className="justify-start text-white/80 hover:bg-white/10 hover:text-white"
                >
                  <Link href="/sign-in" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-gold font-semibold text-navy hover:bg-gold-dark"
                >
                  <Link href="/sign-up" onClick={() => setOpen(false)}>
                    Create Your First SOP
                  </Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button
                  asChild
                  className="bg-gold font-semibold text-navy hover:bg-gold-dark"
                >
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    Dashboard
                  </Link>
                </Button>
              </SignedIn>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
