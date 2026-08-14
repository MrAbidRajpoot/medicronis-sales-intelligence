"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Check, X, Link2, ClipboardCheck, Loader2, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/toast-provider";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewSkeleton } from "@/components/skeletons";

interface ReviewItem {
  id: string;
  documentId: string;
  documentName: string;
  distributorName: string;
  distributorId: string | null;
  rawProductText: string;
  quantity: number;
  mappingStatus: "review" | "unknown";
  suggestedProductId: string | null;
  suggestedSku: string | null;
  suggestedName: string | null;
  confidence: number;
  suggestions: { productId: string; sku: string | null; name: string | null; confidence: number }[];
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface ProductGroupOption {
  id: string;
  name: string;
}

interface ManufacturerOption {
  id: string;
  name: string;
}

const emptyCreateForm = {
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

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroupOption[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [mapProduct, setMapProduct] = useState<Record<string, string>>({});
  const [createFor, setCreateFor] = useState<ReviewItem | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewRes, prodRes, groupsRes, mfrRes] = await Promise.all([
        fetch("/api/review"),
        fetch("/api/products"),
        fetch("/api/product-groups"),
        fetch("/api/manufacturers"),
      ]);
      const reviewData = await reviewRes.json();
      setItems(reviewData.items ?? []);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (groupsRes.ok) setProductGroups(await groupsRes.json());
      if (mfrRes.ok) setManufacturers(await mfrRes.json());
    } catch {
      toast.error("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(rowId: string, action: "approve" | "reject", productId?: string) {
    setResolving(rowId);
    try {
      const res = await fetch(`/api/review/${rowId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");

      setItems((prev) => prev.filter((i) => i.id !== rowId));
      toast.success(action === "reject" ? "Row rejected" : `Mapped to ${data.product?.name ?? "product"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setResolving(null);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!createFor) return;
    if (!createForm.productGroupId) {
      toast.error("Product group is required");
      return;
    }
    setCreating(true);
    try {
      const extraAliases = createForm.aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: createForm.sku,
          name: createForm.name,
          category: createForm.category || null,
          productGroupId: createForm.productGroupId || null,
          composition: createForm.composition || null,
          manufacturerId: createForm.useNewManufacturer ? null : createForm.manufacturerId || null,
          manufacturerName: createForm.useNewManufacturer ? createForm.manufacturerName : null,
          shipperSize: createForm.shipperSize ? Number(createForm.shipperSize) : null,
          mrp: createForm.mrp ? Number(createForm.mrp) : null,
          tp: createForm.tp ? Number(createForm.tp) : null,
          oldSp: createForm.oldSp ? Number(createForm.oldSp) : null,
          newSp: createForm.newSp ? Number(createForm.newSp) : null,
          netPrice: createForm.netPrice ? Number(createForm.netPrice) : null,
          tax: createForm.tax ? Number(createForm.tax) : null,
          netPriceWith1Pct: createForm.netPriceWith1Pct ? Number(createForm.netPriceWith1Pct) : null,
          bonus: createForm.bonus || null,
          alias: createFor.rawProductText,
          aliases: extraAliases,
          reviewRowId: createFor.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");

      setItems((prev) => prev.filter((i) => i.id !== createFor.id));
      setProducts((prev) => [...prev, { id: data.id, sku: data.sku, name: data.name }]);
      if (createForm.useNewManufacturer && data.manufacturerName) {
        setManufacturers((prev) => {
          const id = data.manufacturerId as string | undefined;
          if (!id || prev.some((m) => m.id === id)) return prev;
          return [...prev, { id, name: data.manufacturerName }];
        });
      }
      setCreateFor(null);
      setCreateForm(emptyCreateForm);
      toast.success(`Created "${data.name}" and mapped row`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function openCreateProduct(item: ReviewItem) {
    const slug = item.rawProductText
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20)
      .toUpperCase();
    setCreateForm({
      ...emptyCreateForm,
      sku: slug ? `NEW-${slug}` : "",
      name: item.rawProductText,
      productGroupId: productGroups.find((g) => g.name === "Medicronis")?.id ?? "",
      aliases: item.rawProductText,
    });
    setCreateFor(item);
  }

  if (loading) {
    return <ReviewSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Resolve product matching exceptions before SSR generation"
        actions={
          <Badge variant="warning" className="text-sm">
            {items.length} pending
          </Badge>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="All caught up"
          description="No product matching exceptions require review. Upload new documents or approve matched documents for SSR generation."
          action={{ label: "View Documents", href: "/documents" }}
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              products={products}
              mapProduct={mapProduct[item.id] ?? item.suggestedProductId ?? ""}
              onMapChange={(pid) => setMapProduct((p) => ({ ...p, [item.id]: pid }))}
              resolving={resolving === item.id}
              onApprove={() =>
                resolve(
                  item.id,
                  "approve",
                  mapProduct[item.id] || item.suggestedProductId || undefined
                )
              }
              onReject={() => resolve(item.id, "reject")}
              onMap={() => {
                const pid = mapProduct[item.id];
                if (!pid) {
                  toast.error("Select a product to map");
                  return;
                }
                resolve(item.id, "approve", pid);
              }}
              onCreateProduct={() => openCreateProduct(item)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!createFor}
        onClose={() => {
          setCreateFor(null);
          setCreateForm(emptyCreateForm);
        }}
        title="Create New Product"
        description="Creates a product and maps it to the unmatched PDF row"
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={createProduct} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-sku">SKU / Product Code</Label>
              <Input
                id="create-sku"
                value={createForm.sku}
                onChange={(e) => setCreateForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="MED-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={createForm.productGroupId}
                onValueChange={(value) => setCreateForm((f) => ({ ...f, productGroupId: value }))}
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
            <Label htmlFor="create-name">Product Name</Label>
            <Input
              id="create-name"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-category">Category</Label>
            <Input
              id="create-category"
              value={createForm.category}
              onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="Antibiotics"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-composition">Composition</Label>
            <Input
              id="create-composition"
              value={createForm.composition}
              onChange={(e) => setCreateForm((f) => ({ ...f, composition: e.target.value }))}
              placeholder="Amoxicillin 500mg"
            />
          </div>

          <div className="space-y-2">
            <Label>Manufacturer</Label>
            {!createForm.useNewManufacturer ? (
              <Select
                value={createForm.manufacturerId}
                onValueChange={(value) => {
                  if (value === "__new__") {
                    setCreateForm((f) => ({
                      ...f,
                      useNewManufacturer: true,
                      manufacturerId: "",
                      manufacturerName: "",
                    }));
                  } else {
                    setCreateForm((f) => ({ ...f, manufacturerId: value }));
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
                  value={createForm.manufacturerName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, manufacturerName: e.target.value }))}
                  placeholder="Enter manufacturer name"
                />
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={() =>
                    setCreateForm((f) => ({
                      ...f,
                      useNewManufacturer: false,
                      manufacturerName: "",
                      manufacturerId: "",
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
              <Label htmlFor="create-shipperSize">Shipper Size</Label>
              <Input
                id="create-shipperSize"
                type="number"
                min="0"
                step="1"
                value={createForm.shipperSize}
                onChange={(e) => setCreateForm((f) => ({ ...f, shipperSize: e.target.value }))}
                placeholder="100"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="create-bonus">Bonus</Label>
              <Input
                id="create-bonus"
                value={createForm.bonus}
                onChange={(e) => setCreateForm((f) => ({ ...f, bonus: e.target.value }))}
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
                  <Label htmlFor={`create-${key}`}>{label}</Label>
                  <Input
                    id={`create-${key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm[key]}
                    onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-aliases">Aliases (comma-separated)</Label>
            <Input
              id="create-aliases"
              value={createForm.aliases}
              onChange={(e) => setCreateForm((f) => ({ ...f, aliases: e.target.value }))}
              placeholder="Amox 500, AMOXICILLIN 500MG"
            />
          </div>

          {createFor && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              PDF text will also be saved as an alias:{" "}
              <span className="font-mono">{createFor.rawProductText}</span>
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateFor(null);
                setCreateForm(emptyCreateForm);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create & Map"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function ReviewCard({
  item,
  products,
  mapProduct,
  onMapChange,
  resolving,
  onApprove,
  onReject,
  onMap,
  onCreateProduct,
}: {
  item: ReviewItem;
  products: Product[];
  mapProduct: string;
  onMapChange: (id: string) => void;
  resolving: boolean;
  onApprove: () => void;
  onReject: () => void;
  onMap: () => void;
  onCreateProduct: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link href={`/documents/${item.documentId}`} className="text-primary hover:underline">
                {item.documentName}
              </Link>
              <span>·</span>
              <span>{item.distributorName}</span>
              <span>·</span>
              <span>Sales Units: {item.quantity.toLocaleString()}</span>
              <Badge variant={item.mappingStatus === "unknown" ? "danger" : "warning"}>
                {item.mappingStatus}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-red-50/50 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Raw Text (from PDF)</p>
                <p className="mt-1 font-mono text-sm font-medium">{item.rawProductText}</p>
              </div>
              <div className="rounded-md border bg-emerald-50/50 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Suggested Match</p>
                {item.suggestions.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {item.suggestions.map((s) => (
                      <li key={s.productId}>
                        <button
                          type="button"
                          onClick={() => onMapChange(s.productId)}
                          className={`w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-emerald-100/80 ${
                            mapProduct === s.productId ? "bg-emerald-100 font-medium ring-1 ring-emerald-300" : ""
                          }`}
                        >
                          {s.name} ({s.sku}) — {Math.round(s.confidence * 100)}%
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No suggestion — manual mapping required</p>
                )}
              </div>
            </div>

            {products.length > 0 && (
              <div className="max-w-md">
                <Select value={mapProduct} onValueChange={onMapChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product to map" />
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
            )}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onCreateProduct} disabled={resolving}>
              <PlusCircle className="mr-1 h-4 w-4" />
              New Product
            </Button>
            {item.suggestedProductId && (
              <Button variant="accent" size="sm" onClick={onApprove} disabled={resolving}>
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Approve
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onMap} disabled={resolving}>
              <Link2 className="mr-1 h-4 w-4" />
              Map
            </Button>
            <Button variant="ghost" size="sm" onClick={onReject} disabled={resolving}>
              <X className="mr-1 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
