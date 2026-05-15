Rails.application.config.after_initialize do
  # Skip during Docker image build (asset precompile) — DB isn't reachable.
  # The Dockerfile sets SECRET_KEY_BASE=precompile_placeholder during that step.
  next if ENV['SECRET_KEY_BASE'] == 'precompile_placeholder'

  # Defensive: also skip if connection fails for any reason (CI, schema dump,
  # rake routes without DB, etc.).
  begin
    next unless ActiveRecord::Base.connection.table_exists?('installation_configs')
  rescue ActiveRecord::ConnectionNotEstablished, ActiveRecord::NoDatabaseError
    next
  end

  branding = {
    'INSTALLATION_NAME' => 'Cognis Support',
    'BRAND_NAME' => 'Cognis Support',
    'BRAND_URL' => 'https://cognisai.com',
    'WIDGET_BRAND_URL' => 'https://cognisai.com',
    'LOGO' => '/brand-assets/cognis-logo.svg',
    'LOGO_DARK' => '/brand-assets/cognis-logo-dark.svg',
    'LOGO_THUMBNAIL' => '/brand-assets/cognis-thumbnail.svg',
    'TERMS_URL' => 'https://cognisai.com/terms',
    'PRIVACY_URL' => 'https://cognisai.com/privacy'
  }
  branding.each { |k, v| InstallationConfig.find_or_create_by(name: k).update(value: v) }
end
