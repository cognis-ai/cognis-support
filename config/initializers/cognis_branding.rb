Rails.application.config.after_initialize do
  next unless ActiveRecord::Base.connection.table_exists?('installation_configs')
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
