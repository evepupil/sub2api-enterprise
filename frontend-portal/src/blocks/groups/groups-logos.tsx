import { ProviderLogoCloud } from '@/components/catalog/provider-logo-cloud';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { useTranslations } from 'next-intl';

import { PROVIDERS } from '@/lib/catalog';

/** 厂商标志墙：所有通道共用同一份模型目录。 */
export function GroupsLogos() {
  const t = useTranslations('groups');

  return (
    <section id="providers" className="py-20 md:py-28">
      <Container>
        <SectionHeading
          title={t('logos.title')}
          subtitle={t('logos.subtitle', { count: PROVIDERS.length })}
        />
        <ProviderLogoCloud className="mt-16" />
      </Container>
    </section>
  );
}

export default GroupsLogos;
