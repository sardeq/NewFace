import { HAS_SUPABASE } from '../config'
import type { Api } from './api'
import { MockApi } from './mock/mockApi'
import { SupabaseApi } from './supabaseApi'

export const api: Api = HAS_SUPABASE ? new SupabaseApi() : new MockApi()
export const mockApi = api instanceof MockApi ? api : null
