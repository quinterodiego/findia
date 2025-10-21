"use client"

import { SessionProvider } from "next-auth/react"

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    return (
      <SessionProvider>
        {children}
      </SessionProvider>
    )
  } catch (error) {
    console.error('Providers error:', error)
    // Fallback sin providers si hay error
    return <div>{children}</div>
  }
}