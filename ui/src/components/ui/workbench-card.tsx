import { forwardRef } from "react";
import type { PropsWithChildren } from "react";

type WorkbenchCardProps = PropsWithChildren<{
  className?: string;
}>;

export const WorkbenchCard = forwardRef<HTMLElement, WorkbenchCardProps>(function WorkbenchCard(
  { className = "", children },
  ref,
) {
  return (
    <section ref={ref} className={`card section-card ${className}`.trim()}>
      {children}
    </section>
  );
});
