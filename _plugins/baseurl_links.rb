# Prefix root-relative href/src/poster/action/url() with site.baseurl when the site is served from a
# sub-path (the github.io preview, before the custom domain is attached). Content ported from WordPress
# links as "/digital-forensics/", which would otherwise escape the sub-path.
# No-op when baseurl is empty, i.e. on cornerstonediscovery.com.
module BaseurlLinks
  def self.rewrite(html, base)
    already = Regexp.escape(base.sub(%r{\A/}, "")) + "(?:/|$)"
    html
      .gsub(%r{(\s(?:href|src|poster|action)=["'])/(?!/|#{already})}) { "#{Regexp.last_match(1)}#{base}/" }
      .gsub(%r{(url\(["']?)/(?!/|#{already})}) { "#{Regexp.last_match(1)}#{base}/" }
  end
end

Jekyll::Hooks.register [:pages, :documents], :post_render do |doc|
  base = doc.site.config["baseurl"].to_s.chomp("/")
  next if base.empty?
  next unless doc.output_ext.to_s =~ /\A\.html?\z/

  doc.output = BaseurlLinks.rewrite(doc.output, base)
end
