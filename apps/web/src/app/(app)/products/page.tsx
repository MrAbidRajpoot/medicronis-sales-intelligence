"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Package, Pencil, Plus, Search, Trash2, Download, Upload } from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";

interface ManufacturerOption {
  id: string;
  name: string;
}

interface ProductGroupOption {
  id: string;
  name: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  composition: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  productGroupId: string | null;
  productGroupName: string | null;
  shipperSize: number | null;
  mrp: number | null;
  tp: number | null;
  oldSp: number | null;
  newSp: number | null;
  netPrice: number | null;
  tax: number | null;
  netPriceWith1Pct: number | null;
  bonus: string | null;
  isActive: boolean;
  aliases: string[];
  salesLineCount: number;
}

const emptyForm = {
  sku: "",
  name: "",
  category: "",
  productGroupId: "",
  composition: "",
  manufacturerId: "",
  manufacturerName: "",
  useNewManufacturer: false,
  shipperSize: "",
  mrp: "",
  tp: "",
  oldSp: "",
  newSp: "",
  netPrice: "",
  tax: "",
  netPriceWith1Pct: "",
  bonus: "",
  aliases: "",
};

function numToStr(value: number | null | undefined): string {
  return value != null ? String(value) : "";
}

function buildPayload(form: typeof emptyForm, aliases: string[]) {
  return {
    sku: form.sku,
    name: form.name,
    category: form.category || null,
    productGroupId: form.productGroupId || null,
    composition: form.composition || null,
    manufacturerId: form.useNewManufacturer ? null : form.manufacturerId || null,
    manufacturerName: form.useNewManufacturer ? form.manufacturerName : null,
    shipperSize: form.shipperSize ? Number(form.shipperSize) : null,
    mrp: form.mrp ? Number(form.mrp) : null,
    tp: form.tp ? Number(form.tp) : null,
    oldSp: form.oldSp ? Number(form.oldSp) : null,
    newSp: form.newSp ? Number(form.newSp) : null,
    netPrice: form.netPrice ? Number(form.netPrice) : null,
    tax: form.tax ? Number(form.tax) : null,
    netPriceWith1Pct: form.netPriceWith1Pct ? Number(form.netPriceWith1Pct) : null,
    bonus: form.bonus || null,
    aliases,
  };
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroupOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    created: number;
    skipped: number;
    failed: number;
    errors: { rowNumber: number; sku: string; message: string }[];
  } | null>(null);

  const loadManufacturers = useCallback(async () => {
    try {
      const res = await fetch("/api/manufacturers");
      setManufacturers(await res.json());
    } catch {
      toast.error("Failed to load manufacturers");
    }
  }, []);

  const loadProductGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/product-groups");
      setProductGroups(await res.json());
    } catch {
      toast.error("Failed to load product groups");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products?includeInactive=1&full=1");
      setItems(await res.json());
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadManufacturers();
    loadProductGroups();
  }, [load, loadManufacturers, loadProductGroups]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.sku,
        item.name,
        item.manufacturerName,
        item.productGroupName,
        item.category,
        ...item.aliases,
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

  function openEdit(item: Product) {
    setEditing(item);
    setForm({
      sku: item.sku,
      name: item.name,
      category: item.category ?? "",
      productGroupId: item.productGroupId ?? "",
      composition: item.composition ?? "",
      manufacturerId: item.manufacturerId ?? "",
      manufacturerName: "",
      useNewManufacturer: false,
      shipperSize: numToStr(item.shipperSize),
      mrp: numToStr(item.mrp),
      tp: numToStr(item.tp),
      oldSp: numToStr(item.oldSp),
      newSp: numToStr(item.newSp),
      netPrice: numToStr(item.netPrice),
      tax: numToStr(item.tax),
      netPriceWith1Pct: numToStr(item.netPriceWith1Pct),
      bonus: item.bonus ?? "",
      aliases: item.aliases.join(", "),
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productGroupId) {
      toast.error("Product group is required");
      return;
    }
    setSaving(true);
    try {
      const aliases = form.aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const url = editing ? `/api/products/${editing.id}` : "/api/products";
      const method = editing ? "PATCH" : "POST";
      const payload = buildPayload(form, aliases);
      const body = editing
        ? payload
        : { ...payload, alias: aliases[0] };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.success(editing ? "Product updated" : "Product created");
      setDialogOpen(false);
      load();
      loadManufacturers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Product) {
    if (!confirm(`Deactivate ${item.name}?`)) return;
    try {
      const res = await fetch(`/api/products/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Product deactivated");
      load();
    } catch {
      toast.error("Delete failed");
    }
  }

  async function handleReactivate(item: Product) {
    try {
      const res = await fetch(`/api/products/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error("Reactivate failed");
      toast.success("Product reactivated");
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

      const res = await fetch("/api/products/bulk-upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setUploadResult(data);
      if (data.created > 0) {
        toast.success(`Imported ${data.created} product(s)`);
        load();
        loadManufacturers();
      } else {
        toast.error("No products were imported");
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
        title="Products"
        description="Manage product catalog used for PDF matching and SSR line items"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="/api/products/template">
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
              Add Product
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products"
          description="Add products to enable automatic matching from distributor PDFs."
          action={{ label: "Add Product", href: "#" }}
        />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, name, manufacturer, group, category, aliases…"
              className="pl-9"
              aria-label="Search products"
            />
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching products"
              description="Try a different search term, or clear the search to see all products."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>MRP</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Aliases</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-60" : undefined}>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.productGroupName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.manufacturerName ?? "—"}</TableCell>
                      <TableCell>{item.mrp != null ? formatCurrency(item.mrp) : "—"}</TableCell>
                      <TableCell>{item.bonus ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {item.aliases.length > 0 ? item.aliases.join(", ") : "—"}
                      </TableCell>
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
        title={editing ? "Edit Product" : "Add Product"}
        description="SKU must be unique. Aliases improve PDF text matching."
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Product Code</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="MED-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={form.productGroupId}
                onValueChange={(value) => setForm((f) => ({ ...f, productGroupId: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product group" />
                </SelectTrigger>
                <SelectContent>
                  {productGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Amoxicillin 500mg Capsules"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Antibiotics"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="composition">Composition</Label>
            <Input
              id="composition"
              value={form.composition}
              onChange={(e) => setForm((f) => ({ ...f, composition: e.target.value }))}
              placeholder="Amoxicillin 500mg"
            />
          </div>

          <div className="space-y-2">
            <Label>Manufacturer</Label>
            {!form.useNewManufacturer ? (
              <Select
                value={form.manufacturerId}
                onValueChange={(value) => {
                  if (value === "__new__") {
                    setForm((f) => ({ ...f, useNewManufacturer: true, manufacturerId: "", manufacturerName: "" }));
                  } else {
                    setForm((f) => ({ ...f, manufacturerId: value }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select existing manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Add new manufacturer</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input
                  value={form.manufacturerName}
                  onChange={(e) => setForm((f) => ({ ...f, manufacturerName: e.target.value }))}
                  placeholder="Enter manufacturer name"
                />
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      useNewManufacturer: false,
                      manufacturerName: "",
                      manufacturerId: editing?.manufacturerId ?? "",
                    }))
                  }
                >
                  Select from existing manufacturers
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="shipperSize">Shipper Size</Label>
              <Input
                id="shipperSize"
                type="number"
                min="0"
                step="1"
                value={form.shipperSize}
                onChange={(e) => setForm((f) => ({ ...f, shipperSize: e.target.value }))}
                placeholder="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bonus">Bonus</Label>
              <Input
                id="bonus"
                value={form.bonus}
                onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))}
                placeholder="4+1"
              />
              <p className="text-xs text-muted-foreground">Purchase units + free units, e.g. 4+1</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-foreground">Pricing</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["mrp", "MRP"],
                  ["tp", "TP"],
                  ["oldSp", "Old SP"],
                  ["newSp", "New SP"],
                  ["netPrice", "Net Price"],
                  ["tax", "Tax"],
                  ["netPriceWith1Pct", "Net Price with 1%"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    min="0"
                    step="0.01"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aliases">Aliases (comma-separated)</Label>
            <Input
              id="aliases"
              value={form.aliases}
              onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
              placeholder="Amox 500, AMOXICILLIN 500MG"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Upload Products"
        description="Upload an Excel file using the Medicronis product template"
        className="max-w-xl"
      >
        <form onSubmit={handleBulkUpload} className="space-y-4">
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Download the template first, fill in your products, then upload the .xlsx file here.
            Required columns: <span className="font-medium text-foreground">SKU</span>,{" "}
            <span className="font-medium text-foreground">Product Name</span>. Optional{" "}
            <span className="font-medium text-foreground">Group</span> must be Medicronis or Transformer.
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
                      Row {err.rowNumber} ({err.sku}): {err.message}
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
