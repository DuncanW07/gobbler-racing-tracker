import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard — Gobbler Racing Consumables Tracker",
};

export default async function DashboardPage() {
  await requireSession();
  return <Dashboard />;
}
