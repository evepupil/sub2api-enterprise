import { getProvider, type ProviderId } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/** 厂商标志。单色标志（如 OpenAI）在暗色主题下自动反色。 */
export function ProviderLogo({
  provider,
  size = 20,
  className,
}: {
  provider: ProviderId;
  size?: number;
  className?: string;
}) {
  const { logo, name, mono } = getProvider(provider);
  return (
    <img
      src={logo}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 select-none', mono && 'dark:invert', className)}
    />
  );
}
