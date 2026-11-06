import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "At Home — Glass Dashboard",
  description: "A touch-friendly Home Assistant dashboard for your home.",
  applicationName: "At Home",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "At Home",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
