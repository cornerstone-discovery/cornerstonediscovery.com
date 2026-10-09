# Site versions: Now and New

Two versions of the site's copy live side by side until one wins:

* **Now**: the copy that is live today (1SEO's titles, "PA, NJ, NY & DE" throughout).
* **New**: the nationwide rewrite. Nationwide services drop the state list from titles, headings, descriptions
  and structured data; local services name the region once. Adds the Cell Site Analysis, Expert Witness Testimony
  and Criminal Defense pages and a profile page per forensic examiner.

## Previewing

Any local build (`bundle exec jekyll build` or `serve`, i.e. `JEKYLL_ENV=development`) contains both versions.
A **Site version: Now | New** bar sits in the bottom-right corner; the choice is remembered across pages and
`?ver=now` / `?ver=new` in a URL picks one. **Tags** shows the page's `<title>` and meta description for the
version on screen, with character counts.

Production builds (CI) publish exactly one version, `copy_version` in `_config.yml` (currently `now`), so the
live HTML carries no trace of the other. To preview New as a production build:

```bash
printf 'copy_version: new\n' > _cmp/new.yml
JEKYLL_ENV=production bundle exec jekyll build --config _config.yml,_cmp/new.yml -d _cmp/prod-new
```

## Where things live

| What | Where |
| --- | --- |
| The mechanism | `_plugins/site_versions.rb` |
| New version of an existing page | `_versions/new/<same path>`: front matter that overrides the page's own (`seo_title`, `description`, `heading`, `blurb`, `area_served: us`), plus the whole new body. An empty body keeps the page's own. |
| Pages that exist only in New | front matter `version: new` (`criminal-defense/`, `digital-forensics/cell-site-analysis/`, `digital-forensics/expert-witness-testimony/`, `about-us/<examiner>/`) |
| Site-wide New settings | `versions.new` in `_config.yml` (the business description) |
| Template text that differs | `{% include versioned.html now=... new=... %}` (footer, team-accordion profile links, post bylines) |
| Switcher | `_includes/version-switcher.html`, styles at the end of `_sass/_site.scss` |

## Picking a winner

**New wins:** for each file in `_versions/new/`, copy its front matter keys over the page's and replace the page
body with its body (if it has one); delete `version: new` from the New-only pages; replace each
`versioned.html` include with its `new` text; then delete `_versions/`, the plugin, the switcher and its styles,
`versions`/`copy_version` from `_config.yml`, and this file. Until then, setting `copy_version: new` publishes
New without any of that cleanup.

**Now wins:** delete `_versions/`, the New-only pages, the `profile`/`profile_role` keys in `_data/team.yml`,
and the same mechanism files.
