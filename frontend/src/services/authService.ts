// Auth service - handles authentication with dynamic host detection

// Base URL for API - uses environment variable or defaults to current host
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // For network access: use current hostname with backend port
  // This allows access from other machines on the same network
  return `http://${window.location.hostname}:8000`
}

export const authService = {
  login: async (username: string, password: string) => {
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)
    
    const baseUrl = getApiBaseUrl()
    const response = await fetch(`${baseUrl}/api/v1/auth/login/access-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
  },
}
