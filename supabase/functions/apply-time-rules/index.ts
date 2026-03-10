import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch active time rules
    const { data: rules, error: rulesError } = await supabase
      .from('status_time_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No active rules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalChanged = 0;

    for (const rule of rules) {
      // Calculate the cutoff time
      const limitMs = rule.time_unit === 'hours'
        ? rule.time_limit * 60 * 60 * 1000
        : rule.time_limit * 60 * 1000;

      const cutoff = new Date(Date.now() - limitMs).toISOString();

      // Find winners in from_status that have been there since before cutoff
      // We need to find winners whose last status change was before the cutoff
      const { data: winners, error: winnersError } = await supabase
        .from('winners')
        .select('id')
        .eq('status', rule.from_status)
        .is('deleted_at', null);

      if (winnersError) {
        console.error(`Error fetching winners for rule ${rule.name}:`, winnersError);
        continue;
      }

      if (!winners || winners.length === 0) continue;

      const winnerIds = winners.map((w: any) => w.id);

      // Check which of these winners have their latest status history entry before cutoff
      // We need to do this in batches to avoid query limits
      const eligibleIds: string[] = [];

      for (let i = 0; i < winnerIds.length; i += 100) {
        const batch = winnerIds.slice(i, i + 100);
        const { data: historyData, error: histError } = await supabase
          .from('winner_status_history')
          .select('winner_id, created_at')
          .in('winner_id', batch)
          .order('created_at', { ascending: false });

        if (histError) {
          console.error('Error fetching history:', histError);
          continue;
        }

        // Get most recent per winner
        const latestByWinner: Record<string, string> = {};
        (historyData || []).forEach((h: any) => {
          if (!latestByWinner[h.winner_id]) {
            latestByWinner[h.winner_id] = h.created_at;
          }
        });

        for (const [wid, lastChange] of Object.entries(latestByWinner)) {
          if (lastChange < cutoff) {
            eligibleIds.push(wid);
          }
        }
      }

      if (eligibleIds.length === 0) continue;

      // Apply status change for eligible winners
      for (const wid of eligibleIds) {
        const { error: updateError } = await supabase
          .from('winners')
          .update({
            status: rule.to_status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wid);

        if (updateError) {
          console.error(`Error updating winner ${wid}:`, updateError);
          continue;
        }

        totalChanged++;
      }

      console.log(`Rule "${rule.name}": ${eligibleIds.length} winners transitioned from ${rule.from_status} to ${rule.to_status}`);
    }

    return new Response(JSON.stringify({ processed: totalChanged, rules: rules.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in apply-time-rules:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
