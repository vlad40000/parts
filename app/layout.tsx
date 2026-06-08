import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Appliance BOM Workbench",
  description: "Internal RoadrunnerParts appliance BOM workbench"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
