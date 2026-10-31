import { redirect } from "next/navigation";

// The app opens on the calendar; the daily tracker lives at /daily (linked
// from the navbar and the summary sidebar).
export default function HomePage() {
  redirect("/calendar");
}
