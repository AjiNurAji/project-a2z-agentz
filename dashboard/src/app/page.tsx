import CircuitBreaker from "@/components/CircuitBreaker";
import LiveLog from "@/components/LiveLog";
import TransactionList from "@/components/TransactionList";
import ApprovalQueue from "@/components/ApprovalQueue";
import DashboardKpis from "@/components/DashboardKpis";
import PageHeader from "@/components/PageHeader";
import { LayoutDashboard } from "lucide-react";

export default function Home() {
  return (
    <>
      <PageHeader
        title="Mission Control"
        description="Real-time overview of all autonomous agent activity on Base Network"
        icon={LayoutDashboard}
      />

      {/* KPI Cards */}
      <DashboardKpis />

      {/* Circuit Breaker */}
      <div className="mt-6">
        <CircuitBreaker />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <LiveLog />
          <ApprovalQueue />
        </div>

        {/* Right column */}
        <div className="xl:col-span-2 min-h-[400px]">
          <TransactionList />
        </div>
      </div>
    </>
  );
}
