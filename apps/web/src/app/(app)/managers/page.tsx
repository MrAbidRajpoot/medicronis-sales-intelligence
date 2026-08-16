"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/toast-provider";

interface Manager {
  id: string;
  name: string;
  isActive: boolean;
  territoryCount: number;
  areaCount: number;
  regionCount: number;
  zoneCount: number;
  assignmentCount: number;
}

export default function ManagersPage() {
  const [items, setItems] = useState<Manager[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/managers?includeInactive=1");
      setItems(await res.json());
    } catch {
      toast.error("Failed to load managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(item: Manager) {
    setEditing(item);
    setName(item.name);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Manager name is required");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/managers/${editing.id}` : "/api/managers";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? "Manager updated" : "Manager created");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Manager) {
    if (!confirm(`Deactivate ${item.name}?`)) return;
    try {
      const res = await fetch(`/api/managers/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Manager deactivated");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleReactivate(item: Manager) {
    try {
      const res = await fetch(`/api/managers/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error("Reactivate failed");
      toast.success("Manager reactivated");
      load();
    } catch {
      toast.error("Reactivate failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Managers"
        description="Managers are assigned to territories, areas, regions, and zones"
        actions={
          <Button variant="accent" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Manager
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No managers"
          description="Add managers to assign them on territories, areas, regions, and zones."
          action={{ label: "Add Manager", onClick: openCreate }}
        />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="pl-9"
              aria-label="Search managers"
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching managers"
              description="Try a different search term, or clear the search to see all managers."
            />
          ) : (
            <div className="rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Territories</TableHead>
                    <TableHead className="text-right">Areas</TableHead>
                    <TableHead className="text-right">Regions</TableHead>
                    <TableHead className="text-right">Zones</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-60" : undefined}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.territoryCount}</TableCell>
                      <TableCell className="text-right">{item.areaCount}</TableCell>
                      <TableCell className="text-right">{item.regionCount}</TableCell>
                      <TableCell className="text-right">{item.zoneCount}</TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "success" : "secondary"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(item)}
                            disabled={item.name === "Vacant"}
                            title={item.name === "Vacant" ? "Vacant cannot be edited" : "Edit"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {item.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              disabled={item.name === "Vacant"}
                              title={item.name === "Vacant" ? "Vacant cannot be deactivated" : "Deactivate"}
                            >
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
        title={editing ? "Edit Manager" : "Add Manager"}
        description="Manager names must be unique and are assigned on geography masters"
        className="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manager-name">Name</Label>
            <Input
              id="manager-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Khan"
              required
              autoFocus
              disabled={editing?.name === "Vacant"}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={saving || editing?.name === "Vacant"}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
