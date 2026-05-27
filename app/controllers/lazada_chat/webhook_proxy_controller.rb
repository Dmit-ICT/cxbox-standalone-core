# frozen_string_literal: true

class LazadaChat::WebhookProxyController < ApplicationController
  skip_before_action :verify_authenticity_token, raise: false

  def create
    Rails.logger.info("[LazadaWebhook] #{JSON.pretty_generate(JSON.parse(request.raw_post))}") if request.raw_post.present?
    adapter_url = ENV.fetch('ADAPTER_LAZADA_PUBLIC_URL', 'http://localhost:3002')
    Faraday.post(
      "#{adapter_url}/webhooks/lazada",
      request.raw_post,
      'Content-Type' => 'application/json'
    )
  rescue StandardError => e
    Rails.logger.error("LazadaChat webhook proxy error: #{e.message}")
  ensure
    head :ok
  end
end
