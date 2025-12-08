import api from './api'

export const authService = {
  login: async (username, password) => {
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', password)
    
    const response = await fetch('http://localhost:8000/api/v1/auth/login/access-token', {
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
