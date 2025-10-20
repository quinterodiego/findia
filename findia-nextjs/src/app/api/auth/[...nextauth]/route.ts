import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { NextAuthOptions } from "next-auth"

// Verificar que las variables de entorno estén configuradas
if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your-google-client-id-here') {
  console.error('❌ GOOGLE_CLIENT_ID no está configurado en .env.local')
}

if (!process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET === 'your-google-client-secret-here') {
  console.error('❌ GOOGLE_CLIENT_SECRET no está configurado en .env.local')
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
      console.log('JWT Callback:', { hasAccount: !!account, hasUser: !!user, tokenSub: token.sub })
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        console.log('Token updated with account data')
      }
      if (user) {
        token.user = user
        console.log('Token updated with user data:', user.email)
      }
      return token
    },
    async session({ session, token }) {
      console.log('Session Callback:', { tokenSub: token.sub, sessionUserEmail: session.user?.email })
      if (token.accessToken) {
        session.accessToken = token.accessToken as string
      }
      if (token.user) {
        session.user = token.user as typeof session.user
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      console.log('NextAuth redirect called with:', { url, baseUrl })
      
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
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }