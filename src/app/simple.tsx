export default function SimplePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          FindIA - Test Page
        </h1>
        <p className="text-gray-600 mb-8">
          If you can see this, the basic routing is working.
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>Environment: {process.env.NODE_ENV}</p>
          <p>Timestamp: {new Date().toISOString()}</p>
        </div>
      </div>
    </div>
  )
}