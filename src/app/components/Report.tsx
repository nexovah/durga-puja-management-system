import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';

// Placeholder page — reserved for future reporting features.
export function Report() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <PageHeading>{t('report.pageTitle')}</PageHeading>
      <div className="bg-white dark:bg-gray-900 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
        {t('report.comingSoon')}
      </div>
    </div>
  );
}
