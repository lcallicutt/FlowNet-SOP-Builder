import Link from "next/link";
import { Check } from "lucide-react";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const POPULAR_PLAN_ID = "professional";

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
      {PLAN_ORDER.map((planId) => {
        const plan = PLANS[planId];
        const isPopular = plan.id === POPULAR_PLAN_ID;

        return (
          <Card
            key={plan.id}
            className={cn(
              "relative flex flex-col",
              isPopular
                ? "border-gold shadow-lg ring-1 ring-gold lg:-my-3"
                : "border-border",
            )}
          >
            {isPopular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold px-3 font-semibold text-navy hover:bg-gold">
                Most popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-xl font-bold text-primary">
                {plan.name}
              </CardTitle>
              <CardDescription className="min-h-10 leading-relaxed">
                {plan.description}
              </CardDescription>
              <div className="pt-4">
                {plan.monthlyPriceUsd === 0 ? (
                  <span className="text-4xl font-bold tracking-tight text-primary">
                    Free
                  </span>
                ) : (
                  <>
                    <span className="text-4xl font-bold tracking-tight text-primary">
                      ${plan.monthlyPriceUsd}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / month
                    </span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                    <span className="text-sm leading-relaxed text-foreground/80">
                      {highlight}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                asChild
                className={cn(
                  "w-full font-semibold",
                  isPopular
                    ? "bg-gold text-navy hover:bg-gold-dark"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <Link href="/sign-up">
                  {plan.monthlyPriceUsd === 0
                    ? "Start free"
                    : `Start with ${plan.name}`}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
