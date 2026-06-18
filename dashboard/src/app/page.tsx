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

export default function Home() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <PageHeader
        title="Mission Control"
        description="Real-time overview of all autonomous agent activity on Base Network"
        icon={LayoutDashboard}
      />

      {/* KPI Cards */}
      <DashboardKpis />

      {/* Circuit Breaker */}
      <CircuitBreaker />

      {/* Agent Communication + Logs row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AgentCommPanel />
        <LiveLog />
      </div>

      {/* Approval Queue + Transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <ApprovalQueue />
        </div>
        <div className="xl:col-span-2">
          <TransactionList />
        </div>
      </div>
    </motion.div>
  );
}
