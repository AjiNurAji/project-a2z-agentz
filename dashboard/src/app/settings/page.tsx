"use client";

import SettingsPanel from "@/components/SettingsPanel";
import PageHeader from "@/components/PageHeader";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration & Settings"
        description="Tune Agent A scoring parameters, Agent B execution limits, and RPC configuration"
        icon={Settings}
      />
      <SettingsPanel />
    </div>
  );
}
