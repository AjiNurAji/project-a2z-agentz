"use client";

import { motion } from "motion/react";
import VectorMemoryExplorer from "@/components/VectorMemoryExplorer";
import PageHeader from "@/components/PageHeader";
import { Database } from "lucide-react";

export default function MemoryPage() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <PageHeader
        title="Vector Memory Explorer"
        description="ChromaDB semantic cache — indexed embeddings, similarity scores, and Agent A project memory"
        icon={Database}
      />
      <VectorMemoryExplorer />
    </motion.div>
  );
}
