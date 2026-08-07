import { notFound } from "next/navigation";
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
    select: { id: true, code: true, name: true, isActive: true },
  });

  if (!distributor) notFound();

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
