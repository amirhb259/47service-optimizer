import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "47Service License Admin",
  description: "Secure 47Service license and support administration dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
