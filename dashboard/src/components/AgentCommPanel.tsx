"use client";
import { useDashboard, type AgentMessage, type MessageStatus } from "./DashboardContext";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bot, Shield, Check, X, Loader2, Clock, Send, Radio,
  Hash, TrendingUp, DollarSign, FolderOpen,
} from "lucide-react";

// ── Status indicator ────────────────────────────────────────
function MessageStatusIcon({ status }: { status: MessageStatus }) {
  const map: Record<MessageStatus, { icon: typeof Check; color: string; label: string }> = {
    sending:     { icon: Loader2, color: "var(--color-fg-disabled)", label: "Sending" },
    sent:        { icon: Send, color: "var(--color-fg-info)", label: "Sent" },
    processing:  { icon: Loader2, color: "var(--color-fg-warning)", label: "Processing" },
    done:        { icon: Check, color: "var(--color-fg-success)", label: "Done" },
    error:       { icon: X, color: "var(--color-fg-danger)", label: "Error" },
  };
  const { icon: Icon, color, label } = map[status];
  return (
    <span className="flex items-center gap-1" style={{ color }} title={label}>
      <Icon
        className={`w-3 h-3 ${status === "sending" || status === "processing" ? "animate-spin" : ""}`}
      />
      <span className="text-[10px] hidden sm:inline">{label}</span>
    </span>
  );
}

// ── Metadata chips ──────────────────────────────────────────
function MetadataChips({ metadata }: { metadata: AgentMessage["metadata"] }) {
  if (!metadata) return null;
  const chips: { icon: typeof Hash; label: string; value: string; color: string }[] = [];
  if (metadata.projectName) chips.push({ icon: FolderOpen, label: "Project", value: metadata.projectName, color: "var(--color-fg-purple)" });
  if (metadata.score != null) chips.push({ icon: TrendingUp, label: "Score", value: `${metadata.score}/100`, color: "var(--color-fg-success)" });
  if (metadata.amountUsd != null) chips.push({ icon: DollarSign, label: "Amount", value: `$${metadata.amountUsd}`, color: "var(--color-fg-warning)" });
  if (metadata.txHash) chips.push({ icon: Hash, label: "Tx", value: metadata.txHash, color: "var(--color-fg-cyan)" });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border"
          style={{
            background: "var(--color-neutral-secondary-medium)",
            color: chip.color,
            borderColor: "var(--color-border-default)",
          }}
        >
          <chip.icon className="w-2.5 h-2.5" />
          {chip.value}
        </span>
      ))}
    </div>
  );
}

// ── Single bubble ───────────────────────────────────────────
function MessageBubble({ message, index }: { message: AgentMessage; index: number }) {
  const isAgentA = message.sender === "agent_a";
  const isAgentB = message.sender === "agent_b";
  const isSystem = message.sender === "system";

  // System message — centered, muted, smaller
  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.02 }}
        className="flex justify-center px-4"
      >
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]"
          style={{
            background: "var(--color-neutral-secondary-medium)",
            color: "var(--color-fg-disabled)",
            border: "1px solid var(--color-border-muted)",
          }}
        >
          <Radio className="w-3 h-3" />
          <span>{message.content}</span>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--color-fg-disabled)", fontFamily: "var(--font-mono)" }}>
            {message.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </motion.div>
    );
  }

  // Agent bubble
  const senderLabel = isAgentA ? "The Scout" : "The Vault";
  const SenderIcon = isAgentA ? Bot : Shield;

  const bubbleBg = isAgentA
    ? "linear-gradient(135deg, var(--color-brand-softer) 0%, var(--color-brand-soft) 100%)"
    : "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-medium) 100%)";

  const iconBg = isAgentA ? "var(--color-accent-purple)" : "var(--color-brand-strong)";
  const senderColor = isAgentA ? "var(--color-fg-purple)" : "var(--color-fg-cyan)";
  const borderColor = isAgentA ? "var(--color-border-brand-subtle)" : "var(--color-border-brand)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.02 }}
      className={`flex gap-2.5 sm:gap-3 px-4 ${isAgentA ? "justify-start" : "justify-end"}`}
    >
      {/* Left avatar (Agent A only) */}
      {isAgentA && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1"
          style={{ background: iconBg }}
        >
          <SenderIcon className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Bubble content */}
      <div
        className={`max-w-[80%] sm:max-w-[60%] ${isAgentA ? "" : "text-right"}`}
      >
        {/* Sender name */}
        <div className={`flex items-center gap-1.5 mb-1 ${isAgentA ? "" : "justify-end"}`}>
          <span className="text-[11px] font-semibold" style={{ color: senderColor }}>
            {senderLabel}
          </span>
          <MessageStatusIcon status={message.status} />
        </div>

        {/* Bubble */}
        <div
          className="px-3.5 py-2.5 rounded-2xl"
          style={{
            background: bubbleBg,
            border: `1px solid ${borderColor}`,
            borderRadius: isAgentA ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
          }}
        >
          <p className="text-xs sm:text-[13px] leading-relaxed" style={{ color: "var(--color-body)" }}>
            {message.content}
          </p>
          <MetadataChips metadata={message.metadata} />
        </div>

        {/* Timestamp */}
        <p
          className={`text-[10px] mt-1.5 tabular-nums ${isAgentA ? "" : "text-right"}`}
          style={{ color: "var(--color-fg-disabled)", fontFamily: "var(--font-mono)" }}
        >
          {message.timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          })}
        </p>
      </div>

      {/* Right avatar (Agent B only) */}
      {isAgentB && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1"
          style={{ background: iconBg }}
        >
          <SenderIcon className="w-4 h-4 text-white" />
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────────
export default function AgentCommPanel() {
  const { agentMessages } = useDashboard();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentMessages]);

  // Count messages by sender
  const agentACount = agentMessages.filter((m) => m.sender === "agent_a").length;
  const agentBCount = agentMessages.filter((m) => m.sender === "agent_b").length;

  return (
    <div
      className="card flex flex-col"
      style={{ borderRadius: "var(--radius-base)", minHeight: "400px" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-muted)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: "var(--color-brand-softer)" }}
          >
            <Radio className="w-3.5 h-3.5" style={{ color: "var(--color-fg-brand)" }} />
          </div>
          <h5 className="text-sm font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
            Agent Communication
          </h5>
          <span
            className="w-2 h-2 rounded-full animate-pulse-glow"
            style={{ background: "var(--color-fg-success)" }}
            title="Live"
          />
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5" style={{ color: "var(--color-fg-purple)" }}>
            <Bot className="w-3 h-3" />
            Scout ({agentACount})
          </span>
          <span className="flex items-center gap-1.5" style={{ color: "var(--color-fg-cyan)" }}>
            <Shield className="w-3 h-3" />
            Vault ({agentBCount})
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto py-4 space-y-3"
        aria-live="polite"
        aria-label="Agent communication log"
        role="log"
      >
        <AnimatePresence initial={false}>
          {agentMessages.map((msg, i) => (
            <MessageBubble key={msg.id} message={msg} index={0} />
          ))}
        </AnimatePresence>

        {agentMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: "var(--color-neutral-secondary-medium)" }}
            >
              <Bot className="w-7 h-7" style={{ color: "var(--color-fg-disabled)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--color-body-subtle)" }}>
              Waiting for agents...
            </p>
            <p className="text-xs mt-1.5" style={{ color: "var(--color-fg-disabled)" }}>
              Agent A (Scout) and Agent B (Vault) will appear here
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
