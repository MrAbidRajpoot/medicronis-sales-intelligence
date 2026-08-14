import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExcelTemplateWizard } from "@/components/excel-template-wizard/excel-template-wizard";

export const dynamic = "force-dynamic";

export default async function DistributorExcelTemplatePage({
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

  return (
    <ExcelTemplateWizard
      distributorId={distributor.id}
      distributorName={distributor.name}
      distributorCode={distributor.code}
      inputMode={distributor.inputMode}
      isSetup={searchParams.setup === "1"}
      returnTo={searchParams.returnTo}
    />
  );
}
