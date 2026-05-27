# In development, CRL distribution point checks fail for certs from some CAs (e.g. ngrok).
# Disabling SSL verification for SafeFetch requests is acceptable in dev-only environments.
if Rails.env.development?
  require 'openssl'

  # Disable SSL certificate verification for SafeFetch in development only.
  # CRL distribution-point checks fail for some CA chains (e.g. ngrok) on this machine.
  # `to_prepare` re-applies on every code reload so the patch survives hot-reloads.
  ActiveSupport::Reloader.to_prepare do
    require 'safe_fetch'
    require 'safe_fetch/request_options'
    require 'safe_fetch/fetcher'

    SafeFetch::RequestOptions.define_method(:request_options) do
      {
        headers: headers,
        body: body,
        request_proc: send(:request_proc),
        sensitive_headers: send(:sensitive_headers),
        http_options: {
          open_timeout: open_timeout,
          read_timeout: read_timeout,
          verify_mode: OpenSSL::SSL::VERIFY_NONE
        }
      }
    end
  end
end
