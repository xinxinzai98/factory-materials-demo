import axios, { InternalAxiosRequestConfig } from 'axios'

let API_BASE = localStorage.getItem('apiBase') || '/api'
let API_KEY = localStorage.getItem('apiKey') || 'dev-api-key'

export const setApiBase = (base: string) => {
  API_BASE = base
  localStorage.setItem('apiBase', base)
  api.defaults.baseURL = base
}
export const setApiKey = (key: string) => { API_KEY = key; localStorage.setItem('apiKey', key) }

export const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers = config.headers || {}
  config.headers['X-API-Key'] = API_KEY
  const token = localStorage.getItem('token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  config.baseURL = API_BASE
  return config
})

export function parseJwt(token: string): any | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  const data = parseJwt(token)
  if (!data?.exp) return false
  return Date.now() >= data.exp * 1000
}
