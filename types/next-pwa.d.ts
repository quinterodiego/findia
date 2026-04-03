declare module 'next-pwa' {
  import { NextConfig } from 'next'
  interface PWAConfig {
    dest?: string
    disable?: boolean
    register?: boolean
    scope?: string
    sw?: string
    skipWaiting?: boolean
    runtimeCaching?: object[]
    buildExcludes?: (string | RegExp | ((args: { asset: { name: string }; compilation: unknown }) => boolean))[]
    publicExcludes?: string[]
    fallbacks?: {
      document?: string
      image?: string
      audio?: string
      video?: string
      font?: string
    }
    cacheOnFrontEndNav?: boolean
    reloadOnOnline?: boolean
    customWorkerDir?: string
  }
  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig
  export = withPWA
}
