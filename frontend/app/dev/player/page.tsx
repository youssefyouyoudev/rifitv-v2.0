import { notFound } from "next/navigation";
import { DevPlayerClient } from "./DevPlayerClient";

export default function DevPlayerPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DevPlayerClient />;
}
