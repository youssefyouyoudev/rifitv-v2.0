"use client";

import Link from "next/link";
import type { LinkProps } from "next/link";
import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

type Props = LinkProps & {
  children: ReactNode;
  className?: string;
  eventName: string;
  eventPayload?: Record<string, string | number | boolean | null | undefined>;
};

export function TrackedLink({ children, className, eventName, eventPayload, ...props }: Props) {
  return (
    <Link
      {...props}
      className={className}
      onClick={() => trackEvent(eventName, eventPayload)}
    >
      {children}
    </Link>
  );
}
