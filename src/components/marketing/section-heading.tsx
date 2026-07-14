import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold tracking-widest uppercase",
          dark ? "text-gold" : "text-gold-dark",
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl",
          dark ? "text-white" : "text-primary",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-lg leading-relaxed text-pretty",
            dark ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
