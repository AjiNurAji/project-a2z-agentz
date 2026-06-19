"use client";

import { motion } from "motion/react";
import AuditTrail from "@/components/AuditTrail";
import PageHeader from "@/components/PageHeader";
import { History } from "lucide-react";

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

export default function HistoryPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Audit Trail"
          description="Complete paginated log of all agent transactions — approvals, rejections, and raw cryptographic payloads"
          icon={History}
        />
      </motion.div>
      <motion.div variants={itemVariants}>
        <AuditTrail />
      </motion.div>
    </motion.div>
  );
}
