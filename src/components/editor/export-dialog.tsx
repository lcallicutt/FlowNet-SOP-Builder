"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { readApiError } from "./api";
import type { EditorFeatures } from "./types";

type ExportFormat = "pdf" | "docx" | "markdown" | "text";
type ExportSelection =
  | "sop"
  | "checklist"
  | "quick_guide"
  | "training_guide"
  | "full_package";

const EXTENSIONS: Record<ExportFormat, string> = {
  pdf: "pdf",
  docx: "docx",
  markdown: "md",
  text: "txt",
};

export function ExportDialog({
  endpoint,
  sopNumber,
  features,
  trigger,
}: {
  endpoint: string;
  sopNumber: string;
  features: EditorFeatures;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<ExportFormat>("pdf");
  const [selection, setSelection] = React.useState<ExportSelection>("sop");
  const [busy, setBusy] = React.useState(false);

  const formatOptions: {
    value: ExportFormat;
    label: string;
    disabled?: boolean;
    hint?: string;
  }[] = [
    { value: "pdf", label: "PDF" },
    {
      value: "docx",
      label: "DOCX",
      disabled: !features.docxExport,
      hint: features.docxExport ? undefined : "Upgrade to Professional for DOCX export",
    },
    { value: "markdown", label: "Markdown" },
    { value: "text", label: "Plain text" },
  ];

  const gatedSelectionHint = features.allDocumentTypes
    ? undefined
    : "Upgrade to Professional for all document types";
  const selectionOptions: {
    value: ExportSelection;
    label: string;
    disabled?: boolean;
    hint?: string;
  }[] = [
    { value: "sop", label: "SOP only" },
    {
      value: "checklist",
      label: "Checklist only",
      disabled: !features.allDocumentTypes,
      hint: gatedSelectionHint,
    },
    {
      value: "quick_guide",
      label: "Quick guide only",
      disabled: !features.allDocumentTypes,
      hint: gatedSelectionHint,
    },
    {
      value: "training_guide",
      label: "Training guide only",
      disabled: !features.allDocumentTypes,
      hint: gatedSelectionHint,
    },
    {
      value: "full_package",
      label: "Complete package",
      disabled: !features.allDocumentTypes,
      hint: gatedSelectionHint,
    },
  ];

  async function runExport() {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, selection }),
      });
      if (!res.ok) {
        const err = await readApiError(res, "Export failed. Try again.");
        toast.error(err.message);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName =
        match?.[1] ?? `${sopNumber.toLowerCase()}-${selection}.${EXTENSIONS[format]}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${fileName}.`);
      setOpen(false);
    } catch {
      toast.error("Export failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export document</DialogTitle>
          <DialogDescription>
            Choose a format and which parts of the package to include.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            legend="Format"
            name="export-format"
            options={formatOptions}
            value={format}
            onChange={(v) => setFormat(v)}
          />
          <RadioGroup
            legend="Selection"
            name="export-selection"
            options={selectionOptions}
            value={selection}
            onChange={(v) => setSelection(v)}
          />
        </div>

        <DialogFooter>
          <Button onClick={() => void runExport()} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Exporting…
              </>
            ) : (
              <>
                <Download className="size-4" /> Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string; disabled?: boolean; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <Label asChild>
        <legend className="text-sm font-medium">{legend}</legend>
      </Label>
      <div className="space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              option.disabled
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-muted/50",
              value === option.value && "border-ring bg-muted/40",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="accent-primary"
            />
            <span className="flex-1">{option.label}</span>
            {option.hint && (
              <span className="text-xs text-muted-foreground">{option.hint}</span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
