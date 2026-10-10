import type { Api } from './api'
import { SupabaseApi } from './supabaseApi'

export const api: Api = new SupabaseApi()
