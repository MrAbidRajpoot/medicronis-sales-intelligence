"use client";

import { Eraser, Filter, Loader2, Search } from "lucide-react";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MonthlyReportFilters } from "@/lib/monthly-reports/types";

export interface ReportsFilterOption {
  id: string;
  name: string;
}

export interface ReportsFilterProductOption extends ReportsFilterOption {
  productGroupId: string | null;
}

export interface ReportsFilterBarProps {
  monthValue: string;
  onMonthChange: (value: string) => void;
  draftFilters: MonthlyReportFilters;
  onDraftFiltersChange: (next: MonthlyReportFilters) => void;
  regions: ReportsFilterOption[];
  areas: ReportsFilterOption[];
  territories: ReportsFilterOption[];
  zones: ReportsFilterOption[];
  managers: ReportsFilterOption[];
  productGroups: ReportsFilterOption[];
  products: ReportsFilterProductOption[];
  distributors: ReportsFilterOption[];
  loading?: boolean;
  summaryLabel?: string | null;
  onApply: () => void;
  onClear: () => void;
}

export function ReportsFilterBar({
  monthValue,
  onMonthChange,
  draftFilters,
  onDraftFiltersChange,
  regions,
  areas,
  territories,
  zones,
  managers,
  productGroups,
  products,
  distributors,
  loading = false,
  summaryLabel = null,
  onApply,
  onClear,
}: ReportsFilterBarProps) {
  const groupIds = draftFilters.productGroupIds ?? [];
  const filteredProducts =
    groupIds.length === 0
      ? products
      : products.filter((p) => p.productGroupId && groupIds.includes(p.productGroupId));

  function setFilter(key: keyof MonthlyReportFilters, ids: string[]) {
    onDraftFiltersChange({ ...draftFilters, [key]: ids });
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4 text-primary" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <Input
              type="month"
              value={monthValue}
              onChange={(e) => onMonthChange(e.target.value)}
              className="h-9"
              required
            />
          </div>
          <MultiSelectFilter
            label="Region"
            options={regions.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.regionIds ?? []}
            onChange={(ids) => setFilter("regionIds", ids)}
          />
          <MultiSelectFilter
            label="Area"
            options={areas.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.areaIds ?? []}
            onChange={(ids) => setFilter("areaIds", ids)}
          />
          <MultiSelectFilter
            label="Territory"
            options={territories.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.territoryIds ?? []}
            onChange={(ids) => setFilter("territoryIds", ids)}
          />
          <MultiSelectFilter
            label="Zone"
            options={zones.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.zoneIds ?? []}
            onChange={(ids) => setFilter("zoneIds", ids)}
          />
          <MultiSelectFilter
            label="Manager"
            options={managers.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.managerIds ?? []}
            onChange={(ids) => setFilter("managerIds", ids)}
          />
          <MultiSelectFilter
            label="Product Group"
            options={productGroups.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.productGroupIds ?? []}
            onChange={(ids) => {
              const allowed =
                ids.length === 0
                  ? null
                  : new Set(
                      products
                        .filter((p) => p.productGroupId && ids.includes(p.productGroupId))
                        .map((p) => p.id)
                    );
              onDraftFiltersChange({
                ...draftFilters,
                productGroupIds: ids,
                productIds: allowed
                  ? (draftFilters.productIds ?? []).filter((id) => allowed.has(id))
                  : draftFilters.productIds,
              });
            }}
          />
          <MultiSelectFilter
            label="Product"
            options={filteredProducts.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.productIds ?? []}
            onChange={(ids) => setFilter("productIds", ids)}
          />
          <MultiSelectFilter
            label="Distributor"
            options={distributors.map((x) => ({ id: x.id, label: x.name }))}
            value={draftFilters.distributorIds ?? []}
            onChange={(ids) => setFilter("distributorIds", ids)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onApply} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Apply
          </Button>
          <Button size="sm" variant="outline" onClick={onClear} disabled={loading}>
            <Eraser className="mr-2 h-4 w-4" />
            Clear
          </Button>
          {summaryLabel && (
            <Badge variant="outline" className="h-8 px-3">
              {summaryLabel}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
