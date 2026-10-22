import type { Metadata } from "next";
import "@fontsource-variable/schibsted-grotesk/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onboarding Agent",
  description:
    "An AI agent that onboards new hires and offboards leavers across a simulated directory, with human approval for sensitive access and a full audit log. Built by Anthony Jaimez with the Claude API.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
