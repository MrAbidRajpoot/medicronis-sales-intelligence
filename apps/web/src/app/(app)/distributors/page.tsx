"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Download, FileStack, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { TemplateCoverageKpis } from "@/components/template-coverage-kpis";
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
}

interface Distributor {
  id: string;
  code: string;
  name: string;
  territoryId: string | null;
  territoryName: string | null;
  areaId: string | null;
  areaName: string | null;
  regionId: string | null;
  regionName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  managerName: string | null;
  isActive: boolean;
  documentCount: number;
  mappingCount: number;
  templateReady: boolean;
  excelTemplateReady?: boolean;
  uploadReady?: boolean;
  inputMode?: "BOTH" | "EXCEL_ONLY";
}

const emptyForm = {
  code: "",
  name: "",
  territoryId: "",
  areaId: "",
  regionId: "",
  zoneId: "",
  inputMode: "BOTH" as "BOTH" | "EXCEL_ONLY",
};

export default function DistributorsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Distributor[]>([]);
  const [territories, setTerritories] = useState<GeoOption[]>([]);
  const [areas, setAreas] = useState<GeoOption[]>([]);
  const [regions, setRegions] = useState<GeoOption[]>([]);
  const [zones, setZones] = useState<GeoOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    created: number;
    skipped: number;
    failed: number;
    errors: { rowNumber: number; code: string; message: string }[];
  } | null>(null);

  const loadGeo = useCallback(async () => {
    try {
      const [tRes, aRes, rRes, zRes] = await Promise.all([
        fetch("/api/territories"),
        fetch("/api/areas"),
        fetch("/api/regions"),
        fetch("/api/zones"),
      ]);
      setTerritories(await tRes.json());
      setAreas(await aRes.json());
      setRegions(await rRes.json());
      setZones(await zRes.json());
    } catch {
      toast.error("Failed to load geography options");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/distributors?includeInactive=1");
      setItems(await res.json());
    } catch {
      toast.error("Failed to load distributors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadGeo();
  }, [load, loadGeo]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.code,
        item.name,
        item.territoryName,
        item.areaName,
        item.regionName,
        item.zoneName,
        item.managerName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: Distributor) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      territoryId: item.territoryId ?? "",
      areaId: item.areaId ?? "",
      regionId: item.regionId ?? "",
      zoneId: item.zoneId ?? "",
      inputMode: item.inputMode ?? "BOTH",
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        territoryId: form.territoryId || null,
        areaId: form.areaId || null,
        regionId: form.regionId || null,
        zoneId: form.zoneId || null,
        inputMode: form.inputMode,
      };

      const url = editing ? `/api/distributors/${editing.id}` : "/api/distributors";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (editing) {
        toast.success("Distributor updated");
        setDialogOpen(false);
        load();
        loadGeo();
      } else {
        const nextPath =
          form.inputMode === "EXCEL_ONLY"
            ? `/distributors/${data.id}/excel-template?setup=1`
            : `/distributors/${data.id}/template?setup=1`;
        toast.success(
          form.inputMode === "EXCEL_ONLY"
            ? "Distributor created — configure Excel column map next"
            : "Distributor created — configure PDF template next"
        );
        setDialogOpen(false);
        router.push(nextPath);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Distributor) {
    if (!confirm(`Deactivate ${item.name}?`)) return;
    try {
      const res = await fetch(`/api/distributors/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Distributor deactivated");
      load();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function handleReactivate(item: Distributor) {
    try {
      const res = await fetch(`/api/distributors/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error("Reactivate failed");
      toast.success("Distributor reactivated");
      load();
    } catch {
      toast.error("Reactivate failed");
    }
  }

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkFile) {
      toast.error("Select an Excel file");
      return;
    }

    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);

      const res = await fetch("/api/distributors/bulk-upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setUploadResult(data);
      if (data.created > 0) {
        toast.success(`Imported ${data.created} distributor(s)`);
        load();
        loadGeo();
      } else {
        toast.error("No distributors were imported");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distributors"
        description="Manage distributor master data used for PDF matching and SSR reports"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="/api/distributors/template">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </a>
            </Button>
            <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkFile(null); setUploadResult(null); }}>
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload
            </Button>
            <Button variant="accent" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Distributor
            </Button>
          </div>
        }
      />

      <TemplateCoverageKpis />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No distributors"
          description="Add your first distributor to enable PDF auto-detection and SSR reporting."
          action={{ label: "Add Distributor", href: "#" }}
        />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, territory, area, region, zone, manager…"
              className="pl-9"
              aria-label="Search distributors"
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching distributors"
              description="Try a different search term, or clear the search to see all distributors."
            />
          ) : (
            <div className="rounded-lg border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead title="Resolved from Territory → Area → Region → Zone">Manager</TableHead>
                    <TableHead className="text-right">Documents</TableHead>
                    <TableHead className="text-right">Mappings</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-60" : undefined}>
                      <TableCell className="font-mono text-sm">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.territoryName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.areaName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.regionName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.zoneName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.managerName ?? "—"}</TableCell>
                      <TableCell className="text-right">{item.documentCount}</TableCell>
                      <TableCell className="text-right">{item.mappingCount}</TableCell>
                      <TableCell>
                        {item.inputMode === "EXCEL_ONLY" ? (
                          item.excelTemplateReady || item.uploadReady ? (
                            <Badge variant="success">Excel ready</Badge>
                          ) : (
                            <Badge variant="danger">Excel map required</Badge>
                          )
                        ) : item.templateReady ? (
                          <Badge variant="success">Ready</Badge>
                        ) : (
                          <Badge variant="danger">Template required</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.inputMode === "EXCEL_ONLY" ? "warning" : "secondary"}>
                          {item.inputMode === "EXCEL_ONLY" ? "Excel only" : "Both"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "success" : "secondary"}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.inputMode === "EXCEL_ONLY" ? (
                            <Button variant="ghost" size="sm" asChild title="Configure Excel column map">
                              <Link href={`/distributors/${item.id}/excel-template`}>
                                <FileStack className="h-4 w-4" />
                              </Link>
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" asChild title="Configure PDF template">
                                <Link href={`/distributors/${item.id}/template`}>
                                  <FileStack className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" asChild title="Configure Excel column map">
                                <Link href={`/distributors/${item.id}/excel-template`}>
                                  <Upload className="h-4 w-4" />
                                </Link>
                              </Button>
                            </>
                          )}
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
        title={editing ? "Edit Distributor" : "Add Distributor"}
        description="Distributor code is used for PDF template auto-detection"
        className="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {!editing && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              After creating the distributor you will configure the{" "}
              {form.inputMode === "EXCEL_ONLY" ? "Excel column map" : "PDF column mapping template"}{" "}
              before uploads are enabled.
            </div>
          )}
          {editing && editing.inputMode === "EXCEL_ONLY" && !editing.excelTemplateReady && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <span className="font-medium text-destructive">Excel map required</span>
              {" — "}
              <Link
                href={`/distributors/${editing.id}/excel-template?setup=1`}
                className="text-primary underline"
                onClick={() => setDialogOpen(false)}
              >
                Configure Excel column map
              </Link>
            </div>
          )}
          {editing && editing.inputMode !== "EXCEL_ONLY" && !editing.templateReady && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <span className="font-medium text-destructive">Template required</span>
              {" — "}
              <Link
                href={`/distributors/${editing.id}/template?setup=1`}
                className="text-primary underline"
                onClick={() => setDialogOpen(false)}
              >
                Configure PDF template
              </Link>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="DIST-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="PharmaLink Distribution"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Territory</Label>
              <Select
                value={form.territoryId}
                onValueChange={(value) => setForm((f) => ({ ...f, territoryId: value }))}
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
                value={form.areaId}
                onValueChange={(value) => setForm((f) => ({ ...f, areaId: value }))}
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={form.regionId}
                onValueChange={(value) => setForm((f) => ({ ...f, regionId: value }))}
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
                value={form.zoneId}
                onValueChange={(value) => setForm((f) => ({ ...f, zoneId: value }))}
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
          </div>

          <div className="space-y-2">
            <Label>Input mode</Label>
            <Select
              value={form.inputMode}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, inputMode: value as "BOTH" | "EXCEL_ONLY" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select input mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BOTH">Both (PDF + Excel)</SelectItem>
                <SelectItem value="EXCEL_ONLY">Excel only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Default is Both (PDF + Excel; Excel optional). Set Excel only only when you
              intentionally want to block PDF uploads.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            {editing && (
              <>
                {editing.inputMode !== "EXCEL_ONLY" && (
                  <Button type="button" variant="outline" asChild>
                    <Link
                      href={`/distributors/${editing.id}/template`}
                      onClick={() => setDialogOpen(false)}
                    >
                      Update PDF Template
                    </Link>
                  </Button>
                )}
                <Button type="button" variant="outline" asChild>
                  <Link
                    href={`/distributors/${editing.id}/excel-template`}
                    onClick={() => setDialogOpen(false)}
                  >
                    Excel Column Map
                  </Link>
                </Button>
              </>
            )}
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Upload Distributors"
        description="Upload an Excel file using the Medicronis distributor template"
        className="max-w-xl"
      >
        <form onSubmit={handleBulkUpload} className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Download the template first, fill in your distributors, then upload the .xlsx file here.
            Required columns: <span className="font-medium text-foreground">Code</span>,{" "}
            <span className="font-medium text-foreground">Name</span>. Optional: Territory, Area, Region, Zone.
            Managers are assigned on geography pages.
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-file">Excel file (.xlsx)</Label>
            <Input
              id="bulk-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
            />
            {bulkFile && (
              <p className="text-xs text-muted-foreground">{bulkFile.name} ({Math.round(bulkFile.size / 1024)} KB)</p>
            )}
          </div>

          {uploadResult && (
            <div className="rounded-md border px-4 py-3 text-sm">
              <p>
                <span className="font-medium text-emerald-700">{uploadResult.created} created</span>
                {uploadResult.skipped > 0 && (
                  <span className="ml-3 text-amber-700">{uploadResult.skipped} skipped</span>
                )}
                {uploadResult.failed > 0 && (
                  <span className="ml-3 text-destructive">{uploadResult.failed} failed</span>
                )}
              </p>
              {uploadResult.errors.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {uploadResult.errors.map((err, i) => (
                    <li key={i}>
                      Row {err.rowNumber} ({err.code}): {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
              Close
            </Button>
            <Button type="submit" variant="accent" disabled={uploading || !bulkFile}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload & Import"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
