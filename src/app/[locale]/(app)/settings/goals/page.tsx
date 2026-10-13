import { redirect } from '@/i18n/navigation';

export default async function SettingsGoalsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/money/goals', locale });
}
