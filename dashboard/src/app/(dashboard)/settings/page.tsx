"use client";

import { motion } from "motion/react";
import SettingsPanel from "@/components/SettingsPanel";
import SubscriptionPanel from "@/components/SubscriptionPanel";
import PageHeader from "@/components/PageHeader";
import { Settings, CreditCard } from "lucide-react";

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

export default function SettingsPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Configuration & Settings"
          description="Tune Agent A scoring parameters, Agent B execution limits, and RPC configuration"
          icon={Settings}
        />
      </motion.div>
      <motion.div variants={itemVariants}>
        <SettingsPanel />
      </motion.div>
      <motion.div variants={itemVariants}>
        <SubscriptionPanel />
      </motion.div>
    </motion.div>
  );
}
