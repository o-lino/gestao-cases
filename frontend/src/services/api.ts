
import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios'

// Base URL for API - uses environment variable or defaults to current host
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api/v1`
  }
  // For network access: use current hostname with backend port
  // This allows access from other machines on the same network
  return `http://${window.location.hostname}:8000/api/v1`
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Redirect to login on authentication/authorization errors
    // 401 = Unauthorized (not logged in)
    // 403 = Forbidden (token expired or invalid)
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token')
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
