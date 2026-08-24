import { getDictionary, hasLocale } from '../dictionaries'
import { notFound } from 'next/navigation'
import SetPasswordForm from './SetPasswordForm'

export default async function SetPasswordPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

  return (
    <SetPasswordForm
      lang={lang}
      dict={{
        appName: dict.common.appName,
        appTagline: dict.common.appTagline,
        title: dict.setPassword.title,
        subtitle: dict.setPassword.subtitle,
        password: dict.setPassword.password,
        confirmPassword: dict.setPassword.confirmPassword,
        submit: dict.setPassword.submit,
        passwordPlaceholder: dict.login.passwordPlaceholder,
        passwordsDontMatch: dict.setPassword.passwordsDontMatch,
      }}
    />
  )
}
