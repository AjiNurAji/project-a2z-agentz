import AnalyticsCharts from "@/components/AnalyticsCharts";
import PageHeader from "@/components/PageHeader";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Interactive visualization of agent performance, TVL trends, gas pricing, and transaction success metrics"
        icon={BarChart3}
      />
      <AnalyticsCharts />
    </>
  );
}
