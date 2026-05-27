# frozen_string_literal: true

class LazadaChat::ChatwootCallbackProxyController < ApplicationController
  skip_before_action :verify_authenticity_token, raise: false

  def create
    adapter_url = ENV.fetch('ADAPTER_LAZADA_PUBLIC_URL', 'http://localhost:3002')
    Faraday.post(
      "#{adapter_url}/internal/chatwoot-callback",
      request.raw_post,
      'Content-Type' => 'application/json'
    )
  rescue StandardError => e
    Rails.logger.error("LazadaChat chatwoot callback proxy error: #{e.message}")
  ensure
    head :ok
  end
end
