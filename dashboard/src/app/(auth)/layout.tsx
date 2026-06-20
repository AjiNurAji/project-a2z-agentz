import AgentScene from "@/components/landing/AgentScene";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* AgentScene as full background — reuse existing component */}
      <div className="fixed inset-0 z-0">
        <AgentScene isTransitioning={false} onTransitionComplete={() => {}} />
      </div>

      {/* Glass form card centered */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
