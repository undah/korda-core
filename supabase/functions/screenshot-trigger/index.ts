import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RAILWAY_URL = 'https://trading-bot-production-4c10.up.railway.app'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    const configRes = await fetch(
      `${supabaseUrl}/rest/v1/screenshot_config?order=updated_at.desc&limit=1`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const configs = await configRes.json()
    const pairs: string[] = configs[0]?.pairs?.length > 0 ? configs[0].pairs : ['EURUSD']

    const results = await Promise.all(pairs.map(async (pair: string) => {
      try {
        const railwayRes = await fetch(`${RAILWAY_URL}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pair }),
        })
        const data = await railwayRes.json()

        await fetch(`${supabaseUrl}/rest/v1/screenshot_log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            status: data.status ?? 'success',
            timestamp: data.timestamp ?? new Date().toISOString(),
            image_base64: data.image_base64 ?? null,
            reason: data.reason ?? null,
            pair: data.pair ?? pair,
          }),
        })

        return { pair, status: 'success' }
      } catch (err) {
        return { pair, status: 'error', reason: String(err) }
      }
    }))

    return new Response(JSON.stringify({ status: 'success', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', reason: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
