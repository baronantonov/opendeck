import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { AbstractGeometryBg } from '../LiquidGlassGeometry';

export interface CourseTeaserCardProps {
  title: string;
  description: string;
  tags: string[];
  accent: 'mauve' | 'coral';
  icon: ReactNode;
  isShaking: boolean;
  onClick: () => void;
}

export function CourseTeaserCard({
  title,
  description,
  tags,
  accent,
  icon,
  isShaking,
  onClick,
}: CourseTeaserCardProps) {
  const brandVar = accent === 'mauve' ? 'var(--brand-mauve)' : 'var(--brand-coral)';
  const iconTextClass =
    accent === 'mauve' ? 'text-[var(--brand-mauve)]' : 'text-[var(--brand-coral)]';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className="relative w-full cursor-pointer overflow-hidden rounded-3xl p-5 backdrop-blur-2xl backdrop-saturate-150 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_12px_32px_rgba(0,0,0,0.38)] active:scale-[0.97] transition-all duration-200 ease-out transform-gpu"
      style={{
        background: 'color-mix(in srgb, var(--color-surface) 30%, transparent)',
      }}
    >
      <AbstractGeometryBg variant="card" spheres={0} accent={accent} />

      <div className="relative z-10 mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid h-9 w-9 place-items-center rounded-xl ${iconTextClass} shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)]`}
            style={{
              background: `color-mix(in srgb, ${brandVar} 16%, var(--color-surface-2))`,
            }}
          >
            {icon}
          </div>
          <h3 className="m-0 text-lg font-extrabold text-[var(--color-text)]">{title}</h3>
        </div>

        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-[var(--brand-gold)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] ${
            isShaking ? 'animate-badge-shake' : ''
          }`}
          style={{
            background: 'color-mix(in srgb, var(--brand-gold) 14%, var(--color-surface-2))',
          }}
        >
          <Clock size={12} strokeWidth={2.5} />
          <span>В разработке</span>
        </div>
      </div>

      <p className="relative z-10 m-0 mb-3 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
        {description}
      </p>

      <div className="relative z-10 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-xl px-2.5 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
            style={{
              background: 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
