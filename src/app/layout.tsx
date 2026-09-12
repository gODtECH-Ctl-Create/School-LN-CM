import type { Metadata } from "next";
import ClientDiagnostics from "@/src/components/client-diagnostics";
import "./globals.css";
import "./mobile.css";
import "./shell-fix.css";
import "./viewport-auth-fix.css";
import "./admin/academic/structure-setup.css";
import "./mobile-nav-final.css";

export const metadata: Metadata = {
  title: "School LN CM",
  description: "Curriculum-driven lesson planning for schools and teachers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClientDiagnostics />
        {children}
      </body>
    </html>
  );
}
