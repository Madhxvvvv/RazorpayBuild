export type PolicyStatus = "allow" | "deny" | "step_up" | "neutral";

const LABELS: Record<PolicyStatus, string> = {
  allow: "Allow",
  deny: "Deny",
  step_up: "Step-up",
  neutral: "Pending",
};

const CLASSES: Record<PolicyStatus, string> = {
  allow: "chip chip-allow",
  deny: "chip chip-deny",
  step_up: "chip chip-stepup",
  neutral: "chip chip-neutral",
};

export function StatusChip({ status, label }: { status: PolicyStatus; label?: string }) {
  return <span className={CLASSES[status]}>{label ?? LABELS[status]}</span>;
}
