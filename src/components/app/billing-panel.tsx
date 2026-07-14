"use client";

import * as React from "react";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/components/app/api";

type UsageProps = {
  period: string;
  usedMinutes: number;
  allowanceMinutes: number;
  remainingMinutes: number;
  percentUsed: number;
};

export function BillingPanel({
  workspaceId,
  currentPlan,
  usage,
  upgraded,
}: {
  workspaceId: string;
  currentPlan: PlanId;
  usage: UsageProps;
  upgraded: boolean;
}) {
  const [busyPlan, setBusyPlan] = React.useState<PlanId | null>(null);
  const [portalBusy, setPortalBusy] = React.useState(false);
  const plan = PLANS[currentPlan];
  const currentRank = PLAN_ORDER.indexOf(currentPlan);

  React.useEffect(() => {
    if (upgraded) {
      toast.success("Your plan has been upgraded. Welcome to the new tier!");
    }
  }, [upgraded]);

  async function startCheckout(target: PlanId) {
    if (target === "starter") return;
    setBusyPlan(target);
    try {
      const body = await apiFetch<{ url: string }>(
        `/api/workspaces/${workspaceId}/billing/checkout`,
        {
          method: "POST",
          body: JSON.stringify({ plan: target }),
        },
      );
      window.location.href = body.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start checkout.",
      );
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    try {
      const body = await apiFetch<{ url: string }>(
        `/api/workspaces/${workspaceId}/billing/portal`,
        { method: "POST" },
      );
      window.location.href = body.url;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not open the billing portal.",
      );
      setPortalBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              Current plan
              <Badge className="bg-gold text-navy">{plan.name}</Badge>
            </CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => void openPortal()}
            disabled={portalBusy}
          >
            {portalBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}
            Manage billing
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Transcription minutes ({usage.period})
            </span>
            <span className="tabular-nums">
              {Math.round(usage.usedMinutes)} / {usage.allowanceMinutes} min
            </span>
          </div>
          <Progress value={usage.percentUsed} />
          <p className="text-xs text-muted-foreground">
            {Math.floor(usage.remainingMinutes)} minutes remaining this month.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const def = PLANS[planId];
          const isCurrent = planId === currentPlan;
          const isUpgrade = PLAN_ORDER.indexOf(planId) > currentRank;
          return (
            <Card
              key={planId}
              className={cn(
                "flex flex-col",
                isCurrent && "border-gold ring-1 ring-gold/40",
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {def.name}
                  {isCurrent ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : null}
                </CardTitle>
                <p className="text-2xl font-semibold">
                  ${def.monthlyPriceUsd}
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2 text-sm">
                  {def.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-gold-dark" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-4">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Your plan
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full bg-gold text-navy hover:bg-gold-dark"
                    disabled={busyPlan !== null}
                    onClick={() => void startCheckout(planId)}
                  >
                    {busyPlan === planId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Upgrade to {def.name}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={portalBusy}
                    onClick={() => void openPortal()}
                  >
                    Downgrade via billing portal
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
