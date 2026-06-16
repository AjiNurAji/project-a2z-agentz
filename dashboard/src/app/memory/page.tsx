import VectorMemoryExplorer from "@/components/VectorMemoryExplorer";
import PageHeader from "@/components/PageHeader";
import { Database } from "lucide-react";

export default function MemoryPage() {
  return (
    <>
      <PageHeader
        title="Vector Memory Explorer"
        description="ChromaDB semantic cache — indexed embeddings, similarity scores, and Agent A project memory"
        icon={Database}
      />
      <VectorMemoryExplorer />
    </>
  );
}
