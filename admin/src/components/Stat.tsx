export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="order-card !p-4">
      <div className="mb-1 text-xs font-medium text-muted">{label}</div>
      <div className="text-lg font-bold text-ink">{value}</div>
    </div>
  );
}
