"use client";

import { motion } from "motion/react";
import AuditTrail from "@/components/AuditTrail";
import PageHeader from "@/components/PageHeader";
import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <PageHeader
        title="Audit Trail"
        description="Complete paginated log of all agent transactions — approvals, rejections, and raw cryptographic payloads"
        icon={History}
      />
      <AuditTrail />
    </motion.div>
  );
}
