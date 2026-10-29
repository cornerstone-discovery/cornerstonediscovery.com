# FAQPage structured data from the FAQ accordions already on a page, so the questions and answers visitors
# read are the ones search and AI answer engines get as structured data, with nothing to keep in sync.
#
#   <details class="faq"><summary>Question</summary><div class="faq-body">Answer HTML</div></details>
#
# Runs after layouts, on the final HTML, and adds one JSON-LD block before </head>. Skipped while a build shows
# both copy versions (local / preview), where a page holds two sets of FAQs.
require "cgi"
require "json"

module FaqSchema
  # Named entities the copy uses that CGI.unescapeHTML leaves as-is (it only knows &amp; &lt; &gt; &quot; &apos;).
  TYPOGRAPHY = { "rsquo" => "’", "lsquo" => "‘", "rdquo" => "”", "ldquo" => "“", "mdash" => "—",
                 "ndash" => "–", "hellip" => "…", "nbsp" => " " }.freeze
  ITEM = %r{<details class="faq"[^>]*>\s*<summary>(.*?)</summary>\s*<div class="faq-body">(.*?)</div>\s*</details>}m

  def self.text(html)
    html = html.gsub(%r{</li>\s*</[uo]l>}i, ". ").gsub(%r{</li>}i, "; ").gsub(%r{</(p|h\d)>}i, "\\0 ")
    html = html.gsub(/&(\w+);/) { |e| TYPOGRAPHY.fetch(Regexp.last_match(1), e) }
    CGI.unescapeHTML(html.gsub(/<[^>]+>/, "")).gsub(/\s+/, " ").gsub(/([.;:])\s*\./, "\\1").strip
  end

  def self.block(doc)
    items = doc.output.scan(ITEM).map do |q, a|
      { "@type" => "Question", "name" => text(q),
        "acceptedAnswer" => { "@type" => "Answer", "text" => text(a) } }
    end
    return if items.empty?
    data = { "@context" => "https://schema.org", "@type" => "FAQPage",
             "url" => doc.site.config["url"].to_s + doc.site.baseurl.to_s + doc.url, "mainEntity" => items }
    %(<script type="application/ld+json">#{JSON.generate(data).gsub("</", "<\\/")}</script>\n)
  end
end

Jekyll::Hooks.register [:pages, :documents], :post_render do |doc|
  next if doc.site.config["versions_both"] || doc.output_ext != ".html" || !doc.output.include?('class="faq"')
  script = FaqSchema.block(doc) or next
  doc.output = doc.output.sub("</head>", "#{script}</head>")
end
