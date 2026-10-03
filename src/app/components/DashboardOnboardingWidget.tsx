import { useEffect, useMemo, useState } from 'react';
import { Rocket, Check, X, FileText, UserPlus, HandCoins } from 'lucide-react';
import { Chanda } from '../App';
import { EventInfo, ReceiptSettings } from '../lib/db';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardOnboardingWidgetProps {
  activeEvent?: EventInfo | null;
  chandaList: Chanda[];
  receiptSettings?: ReceiptSettings;
  onNavigateToReceiptSettings?: () => void;
  onNavigateToAddDonor?: () => void;
  onNavigateToCollection?: () => void;
}

export function DashboardOnboardingWidget({
  activeEvent,
  chandaList,
  receiptSettings,
  onNavigateToReceiptSettings,
  onNavigateToAddDonor,
  onNavigateToCollection,
}: DashboardOnboardingWidgetProps) {
  const { t } = useLanguage();

  // Storage keys scoped per festival/puja event so each edition can track onboarding
  const eventId = activeEvent?.id || 'default';
  const DISMISS_KEY = `puja_onboarding_dismissed_${eventId}`;
  const COMPLETED_AT_KEY = `puja_onboarding_completed_at_${eventId}`;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Step 1: Add a festival — sensed from backend activeEvent / events
  const hasFestival = Boolean(activeEvent);

  // Step 2: Design receipt — sensed from saved receipt_settings or local customization
  const hasReceiptDesign = Boolean(
    receiptSettings?.id ||
    (typeof window !== 'undefined' && localStorage.getItem('puja_receipt_designed') === 'true') ||
    Boolean(receiptSettings?.upiId || receiptSettings?.headerTitle || receiptSettings?.signatureUrl || receiptSettings?.customColorHex)
  );

  // Step 3: Added Donor Name — sensed if at least 1 donor exists in collection
  const hasDonor = chandaList.length > 0;

  // Step 4: Start Collecting — sensed if at least 1 payment status is 'paid'
  const hasPaidCollection = chandaList.some(c => c.paymentStatus === 'paid');

  const completedCount =
    (hasFestival ? 1 : 0) +
    (hasReceiptDesign ? 1 : 0) +
    (hasDonor ? 1 : 0) +
    (hasPaidCollection ? 1 : 0);

  const allCompleted = completedCount === 4;

  // When all 4 tasks are completed, record completion timestamp once
  useEffect(() => {
    if (allCompleted) {
      try {
        const existing = localStorage.getItem(COMPLETED_AT_KEY);
        if (!existing) {
          localStorage.setItem(COMPLETED_AT_KEY, String(Date.now()));
        }
      } catch {}
    }
  }, [allCompleted, COMPLETED_AT_KEY]);

  // Check if 24 hours have passed since all 4 steps were completed
  const isExpiredAfterCompletion = useMemo(() => {
    if (!allCompleted) return false;
    try {
      const stored = localStorage.getItem(COMPLETED_AT_KEY);
      if (!stored) return false;
      const elapsedMs = Date.now() - Number(stored);
      return elapsedMs >= 24 * 60 * 60 * 1000; // 24 hours
    } catch {
      return false;
    }
  }, [allCompleted, COMPLETED_AT_KEY]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {}
    setDismissed(true);
  };

  if (dismissed || isExpiredAfterCompletion) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs transition-all relative overflow-hidden">
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Rocket size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate">
              {t('dashboard.onboarding.title')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {t('dashboard.onboarding.subtitle')} •{' '}
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {completedCount} of 4 done
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          title={t('dashboard.onboarding.dismiss')}
          aria-label={t('dashboard.onboarding.dismiss')}
        >
          <span>{t('dashboard.onboarding.dismiss')}</span>
          <X size={14} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-3.5">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(completedCount / 4) * 100}%` }}
        />
      </div>

      {/* 4 Interactive Step Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Step 1: Add a festival */}
        <div className="rounded-xl p-3.5 border transition-all flex flex-col justify-between bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check size={13} strokeWidth={3} />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('dashboard.onboarding.step1Title')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-7 leading-relaxed">
              {t('dashboard.onboarding.step1Desc')}
            </p>
          </div>
          <div className="pl-7 mt-2.5">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check size={11} strokeWidth={2.5} /> {t('dashboard.onboarding.completed')}
            </span>
          </div>
        </div>

        {/* Step 2: Design your receipt */}
        <div
          onClick={() => !hasReceiptDesign && onNavigateToReceiptSettings?.()}
          className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
            hasReceiptDesign
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-500/40 cursor-pointer group shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              {hasReceiptDesign ? (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check size={13} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <FileText size={12} />
                </div>
              )}
              <span
                className={`text-sm font-semibold transition-colors ${
                  hasReceiptDesign
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400'
                }`}
              >
                {t('dashboard.onboarding.step2Title')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-7 leading-relaxed">
              {t('dashboard.onboarding.step2Desc')}
            </p>
          </div>
          <div className="pl-7 mt-2.5">
            {hasReceiptDesign ? (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={11} strokeWidth={2.5} /> {t('dashboard.onboarding.completed')}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToReceiptSettings?.();
                }}
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
              >
                {t('dashboard.onboarding.step2Action')}
              </button>
            )}
          </div>
        </div>

        {/* Step 3: Added Donor Name */}
        <div
          onClick={() => !hasDonor && onNavigateToAddDonor?.()}
          className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
            hasDonor
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-500/40 cursor-pointer group shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              {hasDonor ? (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check size={13} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <UserPlus size={12} />
                </div>
              )}
              <span
                className={`text-sm font-semibold transition-colors ${
                  hasDonor
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400'
                }`}
              >
                {t('dashboard.onboarding.step3Title')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-7 leading-relaxed">
              {t('dashboard.onboarding.step3Desc')}
            </p>
          </div>
          <div className="pl-7 mt-2.5">
            {hasDonor ? (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={11} strokeWidth={2.5} /> {t('dashboard.onboarding.completed')}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToAddDonor?.();
                }}
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
              >
                {t('dashboard.onboarding.step3Action')}
              </button>
            )}
          </div>
        </div>

        {/* Step 4: Start Collecting */}
        <div
          onClick={() => !hasPaidCollection && onNavigateToCollection?.()}
          className={`rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
            hasPaidCollection
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-500/40 cursor-pointer group shadow-2xs'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              {hasPaidCollection ? (
                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Check size={13} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <HandCoins size={12} />
                </div>
              )}
              <span
                className={`text-sm font-semibold transition-colors ${
                  hasPaidCollection
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400'
                }`}
              >
                {t('dashboard.onboarding.step4Title')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-7 leading-relaxed">
              {t('dashboard.onboarding.step4Desc')}
            </p>
          </div>
          <div className="pl-7 mt-2.5">
            {hasPaidCollection ? (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={11} strokeWidth={2.5} /> {t('dashboard.onboarding.completed')}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToCollection?.();
                }}
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
              >
                {t('dashboard.onboarding.step4Action')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
