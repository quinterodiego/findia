'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Users, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import AuthModal from '@/components/AuthModal'
import { buildInvitationReturnPath } from '@/lib/sharedGroupInvitationClient'

type Outcome = 'idle' | 'loading' | 'accepted' | 'rejected' | 'error'

/**
 * Mapea la respuesta de accept/reject a un mensaje entendible, sin lenguaje
 * técnico. Los 409 (invitación ya resuelta) llegan con un mensaje del
 * backend que ya es seguro de mostrar tal cual — a esa altura el token y el
 * email de sesión ya se validaron server-side, así que revelar "ya fue
 * aceptada/rechazada/cancelada" no es un oráculo para nadie sin el token.
 */
function friendlyInvitationError(status: number, rawMessage?: string): string {
  if (status === 403) return 'Esta invitación fue enviada a otra cuenta.'
  if (status === 404) return 'No encontramos esta invitación. Puede que el enlace ya no sea válido.'
  if (status === 409 && rawMessage) return rawMessage
  if (status === 429 || status >= 500) {
    return 'No pudimos procesar tu invitación en este momento. Intentá nuevamente en unos segundos.'
  }
  return rawMessage || 'No pudimos procesar la invitación.'
}

export default function SharedGroupInvitationPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status } = useSession()

  const invitationId = params.id
  const [token, setToken] = useState<string | null>(null)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | null>(null)
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [wasWrongAccount, setWasWrongAccount] = useState(false)

  // Captura el token de la URL una sola vez, lo guarda en sessionStorage
  // (efímero — nunca localStorage/cookies) y lo saca de la URL visible de
  // inmediato. Si se recarga la página sin el query param (ej. volviendo de
  // un login), lo recupera de sessionStorage.
  useEffect(() => {
    const storageKey = `shared-group-invitation-token:${invitationId}`
    const urlToken = searchParams.get('token')
    if (urlToken) {
      setToken(urlToken)
      try {
        sessionStorage.setItem(storageKey, urlToken)
      } catch {
        // sessionStorage puede no estar disponible (modo privado, etc.) —
        // no es crítico, el token ya quedó en memoria para esta carga.
      }
      router.replace(`/shared-group-invitation/${invitationId}`)
    } else {
      try {
        const stored = sessionStorage.getItem(storageKey)
        if (stored) setToken(stored)
      } catch {
        // no-op
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationId])

  async function respond(action: 'accept' | 'reject') {
    if (!token) return
    setOutcome('loading')
    setErrorMessage(null)
    setWasWrongAccount(false)
    try {
      const res = await fetch(`/api/shared-group-invitations/${invitationId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOutcome('error')
        setWasWrongAccount(res.status === 403)
        setErrorMessage(friendlyInvitationError(res.status, data.error))
        // NO se limpia el token acá -- 403/404/409/429/5xx pueden ser
        // transitorios (429/5xx) o el usuario puede querer reintentar tras
        // cambiar de cuenta (403); solo un accept/reject EXITOSO consume el
        // token (ver abajo).
        return
      }
      // Estado terminal alcanzado con éxito: el token de ESTA invitación ya
      // no sirve para nada más -- se limpia de sessionStorage.
      try {
        sessionStorage.removeItem(`shared-group-invitation-token:${invitationId}`)
      } catch {
        // no-op
      }
      setOutcome(action === 'accept' ? 'accepted' : 'rejected')
    } catch {
      setOutcome('error')
      setErrorMessage('No pudimos procesar la invitación. Intentá de nuevo en unos segundos.')
    }
  }

  function handleSwitchAccount() {
    const returnPath = buildInvitationReturnPath(invitationId)
    const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}${returnPath}` : returnPath
    signOut({ callbackUrl: returnUrl })
  }

  const isLoadingSession = status === 'loading'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700 p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-[#FF007A]" />
        </div>

        {isLoadingSession ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !token ? (
          <>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No pudimos recuperar esta invitación.</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Verificá el link que recibiste por email.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-xl font-semibold text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              style={{ minHeight: 44 }}
            >
              Volver al inicio
            </button>
          </>
        ) : outcome === 'accepted' ? (
          <>
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">¡Listo! Ya sos parte del grupo.</h1>
            <button
              onClick={() => router.push('/dashboard?open=shared-groups')}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 transition-opacity cursor-pointer"
              style={{ minHeight: 44 }}
            >
              Ir a Gastos compartidos
            </button>
          </>
        ) : outcome === 'rejected' ? (
          <>
            <XCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Rechazaste la invitación.</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              style={{ minHeight: 44 }}
            >
              Ir a FindIA
            </button>
          </>
        ) : status === 'unauthenticated' ? (
          <>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Te invitaron a compartir gastos</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Iniciá sesión o creá una cuenta en FindIA para ver la invitación.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => setAuthModalMode('login')}
                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 transition-opacity cursor-pointer"
                style={{ minHeight: 44 }}
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => setAuthModalMode('register')}
                className="w-full py-3 rounded-xl font-semibold text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                style={{ minHeight: 44 }}
              >
                Crear cuenta
              </button>
            </div>
            <AuthModal
              isOpen={authModalMode !== null}
              onClose={() => setAuthModalMode(null)}
              initialMode={authModalMode || 'login'}
              callbackUrl={buildInvitationReturnPath(invitationId)}
            />
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Te invitaron a compartir gastos</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Podés compartir gastos, ver cuánto debe cada persona y registrar pagos desde FindIA.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-left">
                <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
                {wasWrongAccount && (
                  <button
                    onClick={handleSwitchAccount}
                    className="mt-2 text-sm font-medium text-red-700 dark:text-red-400 underline cursor-pointer"
                  >
                    Cerrar sesión e ingresar con otra cuenta
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => respond('accept')}
                disabled={outcome === 'loading'}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ minHeight: 44 }}
              >
                {outcome === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Aceptar'}
              </button>
              <button
                onClick={() => respond('reject')}
                disabled={outcome === 'loading'}
                className="w-full py-3 rounded-xl font-semibold text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ minHeight: 44 }}
              >
                Rechazar
              </button>
            </div>

            {!wasWrongAccount && (
              <button
                onClick={handleSwitchAccount}
                className="mt-4 text-xs text-gray-400 dark:text-gray-500 underline cursor-pointer"
              >
                ¿No sos vos? Cerrar sesión
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
