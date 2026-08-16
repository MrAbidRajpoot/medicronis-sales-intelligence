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

const VACANT = "Vacant";

interface GeoRef {
  id: string;
  name: string;
}

interface GeoOption extends GeoRef {
  managerId: string;
  managerName: string | null;
}

interface Manager {
  id: string;
  name: string;
  isActive: boolean;
  territories: GeoRef[];
  areas: GeoRef[];
  regions: GeoRef[];
  zones: GeoRef[];
  territoryCount: number;
  areaCount: number;
  regionCount: number;
  zoneCount: number;
  assignmentCount: number;
}

type GeoKey = "territories" | "areas" | "regions" | "zones";

const GEO_GROUPS: { key: GeoKey; label: string; apiPath: string; payloadKey: string }[] = [
  { key: "territories", label: "Territories", apiPath: "/api/territories", payloadKey: "territoryIds" },
  { key: "areas", label: "Areas", apiPath: "/api/areas", payloadKey: "areaIds" },
  { key: "regions", label: "Regions", apiPath: "/api/regions", payloadKey: "regionIds" },
  { key: "zones", label: "Zones", apiPath: "/api/zones", payloadKey: "zoneIds" },
];

type GeoOptions = Record<GeoKey, GeoOption[]>;
type Selection = Record<GeoKey, string[]>;

const emptyOptions: GeoOptions = { territories: [], areas: [], regions: [], zones: [] };
const emptySelection: Selection = { territories: [], areas: [], regions: [], zones: [] };

export default function ManagersPage() {
  const [items, setItems] = useState<Manager[]>([]);
  const [geoOptions, setGeoOptions] = useState<GeoOptions>(emptyOptions);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);
  const [name, setName] = useState("");
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [assignFilter, setAssignFilter] = useState("");

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

  const loadGeo = useCallback(async () => {
    try {
      const responses = await Promise.all(GEO_GROUPS.map((g) => fetch(g.apiPath)));
      const payloads = await Promise.all(responses.map((r) => r.json()));
      setGeoOptions({
        territories: payloads[0],
        areas: payloads[1],
        regions: payloads[2],
        zones: payloads[3],
      });
    } catch {
      toast.error("Failed to load geography options");
    }
  }, []);

  useEffect(() => {
    load();
    loadGeo();
  }, [load, loadGeo]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setName("");
    setSelection(emptySelection);
    setAssignFilter("");
    setDialogOpen(true);
  }

  function openEdit(item: Manager) {
    setEditing(item);
    setName(item.name);
    setSelection({
      territories: item.territories.map((t) => t.id),
      areas: item.areas.map((a) => a.id),
      regions: item.regions.map((r) => r.id),
      zones: item.zones.map((z) => z.id),
    });
    setAssignFilter("");
    setDialogOpen(true);
  }

  function toggleAssignment(key: GeoKey, id: string) {
    setSelection((prev) => {
      const current = prev[key];
      return {
        ...prev,
        [key]: current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
      };
    });
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
        body: JSON.stringify({
          name: name.trim(),
          territoryIds: selection.territories,
          areaIds: selection.areas,
          regionIds: selection.regions,
          zoneIds: selection.zones,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? "Manager updated" : "Manager created");
      setDialogOpen(false);
      load();
      loadGeo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Manager) {
    if (
      !confirm(
        `Deactivate ${item.name}? Their ${item.assignmentCount} assignment(s) will fall back to Vacant.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/managers/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      toast.success("Manager deactivated");
      load();
      loadGeo();
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
        description="Assign each manager the territories, areas, regions, and zones they own"
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
          description="Add a manager, then assign their territories, areas, regions, and zones."
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
                            disabled={item.name === VACANT}
                            title={item.name === VACANT ? "Vacant cannot be edited" : "Edit"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {item.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              disabled={item.name === VACANT}
                              title={item.name === VACANT ? "Vacant cannot be deactivated" : "Deactivate"}
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
        description="Select the geography this manager owns. Anything you unselect falls back to Vacant."
        className="max-w-3xl"
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
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Assignments</Label>
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={assignFilter}
                  onChange={(e) => setAssignFilter(e.target.value)}
                  placeholder="Filter lists…"
                  className="h-9 pl-9"
                  aria-label="Filter assignment lists"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {GEO_GROUPS.map((group) => {
                const q = assignFilter.trim().toLowerCase();
                const options = geoOptions[group.key];
                const visible = q
                  ? options.filter((o) => o.name.toLowerCase().includes(q))
                  : options;
                const selectedCount = selection[group.key].length;

                return (
                  <div key={group.key} className="rounded-md border">
                    <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                      <span className="text-sm font-medium">{group.label}</span>
                      <Badge variant="secondary">{selectedCount} selected</Badge>
                    </div>
                    <div className="max-h-48 space-y-1 overflow-y-auto p-2">
                      {visible.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-muted-foreground">
                          No {group.label.toLowerCase()} found.
                        </p>
                      ) : (
                        visible.map((option) => {
                          const checked = selection[group.key].includes(option.id);
                          const ownedByOther =
                            !checked &&
                            option.managerName !== null &&
                            option.managerName !== VACANT &&
                            option.managerId !== editing?.id;

                          return (
                            <label
                              key={option.id}
                              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={checked}
                                onChange={() => toggleAssignment(group.key, option.id)}
                              />
                              <span className="flex-1 truncate">{option.name}</span>
                              {ownedByOther && (
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {option.managerName}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecting an entry that belongs to another manager reassigns it to this manager.
            </p>
          </div>

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
