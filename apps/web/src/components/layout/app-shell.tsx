import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { DemoBanner } from "@/components/demo-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <DemoBanner />
        <main className="flex-1 overflow-auto p-4 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
