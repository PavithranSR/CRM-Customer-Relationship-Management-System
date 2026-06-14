import type { Metadata } from "next";
import { Suspense } from "react";
import { GlobalLoadingProvider } from "@/components/loading/global-loading-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Loader } from "@/components/ui/loader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matt Work Tracker",
  description: "Track employee work, manage projects, and generate reports",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased">
        <ThemeProvider>
          <Suspense
            fallback={
              <div className="fixed inset-0 flex items-center justify-center bg-background">
                <Loader label="Loading..." size="lg" center />
              </div>
            }
          >
            <GlobalLoadingProvider>{children}</GlobalLoadingProvider>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
