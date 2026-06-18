"use client";

import { motion } from "motion/react";
import SettingsPanel from "@/components/SettingsPanel";
import PageHeader from "@/components/PageHeader";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <PageHeader
        title="Configuration & Settings"
        description="Tune Agent A scoring parameters, Agent B execution limits, and RPC configuration"
        icon={Settings}
      />
      <SettingsPanel />
    </motion.div>
  );
}
