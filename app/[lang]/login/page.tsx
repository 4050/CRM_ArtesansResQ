import { getDictionary, hasLocale } from '../dictionaries'
import { notFound } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()

  const dict = await getDictionary(lang)

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
    />
  )
}
