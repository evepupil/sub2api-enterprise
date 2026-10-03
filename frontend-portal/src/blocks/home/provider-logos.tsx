import { ProviderLogoCloud } from '@/components/catalog/provider-logo-cloud';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { PROVIDERS } from '@/lib/catalog';
import { useTranslations } from 'next-intl';

/** H3 厂商标志：标题 + 共享的标志轮换组件，交互全部由共享组件负责。 */
export function ProviderLogos() {
  const t = useTranslations('homeShowcase.providers');

  return (
    <section id="providers" className="py-20 md:py-28">
      <Container>
        <SectionHeading title={t('title')} subtitle={t('subtitle', { count: PROVIDERS.length })} />
        <ProviderLogoCloud className="mt-16" />
      </Container>
    </section>
  );
}

export default ProviderLogos;
