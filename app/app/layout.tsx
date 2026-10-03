import { PilotShell } from "@/components/pilot/shell";
import type { ReactNode } from "react";

export const metadata = {
  title: "SnapDispatch technical checkpoint",
  description: "Synthetic staging workflow. Not live-customer ready. Driver-pay calculations are disabled.",
};

export default function PilotLayout({ children }: { children: ReactNode }) {
  return <PilotShell>{children}</PilotShell>;
}
