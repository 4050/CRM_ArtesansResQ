import { getDictionary, hasLocale } from '../dictionaries'
import { notFound } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ error?: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)
  const { error } = await searchParams

  return (
    <LoginForm
      lang={lang}
      dict={{
        appName: dict.common.appName,
        appTagline: dict.common.appTagline,
        email: dict.login.email,
        password: dict.login.password,
        submit: dict.login.submit,
        emailPlaceholder: dict.login.emailPlaceholder,
        passwordPlaceholder: dict.login.passwordPlaceholder,
      }}
      initialError={error === 'invite_expired' ? dict.login.inviteExpired : undefined}
    />
  )
}
