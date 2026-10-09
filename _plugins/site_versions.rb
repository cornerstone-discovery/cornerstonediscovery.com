# Site versions: "now" (the copy that is live) and "new" (the nationwide-positioning rewrite), kept side by
# side until one wins. How to work with them: docs/SITE-VERSIONS.md.
#
#   _config.yml   copy_version: now | new    the version a production build publishes
#                 versions.new.*             site-wide settings for the New version (e.g. description)
#   _versions/new/<page path>                the New version of an existing page: front matter that overrides
#                                            the page's own (seo_title, description, heading, h1, ...) and,
#                                            optionally, a whole new body (leave it empty to keep the page's)
#   version: new  (in a page's front matter) a page that exists only in the New version
#
# Production builds publish exactly one version, so their HTML carries no trace of the other. Local builds
# (JEKYLL_ENV=development, or versions_switcher: true) publish both: a page with a New body renders the two
# bodies wrapped in div.v-now / div.v-new, page.versions.new holds the New front matter for the head and
# hero, and the switcher in the corner flips html[data-ver] between them.
require "yaml"

module SiteVersions
  DIR = File.join("_versions", "new")
  FRONT_MATTER = /\A---\s*\r?\n(.*?)\r?\n---\s*\r?\n?(.*)\z/m

  def self.read(path)
    raw = File.read(path, encoding: "UTF-8")
    match = FRONT_MATTER.match(raw) or raise "#{path}: missing front matter"
    data = YAML.safe_load(match[1]) || {}
    [data, match[2]]
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  live = site.config["copy_version"].to_s == "new" ? "new" : "now"
  both = Jekyll.env == "development" || site.config["versions_switcher"] == true
  site.config["versions_both"] = both

  # Pages that belong to one version only.
  site.pages.reject! { |p| p.data["version"] && !both && p.data["version"] != live }

  site.pages.each do |page|
    path = File.join(site.source, SiteVersions::DIR, page.relative_path)
    next unless File.file?(path)

    data, body = SiteVersions.read(path)
    has_body = !body.strip.empty?
    if both
      page.data["versions"] = { "new" => data }
      page.content = %(<div class="v-now">\n#{page.content}\n</div>\n<div class="v-new">\n#{body}\n</div>\n) if has_body
    elsif live == "new"
      page.data.merge!(data)
      page.content = body if has_body
    end
  end

  site.config.merge!(site.config.dig("versions", "new") || {}) if live == "new" && !both
end
