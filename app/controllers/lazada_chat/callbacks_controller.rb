module LazadaChat
  class CallbacksController < ApplicationController
    # Lazada redirects the browser here after the seller authorises the app.
    # URL: GET /authentication-lazada-chat?code=XXX&state=BASE64_JSON
    #
    # state encodes { account_id:, inbox_id: } as base64 JSON, set by the
    # adapter's /internal/setup response and stored by Lazada.vue before redirect.
    def show
      return redirect_to_error('missing_code') if params[:code].blank?
      return redirect_to_error('missing_state') if params[:state].blank?

      state = decode_state(params[:state])
      return redirect_to_error('invalid_state') unless state

      account_id = state['account_id']
      inbox_id   = state['inbox_id']

      exchange_code_for_tokens(params[:code], inbox_id)

      redirect_to "/app/accounts/#{account_id}/settings/inboxes/new/#{inbox_id}/agents",
                  allow_other_host: true
    rescue StandardError => e
      Rails.logger.error("LazadaChat::CallbacksController error: #{e.message}")
      redirect_to_error('server_error')
    end

    private

    def decode_state(raw)
      parsed = JSON.parse(Base64.strict_decode64(raw))
      return nil unless parsed.is_a?(Hash) && parsed['account_id'] && parsed['inbox_id']

      parsed
    rescue StandardError
      nil
    end

    def exchange_code_for_tokens(code, inbox_id)
      adapter_url = ENV.fetch('ADAPTER_LAZADA_PUBLIC_URL')
      secret      = ENV.fetch('ADAPTER_INTERNAL_API_SECRET', '')

      response = Faraday.post(
        "#{adapter_url}/internal/oauth/callback",
        { code: code, inbox_id: inbox_id }.to_json,
        'Content-Type' => 'application/json',
        'X-Internal-Secret' => secret
      )

      return if response.success?

      Rails.logger.error("LazadaChat adapter token exchange failed: #{response.body}")
      raise "Adapter token exchange failed (HTTP #{response.status})"
    end

    def redirect_to_error(error_type)
      redirect_to "/app/login?lazada_error=#{error_type}", allow_other_host: true
    end
  end
end
