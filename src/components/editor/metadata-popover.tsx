"use client";

import * as React from "react";
import { format } from "date-fns";
import { Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DocumentPackage, DocumentStatus } from "./types";

export type MetadataPatch = {
  title?: string;
  department?: string | null;
  processCategory?: string | null;
  processOwner?: string | null;
  intendedAudience?: string | null;
  tags?: string[];
  reviewDate?: string | null;
  status?: DocumentStatus;
};

type Doc = DocumentPackage["document"];

/**
 * Popover editor for document metadata: department, owner, category,
 * audience, tags, and review date. Saves explicitly via PATCH metadata.
 */
export function MetadataPopover({
  document,
  canEdit,
  onSave,
}: {
  document: Doc;
  canEdit: boolean;
  onSave: (patch: MetadataPatch) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [department, setDepartment] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [reviewDate, setReviewDate] = React.useState("");

  // Seed the form from the document each time the popover opens.
  React.useEffect(() => {
    if (!open) return;
    setDepartment(document.department ?? "");
    setOwner(document.processOwner ?? "");
    setCategory(document.processCategory ?? "");
    setAudience(document.intendedAudience ?? "");
    setTags(document.tags);
    setTagInput("");
    setReviewDate(
      document.reviewDate ? format(new Date(document.reviewDate), "yyyy-MM-dd") : "",
    );
  }, [open, document]);

  function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    if (tags.includes(value)) {
      setTagInput("");
      return;
    }
    if (tags.length >= 20) {
      toast.error("A document can have at most 20 tags.");
      return;
    }
    setTags([...tags, value]);
    setTagInput("");
  }

  async function save() {
    setSaving(true);
    const ok = await onSave({
      department: department.trim() || null,
      processOwner: owner.trim() || null,
      processCategory: category.trim() || null,
      intendedAudience: audience.trim() || null,
      tags,
      reviewDate: reviewDate ? new Date(`${reviewDate}T00:00:00Z`).toISOString() : null,
    });
    setSaving(false);
    if (ok) {
      toast.success("Document details updated.");
      setOpen(false);
    }
  }

  const summary = [
    document.department,
    document.processOwner,
    document.processCategory,
  ].filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-muted-foreground">
          <Settings2 className="size-3.5" />
          {summary.length > 0 ? summary.join(" · ") : "Add details"}
          {document.reviewDate && (
            <span className="text-xs">
              · review {format(new Date(document.reviewDate), "MMM d, yyyy")}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-3" align="start">
        <p className="text-sm font-medium">Document details</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Operations"
              disabled={!canEdit}
            />
          </Field>
          <Field label="Process owner">
            <Input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. Jamie Chen"
              disabled={!canEdit}
            />
          </Field>
          <Field label="Category">
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Invoicing"
              disabled={!canEdit}
            />
          </Field>
          <Field label="Review date">
            <Input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
        <Field label="Intended audience">
          <Input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. New support agents"
            disabled={!canEdit}
          />
        </Field>
        <Field label="Tags">
          <div className="space-y-2">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        className="cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            )}
            {canEdit && (
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
            )}
          </div>
        </Field>
        {canEdit && (
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
