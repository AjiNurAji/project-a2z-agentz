"use client";

import { motion } from "motion/react";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import PageHeader from "@/components/PageHeader";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <PageHeader
        title="Analytics"
        description="Interactive visualization of agent performance, TVL trends, gas pricing, and transaction success metrics"
        icon={BarChart3}
      />
      <AnalyticsCharts />
    </motion.div>
  );
}
