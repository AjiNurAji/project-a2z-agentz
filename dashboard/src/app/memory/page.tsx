"use client";

import { motion } from "motion/react";
import VectorMemoryExplorer from "@/components/VectorMemoryExplorer";
import PageHeader from "@/components/PageHeader";
import { Database } from "lucide-react";

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

export default function MemoryPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Vector Memory Explorer"
          description="ChromaDB semantic cache — indexed embeddings, similarity scores, and Agent A project memory"
          icon={Database}
        />
      </motion.div>
      <motion.div variants={itemVariants}>
        <VectorMemoryExplorer />
      </motion.div>
    </motion.div>
  );
}
