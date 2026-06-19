import { DashboardProvider } from "@/components/DashboardContext";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { KeyboardNavWrapper } from "@/components/ui/KeyboardNavWrapper";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SkipToContent from "@/components/ui/SkipToContent";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { KeyboardHelpOverlay } from "@/components/ui/KeyboardHelpOverlay";
import { OnboardingTour } from "@/components/ui/OnboardingTour";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SkipToContent />
      <DashboardProvider>
        <KeyboardNavWrapper>
          <CommandPalette />
          <KeyboardHelpOverlay />
          <OnboardingTour />
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <Navbar />
            <main className="flex-1 overflow-y-auto relative" id="main-content">
              <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
                <div
                  className="absolute top-[-15%] right-[5%] w-[35%] h-[35%] rounded-full blur-[140px] opacity-7 mesh-blob-1"
                  style={{ backgroundColor: "var(--color-brand)" }}
                />
                <div
                  className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full blur-[120px] opacity-7 mesh-blob-2"
                  style={{ backgroundColor: "var(--color-accent-purple)" }}
                />
              </div>
              <div className="relative z-10 p-4 md:p-6 lg:p-8">
                <ErrorBoundary section="Page">
                  {children}
                </ErrorBoundary>
                <ScrollToTop />
              </div>
            </main>
          </div>
        </KeyboardNavWrapper>
      </DashboardProvider>
    </>
  );
}
