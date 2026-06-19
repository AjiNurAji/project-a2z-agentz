"use client";

import { motion } from "motion/react";
import CircuitBreaker from "@/components/CircuitBreaker";
import LiveLog from "@/components/LiveLog";
import TransactionList from "@/components/TransactionList";
import ApprovalQueue from "@/components/ApprovalQueue";
import DashboardKpis from "@/components/DashboardKpis";
import PageHeader from "@/components/PageHeader";
import AgentCommPanel from "@/components/AgentCommPanel";
import { LayoutDashboard } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } }
};

export default function Home() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Mission Control"
          description="Real-time overview of all autonomous agent activity on Base Network"
          icon={LayoutDashboard}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <DashboardKpis />
      </motion.div>

      <motion.div variants={itemVariants}>
        <CircuitBreaker />
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AgentCommPanel />
          <LiveLog />
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <ApprovalQueue />
          </div>
          <div className="xl:col-span-2">
            <TransactionList />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
