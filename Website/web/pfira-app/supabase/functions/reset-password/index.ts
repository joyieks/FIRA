// Supabase Edge Function to securely reset user passwords
// Now with auto-create auth account if missing!

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, newPassword, verificationCode, userTable } = await req.json()

    // Validate inputs
    if (!email || !newPassword || !verificationCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the code is valid
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('password_reset_codes')
      .select('*')
      .eq('email', email)
      .eq('code', verificationCode)
      .single()

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if code has expired
    const expiresAt = new Date(codeData.expires_at)
    if (new Date() > expiresAt) {
      return new Response(
        JSON.stringify({ error: 'Verification code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the user's data from their user table
    const { data: userData, error: userError } = await supabaseAdmin
      .from(userTable)
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let authUserId = userData.user_id

    // If user doesn't have an auth account, create one
    if (!authUserId) {
      console.log('User has no auth account, creating one...')
      
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          created_via: 'password_reset',
          user_table: userTable
        }
      })

      if (createError) {
        console.error('Error creating auth user:', createError)
        return new Response(
          JSON.stringify({ error: 'Failed to create auth account', details: createError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      authUserId = newAuthUser.user.id

      // Link the new auth user to the user table
      const { error: linkError } = await supabaseAdmin
        .from(userTable)
        .update({ 
          user_id: authUserId,
          updated_at: new Date().toISOString()
        })
        .eq('email', email)

      if (linkError) {
        console.error('Error linking auth user:', linkError)
      }

      console.log('✅ Auth account created and linked:', authUserId)
    } else {
      // User already has auth account, just update password
      console.log('Updating existing auth account password...')
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: newPassword }
      )

      if (updateError) {
        console.error('Error updating password:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update password', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('✅ Password updated for existing auth account')
    }

    // Delete the used verification code
    await supabaseAdmin
      .from('password_reset_codes')
      .delete()
      .eq('email', email)

    // Update the user's updated_at timestamp
    await supabaseAdmin
      .from(userTable)
      .update({ updated_at: new Date().toISOString() })
      .eq('email', email)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully',
        user_id: authUserId,
        auth_created: !userData.user_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in reset-password function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
