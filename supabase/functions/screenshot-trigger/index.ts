import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const n8nResponse = await fetch(
    'https://jams883895.app.n8n.cloud/webhook/48694722-b68e-4b06-a263-f73f36ed16ca',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
  )

  const data = await n8nResponse.json()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  await fetch(`${supabaseUrl}/rest/v1/screenshot_log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      status:       data.status      ?? 'success',
      timestamp:    data.timestamp   ?? new Date().toISOString(),
      image_base64: data.image_base64 ?? null,
      reason:       data.reason      ?? null,
      pair:         data.pair        ?? null,
    }),
  })

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
