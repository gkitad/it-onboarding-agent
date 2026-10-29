import type { Metadata } from "next";
import "@fontsource-variable/schibsted-grotesk/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onboarding Agent",
  description:
    "Sets up new hires and closes out people who leave in a mock company directory. Sensitive access needs a person's approval and every change is logged. Built by Anthony Jaimez with the Claude API.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
