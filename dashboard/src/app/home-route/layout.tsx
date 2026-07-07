export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="w-full h-full relative overflow-x-hidden select-none" suppressHydrationWarning={true}>
      {children}
    </div>
  );
}
