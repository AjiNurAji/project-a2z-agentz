"use client";

import { motion } from "motion/react";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import PageHeader from "@/components/PageHeader";
import { BarChart3 } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 20 } }
};

export default function AnalyticsPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Analytics"
          description="Interactive visualization of agent performance, TVL trends, gas pricing, and transaction success metrics"
          icon={BarChart3}
        />
      </motion.div>
      <motion.div variants={itemVariants}>
        <AnalyticsCharts />
      </motion.div>
    </motion.div>
  );
}
