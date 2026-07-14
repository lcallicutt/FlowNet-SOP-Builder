"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { EditorApi } from "./document-editor";
import {
  CHECKLIST_CATEGORIES,
  type ChecklistCategory,
  type SopChecklistItem,
} from "./types";

/**
 * Master checklist editor grouped by category. Item order is a single flat
 * position list on the server; reorders move items within their group and
 * resend the full flattened order (groups in canonical category order).
 */
export function ChecklistTab({
  items,
  api,
}: {
  items: SopChecklistItem[];
  api: EditorApi;
}) {
  const { canEdit } = api;

  const grouped = React.useMemo(() => {
    const sorted = [...items].sort((a, b) => a.position - b.position);
    return CHECKLIST_CATEGORIES.map((cat) => ({
      ...cat,
      items: sorted.filter((i) => i.category === cat.value),
    }));
  }, [items]);

  function flatten(groups: { value: ChecklistCategory; items: SopChecklistItem[] }[]) {
    return groups.flatMap((g) => g.items.map((i) => i.id));
  }

  function moveWithinGroup(category: ChecklistCategory, index: number, direction: -1 | 1) {
    const nextGroups = grouped.map((g) => ({ value: g.value, items: [...g.items] }));
    const group = nextGroups.find((g) => g.value === category);
    if (!group) return;
    const target = index + direction;
    if (target < 0 || target >= group.items.length) return;
    [group.items[index], group.items[target]] = [group.items[target], group.items[index]];
    const orderedIds = flatten(nextGroups);
    api.mutate((p) => ({
      ...p,
      checklist: orderedIds
        .map((id, position) => {
          const item = p.checklist.find((i) => i.id === id);
          return item ? { ...item, position } : null;
        })
        .filter((i): i is SopChecklistItem => i !== null),
    }));
    void api.applyOp({ op: "reorder_checklist", orderedIds });
  }

  function updateItem(id: string, patch: Partial<SopChecklistItem>) {
    api.mutate((p) => ({
      ...p,
      checklist: p.checklist.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        This is the master checklist template — exports render it unchecked.
      </p>

      {items.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No checklist items yet.{canEdit ? " Add the first item below." : ""}
        </p>
      )}

      {grouped.map((group) =>
        group.items.length === 0 && !canEdit ? null : (
          <Card key={group.value} className="py-4">
            <CardHeader className="px-4 py-0">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 px-4">
              {group.items.map((item, index) => (
                <div key={item.id} className="group flex items-center gap-2">
                  <Checkbox
                    checked={item.isChecked}
                    disabled={!canEdit}
                    aria-label={item.text}
                    onCheckedChange={(checked) => {
                      const isChecked = checked === true;
                      updateItem(item.id, { isChecked });
                      void api.applyOp({
                        op: "update_checklist_item",
                        itemId: item.id,
                        isChecked,
                      });
                    }}
                  />
                  {canEdit ? (
                    <Input
                      value={item.text}
                      aria-label="Checklist item text"
                      className="h-8 flex-1 border-transparent shadow-none hover:border-input"
                      onChange={(e) => {
                        const text = e.target.value;
                        updateItem(item.id, { text });
                        api.queueOp(`checklist-text-${item.id}`, {
                          op: "update_checklist_item",
                          itemId: item.id,
                          text,
                        });
                      }}
                    />
                  ) : (
                    <span className="flex-1 py-1 text-sm">{item.text}</span>
                  )}
                  {canEdit && (
                    <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => moveWithinGroup(group.value, index, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground"
                        aria-label="Move down"
                        disabled={index === group.items.length - 1}
                        onClick={() => moveWithinGroup(group.value, index, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        aria-label="Delete item"
                        onClick={() =>
                          void api.applyStructuralOp({
                            op: "delete_checklist_item",
                            itemId: item.id,
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </span>
                  )}
                </div>
              ))}
              {canEdit && <AddItemRow category={group.value} api={api} />}
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}

function AddItemRow({ category, api }: { category: ChecklistCategory; api: EditorApi }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    const ok = await api.applyStructuralOp({
      op: "add_checklist_item",
      category,
      text: trimmed,
    });
    setBusy(false);
    if (ok) setText("");
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <Plus className="size-4 text-muted-foreground" />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          }
        }}
        placeholder="Add an item and press Enter…"
        className="h-8 flex-1 border-transparent shadow-none hover:border-input focus-visible:border-input"
        disabled={busy}
      />
      {text.trim() && (
        <Button size="sm" variant="outline" className="h-7" onClick={() => void add()} disabled={busy}>
          Add
        </Button>
      )}
    </div>
  );
}
