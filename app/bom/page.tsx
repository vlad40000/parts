import { redirect } from "next/navigation";

export default function LegacyBomPage() {
  redirect("/internal/bom");
}
