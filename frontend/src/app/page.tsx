"use client";

import { ReportBuilder } from "@/components/report-builder/report-builder";
import { Header } from "@/components/layout/header";
import { ConnectionBar } from "@/components/layout/connection-bar";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <ConnectionBar />
      <main className="flex flex-1">
        <ReportBuilder />
      </main>
    </div>
  );
}

