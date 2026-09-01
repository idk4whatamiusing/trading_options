import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";
import { ThemeBootScript } from "@/scripts/theme-boot";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alpaca Options Agent",
  description: "Autonomous options-trading agent on Alpaca paper trading",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const {
    theme_mode,
    theme_preset,
    content_layout,
    navbar_style,
    sidebar_variant,
    sidebar_collapsible,
    font,
  } = PREFERENCE_DEFAULTS;
  return (
    <html
      lang="en"
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        <ThemeBootScript />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-background text-foreground font-sans antialiased`}
      >
        <PreferencesStoreProvider initialValues={PREFERENCE_DEFAULTS}>
          <TooltipProvider>{children}</TooltipProvider>
        </PreferencesStoreProvider>
      </body>
    </html>
  );
}
