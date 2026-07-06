export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-gray-900 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-[#FF3A5F] to-[#FF007A] flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a9 9 0 000 12.728M9.172 9.172a5 5 0 000 7.072M12 12h.01" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sin conexión</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">
        No hay internet en este momento. Tus datos guardados siguen disponibles cuando vuelva la conexión.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-gradient-to-r from-[#FF3A5F] to-[#FF007A] text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
      >
        Reintentar
      </button>
    </div>
  );
}
