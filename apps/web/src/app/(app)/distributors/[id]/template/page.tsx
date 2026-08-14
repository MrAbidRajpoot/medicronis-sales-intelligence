import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TemplateWizard } from "@/components/template-wizard/template-wizard";

export const dynamic = "force-dynamic";

export default async function DistributorTemplatePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { setup?: string; returnTo?: string };
}) {
  const distributor = await prisma.distributor.findUnique({
    where: { id: params.id },
    select: { id: true, code: true, name: true, isActive: true, inputMode: true },
  });

  if (!distributor) notFound();

  // Excel-only distributors use the Excel mapping wizard instead of PDF templates.
  if (distributor.inputMode === "EXCEL_ONLY") {
    const qs = new URLSearchParams();
    if (searchParams.setup === "1") qs.set("setup", "1");
    if (searchParams.returnTo) qs.set("returnTo", searchParams.returnTo);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    redirect(`/distributors/${distributor.id}/excel-template${suffix}`);
  }

  return (
    <TemplateWizard
      distributorId={distributor.id}
      distributorName={distributor.name}
      distributorCode={distributor.code}
      isSetup={searchParams.setup === "1"}
      returnTo={searchParams.returnTo}
    />
  );
}
