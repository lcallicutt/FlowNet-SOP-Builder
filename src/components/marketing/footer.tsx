import Link from "next/link";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] =
  [
    {
      heading: "Product",
      links: [
        { label: "How it works", href: "/#how-it-works" },
        { label: "Use cases", href: "/#use-cases" },
        { label: "Pricing", href: "/pricing" },
        { label: "FAQ", href: "/#faq" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Contact", href: "#" },
        { label: "Blog", href: "#" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy policy", href: "#" },
        { label: "Terms of service", href: "#" },
        { label: "Security", href: "#" },
      ],
    },
  ];

export function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="text-lg font-semibold tracking-tight">
              <span className="text-white">FlowNet</span>{" "}
              <span className="text-gold">SOP Builder</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Turn process videos into clear, repeatable SOPs, checklists, and
              training documentation your whole team can follow.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-sm font-semibold tracking-wide text-gold uppercase">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="text-sm text-white/50">
            &copy; {new Date().getFullYear()} FlowNet Automation. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
