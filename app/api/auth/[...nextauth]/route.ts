import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { verifyCredentials } from "@/lib/googleSheets"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        try {
          const user = await verifyCredentials(credentials.email, credentials.password);
          if (!user) return null;
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error('Error en autenticación:', error);
          return null;
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets",
          access_type: "offline",
          response_type: "code"
          // prompt: "consent"  // Comentado para que Google recuerde la sesión
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // ============================================
      // 🛡️ CONFIGURACIÓN DE SEGURIDAD / ACCESO
      // ============================================
      // Por defecto, cualquier usuario con Google puede entrar
      // Para restringir el acceso, descomenta y configura una de las opciones:
      
      // ========== OPCIÓN 1: Solo emails específicos ==========
      // const allowedEmails = ['tu.email@ejemplo.com'];
      // if (allowedEmails.length > 0 && user.email && !allowedEmails.includes(user.email)) {
      //   return false; // Rechaza el login
      // }
      
      // ========== OPCIÓN 2: Solo dominio específico ==========
      // Ejemplo: '@tuempresa.com' o '@gmail.com'
      // const allowedDomains = ['gmail.com', 'tuempresa.com'];
      // if (allowedDomains.length > 0 && user.email) {
      //   const emailDomain = user.email.split('@')[1];
      //   if (!allowedDomains.includes(emailDomain)) {
      //     return false; // Rechaza el login
      //   }
      // }
      
      // Si llegaste aquí, permite el login
      return true;
    },
    async jwt({ token, account, user }) {
      if (account) {
        // Solo Google OAuth tiene tokens de acceso
        if (account.provider === 'google') {
          token.accessToken = account.access_token
          token.refreshToken = account.refresh_token
        }
      }
      if (user) {
        token.id = user.id
        token.user = user
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.accessToken = token.accessToken as string
      }
      if (token.user) {
        session.user = token.user as typeof session.user
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful login
      if (url.startsWith("/")) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      return `${baseUrl}/dashboard`
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
