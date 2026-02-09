import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { getTrackLabel, type DocsTrackId } from '@/lib/docs-track';

type PageVerificationStatusProps = {
  locale: Locale;
  track: DocsTrackId | null;
  docsPath: string;
  counterpartUrl: string | null;
};

export function PageVerificationStatus({
  locale,
  track,
  docsPath,
  counterpartUrl,
}: PageVerificationStatusProps) {
  const labels =
    locale === 'ko'
      ? {
          title: '검증 상태',
          pagePath: '문서 경로',
          track: '트랙',
          docsQuality: '문서 품질 게이트',
          docsBuild: '정적 빌드 검증',
          localePair: '다국어 쌍',
          localePairValue: counterpartUrl ? 'EN/KO 짝 문서 확인됨' : '짝 문서 없음 (검토 필요)',
          qualityValue: 'frontmatter, 링크, EN/KO 쌍 검증 대상',
          buildValue: 'docs CI 빌드 및 타입 생성 대상',
          counterpart: '짝 문서 열기',
        }
      : {
          title: 'Verification Status',
          pagePath: 'Page path',
          track: 'Track',
          docsQuality: 'Docs quality gates',
          docsBuild: 'Static build validation',
          localePair: 'Locale pair',
          localePairValue: counterpartUrl ? 'EN/KO counterpart found' : 'Counterpart missing (needs review)',
          qualityValue: 'Included in frontmatter, link, and EN/KO pair checks',
          buildValue: 'Included in docs CI build and type generation',
          counterpart: 'Open counterpart',
        };

  return (
    <section className="bb-verification" aria-label={labels.title}>
      <h2 className="bb-verification__title">{labels.title}</h2>
      <dl className="bb-verification__grid">
        <div>
          <dt>{labels.pagePath}</dt>
          <dd>{docsPath}</dd>
        </div>
        <div>
          <dt>{labels.track}</dt>
          <dd>{getTrackLabel(locale, track)}</dd>
        </div>
        <div>
          <dt>{labels.docsQuality}</dt>
          <dd>{labels.qualityValue}</dd>
        </div>
        <div>
          <dt>{labels.docsBuild}</dt>
          <dd>{labels.buildValue}</dd>
        </div>
        <div>
          <dt>{labels.localePair}</dt>
          <dd>
            {labels.localePairValue}
            {counterpartUrl ? (
              <>
                {' '}
                <Link href={counterpartUrl}>{labels.counterpart}</Link>
              </>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
