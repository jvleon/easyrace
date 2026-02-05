import { useEffect } from 'react'
import * as Sentry from '@sentry/react'

declare global {
  interface Window {
    __sentryInitialized?: boolean
  }
}

const initSentry = () => {
  if (typeof window === 'undefined' || window.__sentryInitialized) {
    return
  }

  Sentry.init({
    dsn: 'https://56942e3edd1586a6bbb5a04c9a60ead5@o4510734822735872.ingest.us.sentry.io/4510734833352704',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    // Enable logs to be sent to Sentry
    enableLogs: true,
  })

  window.__sentryInitialized = true
}

const SentryInit = () => {
  useEffect(() => {
    initSentry()
  }, [])

  return null
}

export default SentryInit
