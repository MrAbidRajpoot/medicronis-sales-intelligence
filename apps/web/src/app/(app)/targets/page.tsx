"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Target, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/toast-provider";

interface GeoOption {
  id: string;
  name: string;
  managerId: string;
  managerName: string | null;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
}

interface ProductTarget {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  year: number;
  month: number;
  territoryId: string;
  territoryName: string;
  areaId: string;
  areaName: string;
  regionId: string;
  regionName: string;
  zoneId: string;
  zoneName: string;
  managerId: string;
  managerName: string;
  quantity: number;
  isActive: boolean;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function monthLabel(month: number) {
  return MONTHS.find((m) => m.value === month)?.label ?? String(month);
}

const currentYear = new Date().getFullYear();

const emptyForm = {
  productId: "",
  year: String(currentYear),
  month: String(new Date().getMonth() + 1),
  territoryId: "",
  areaId: "",
  regionId: "",
  zoneId: "",
  quantity: "",
};

export default function TargetsPage() {
  const [items, setItems] = useState<ProductTarget[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [territories, setTerritories] = useState<GeoOption[]>([]);
  const [areas, setAreas] = useState<GeoOption[]>([]);
  const [regions, setRegions] = useState<GeoOption[]>([]);
  const [zones, setZones] = useState<GeoOption[]>([]);
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterMonth, setFilterMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductTarget | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadOptions = useCallback(async () => {
    try {
      const [pRes, tRes, aRes, rRes, zRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/territories"),
        fetch("/api/areas"),
        fetch("/api/regions"),
        fetch("/api/zones"),
      ]);
      setProducts(await pRes.json());
      setTerritories(await tRes.json());
      setAreas(await aRes.json());
      setRegions(await rRes.json());
      setZones(await zRes.json());
    } catch {
      toast.error("Failed to load form options");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ includeInactive: "1" });
      if (filterYear) params.set("year", filterYear);
      if (filterMonth) params.set("month", filterMonth);
      const res = await fetch(`/api/targets?${params}`);
      if (!res.ok) throw new Error("Failed to load targets");
      setItems(await res.json());
    } catch {
      toast.error("Failed to load targets");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    load();
  }, [load]);

  const matchedManager = useMemo(() => {
    if (!form.territoryId || !form.areaId || !form.regionId || !form.zoneId) {
      return { status: "incomplete" as const };
    }
    const territory = territories.find((t) => t.id === form.territoryId);
    const area = areas.find((a) => a.id === form.areaId);
    const region = regions.find((r) => r.id === form.regionId);
    const zone = zones.find((z) => z.id === form.zoneId);
    if (!territory || !area || !region || !zone) {
      return { status: "incomplete" as const };
    }

    const ids = [territory.managerId, area.managerId, region.managerId, zone.managerId];
    if (new Set(ids).size !== 1) {
      return { status: "mismatch" as const };
    }

    return {
      status: "matched" as const,
      id: territory.managerId,
      name: territory.managerName ?? "Unknown",
    };
  }, [form.territoryId, form.areaId, form.regionId, form.zoneId, territories, areas, regions, zones]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [
        item.productName,
        item.productSku,
        item.territoryName,
        item.areaName,
        item.regionName,
        item.zoneName,
        item.managerName,
        monthLabel(item.month),
        String(item.year),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: ProductTarget) {
    setEditing(item);
    setForm({
      productId: item.productId,
      year: String(item.year),
      month: String(item.month),
      territoryId: item.territoryId,
      areaId: item.areaId,
      regionId: item.regionId,
      zoneId: item.zoneId,
      quantity: String(item.quantity),
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productId) {
      toast.error("Product is required");
      return;
    }
    if (!form.territoryId || !form.areaId || !form.regionId || !form.zoneId) {
      toast.error("Territory, area, region, and zone are required");
      return;
    }
    if (matchedManager.status !== "matched") {
      toast.error("Manager must match territory, area, region, and zone");
      return;
    }
    if (form.quantity === "" || Number(form.quantity) < 0 || Number.isNaN(Number(form.quantity))) {
      toast.error("Enter a valid non-negative quantity");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        productId: form.productId,
        year: Number(form.year),
        month: Number(form.month),
        territoryId: form.territoryId,
        areaId: form.areaId,
        regionId: form.regionId,
        zoneId: form.zoneId,
        managerId: matchedManager.id,
        quantity: Number(form.quantity),
      };
      const url = editing ? `/api/targets/${editing.id}` : "/api/targets";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? "Target updated" : "Target created");
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ProductTarget) {
    if (!confirm(`Deactivate target for ${item.productName} (${monthLabel(item.month)} ${item.year})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/targets/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Target deactivated");
      load();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function handleReactivate(item: ProductTarget) {
    try {
      const res = await fetch(`/api/targets/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reactivate failed");
      toast.success("Target reactivated");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reactivate failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Targets"
        description="Assign monthly quantity targets by product, geography, and matched manager"
        actions={
          <Button variant="accent" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Target
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, geo, manager…"
                className="pl-9"
                aria-label="Search targets"
              />
            </div>
            <div className="w-full sm:w-32">
              <Label htmlFor="filter-year" className="mb-1.5 block text-xs text-muted-foreground">
                Year
              </Label>
              <Input
                id="filter-year"
                type="number"
                min={2000}
                max={2100}
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-44">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Month</Label>
              <Select value={filterMonth || "all"} onValueChange={(v) => setFilterMonth(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No targets yet"
              description="Add monthly product targets for each territory, area, region, zone, and matched manager."
              action={{ label: "Add Target", onClick: openCreate }}
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching targets"
              description="Try a different search or clear the year/month filters."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">{item.productSku}</div>
                      </TableCell>
                      <TableCell>
                        {monthLabel(item.month)} {item.year}
                      </TableCell>
                      <TableCell>{item.territoryName}</TableCell>
                      <TableCell>{item.areaName}</TableCell>
                      <TableCell>{item.regionName}</TableCell>
                      <TableCell>{item.zoneName}</TableCell>
                      <TableCell>{item.managerName}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity.toLocaleString()}</TableCell>
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
        title={editing ? "Edit Target" : "Add Target"}
        description="Manager is set automatically only when territory, area, region, and zone share the same manager"
        className="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Product</Label>
              <Select
                value={form.productId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, productId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-year">Year</Label>
              <Input
                id="target-year"
                type="number"
                min={2000}
                max={2100}
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Month</Label>
              <Select
                value={form.month}
                onValueChange={(v) => setForm((f) => ({ ...f, month: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Territory</Label>
              <Select
                value={form.territoryId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, territoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select territory" />
                </SelectTrigger>
                <SelectContent>
                  {territories.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Area</Label>
              <Select
                value={form.areaId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, areaId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={form.regionId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, regionId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Zone</Label>
              <Select
                value={form.zoneId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, zoneId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Manager</Label>
              <Input
                value={
                  matchedManager.status === "matched"
                    ? matchedManager.name
                    : matchedManager.status === "mismatch"
                      ? "No matching manager — assign the same manager to all four geos"
                      : "Select territory, area, region, and zone"
                }
                readOnly
                disabled
                className={
                  matchedManager.status === "mismatch"
                    ? "border-destructive text-destructive"
                    : matchedManager.status === "matched"
                      ? undefined
                      : "text-muted-foreground"
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="target-qty">Target quantity</Label>
              <Input
                id="target-qty"
                type="number"
                min={0}
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="e.g. 1000"
                required
              />
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 -mb-4 flex justify-end gap-2 border-t bg-white px-6 py-3">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
              disabled={saving || matchedManager.status !== "matched"}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
