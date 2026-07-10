"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface AnalysisRequest {
  targetAddress: string;
  description: string;
  projectName: string;
  useMock?: boolean;
}

export interface AnalysisResult {
  status: string;
  score?: number;
  reason?: string;
  category?: string;
  amount_usd?: number;
  model?: string;
  message?: string;
  step?: string;
}

export function useAIAnalysis() {
  const analyze = useCallback(
    async (req: AnalysisRequest): Promise<AnalysisResult | null> => {
      const body = {
        target_address: req.targetAddress,
        description: req.description,
        project_name: req.projectName,
        use_mock: Boolean(req.useMock),
      };

      try {
        const data = await apiFetch<AnalysisResult>("/api/analyze", {
          method: "POST",
          body: JSON.stringify(body),
        });

        return data;
      } catch (error) {
        console.error("[AI Analysis] Request failed:", error);
        return null;
      }
    },
    []
  );

  return { analyze };
}
