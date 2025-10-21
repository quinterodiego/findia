import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { NextAuthOptions } from "next-auth"

// Verificar que las variables de entorno estén configuradas
const requiredEnvVars = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL
}

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value || value === 'your-google-client-id-here' || value === 'your-google-client-secret-here')
  .map(([key]) => key)

if (missingVars.length > 0 && process.env.NODE_ENV !== 'production') {
  console.warn('Missing environment variables:', missingVars)
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets",
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        },
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      if (user) {
        token.user = user
      }
      return token
    },
    async session({ session, token }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken as string
      }
      if (token.user) {
        session.user = token.user as typeof session.user
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      try {
        // For OAuth callback URLs, redirect to dashboard
        if (url.includes('/api/auth/callback')) {
          return `${baseUrl}/dashboard`
        }
        
        // If it's a relative URL starting with /, use it
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`
        }
        
        // If URL is from the same origin, allow it
        if (new URL(url).origin === baseUrl) {
          return url
        }
        
        // Default: redirect to dashboard
        return `${baseUrl}/dashboard`
      } catch {
        // Fallback to dashboard if anything fails
        return `${baseUrl}/dashboard`
      }
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }