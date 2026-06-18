"use client";

import AuditTrail from "@/components/AuditTrail";
import PageHeader from "@/components/PageHeader";
import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Complete paginated log of all agent transactions — approvals, rejections, and raw cryptographic payloads"
        icon={History}
      />
      <AuditTrail />
    </div>
  );
}
