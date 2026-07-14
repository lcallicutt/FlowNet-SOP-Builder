"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Simple add/edit/remove editor for a list of strings (tools, warnings…). */
export function StringListEditor({
  label,
  items,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) =>
                onChange(items.map((v, i) => (i === index ? e.target.value : v)))
              }
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${label} item`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">None yet.</p>
        )}
        {!disabled && (
          <Button variant="outline" size="sm" onClick={() => onChange([...items, ""])}>
            <Plus className="size-4" /> Add
          </Button>
        )}
      </div>
    </div>
  );
}
