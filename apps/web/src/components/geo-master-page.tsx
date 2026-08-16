"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/toast-provider";

interface GeoItem {
  id: string;
  name: string;
  isActive: boolean;
  managerId: string;
  managerName: string | null;
  distributorCount: number;
}

export function GeoMasterPage({
  title,
  description,
  apiPath,
  icon: Icon,
  singular,
}: {
  title: string;
  description: string;
  apiPath: string;
  icon: LucideIcon;
  singular: string;
}) {
  const [items, setItems] = useState<GeoItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GeoItem | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiPath}?includeInactive=1`);
      setItems(await res.json());
    } catch {
      toast.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [apiPath, title]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.name, item.managerName].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(item: GeoItem) {
    setEditing(item);
    setName(item.name);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(`${singular} name is required`);
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `${apiPath}/${editing.id}` : apiPath;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? `${singular} updated` : `${singular} created`);
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: GeoItem) {
    if (!confirm(`Deactivate ${item.name}?`)) return;
    try {
      const res = await fetch(`${apiPath}/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`${singular} deactivated`);
      load();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function handleReactivate(item: GeoItem) {
    try {
      const res = await fetch(`${apiPath}/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error("Reactivate failed");
      toast.success(`${singular} reactivated`);
      load();
    } catch {
      toast.error("Reactivate failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="accent" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add {singular}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={`No ${title.toLowerCase()}`}
          description={`Add your first ${singular.toLowerCase()} for distributor master data.`}
          action={{ label: `Add ${singular}`, onClick: openCreate }}
        />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or manager…"
              className="pl-9"
              aria-label={`Search ${title.toLowerCase()}`}
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title={`No matching ${title.toLowerCase()}`}
              description={`Try a different search term, or clear the search to see all ${title.toLowerCase()}.`}
            />
          ) : (
            <div className="rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Distributors</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.managerName ?? "Vacant"}</TableCell>
                      <TableCell className="text-right">{item.distributorCount}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "success" : "secondary"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {item.isActive ? (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(item)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => handleReactivate(item)}>
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? `Edit ${singular}` : `Add ${singular}`}
        description={`${singular} names must be unique. Managers are assigned from the Managers page.`}
        className="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="geo-name">Name</Label>
            <Input
              id="geo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. Sample ${singular}`}
              required
              autoFocus
            />
          </div>
          {editing ? (
            <p className="text-xs text-muted-foreground">
              Manager: <span className="font-medium text-foreground">{editing.managerName ?? "Vacant"}</span>{" "}
              — change it from the{" "}
              <Link href="/managers" className="text-primary underline">
                Managers
              </Link>{" "}
              page.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              New {singular.toLowerCase()} starts as Vacant. Assign a manager from the{" "}
              <Link href="/managers" className="text-primary underline">
                Managers
              </Link>{" "}
              page.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
