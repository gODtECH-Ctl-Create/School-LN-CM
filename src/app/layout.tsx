import type { Metadata } from "next";
import "./globals.css";
import "./mobile.css";
import "./mobile-first.css";
import "./shell-fix.css";
import "./admin/academic/structure-setup.css";

export const metadata: Metadata = {
  title: "School LN CM",
  description: "Curriculum-driven lesson planning for schools and teachers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
