import { handleRankingRequest } from './handler.mjs';

Deno.serve(request => handleRankingRequest(request, {
  TURNSTILE_SECRET_KEY: Deno.env.get('TURNSTILE_SECRET_KEY'),
  TURNSTILE_ALLOWED_HOSTNAMES: Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES'),
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
