import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

export function StatsCard({ title, value, icon: Icon, description }: StatsCardProps) {
  return (
    <div className="relative bg-paper border border-stone rounded-lg p-6">
      <div className="absolute top-4 right-4 text-stone">
        <Icon size={20} />
      </div>
      <p className="font-sans text-sm font-medium text-graphite">{title}</p>
      <p className="font-serif text-4xl font-bold text-black mt-1">{value}</p>
      {description && (
        <p className="font-sans text-xs text-graphite mt-1.5">{description}</p>
      )}
    </div>
  );
}
