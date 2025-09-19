# CHANGELOG

## 2025-09-19

* Revert: remove custom pageviews counter at each page ([#97ecf64](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/97ecf641f89762d567bcbe9a53f68e2318282e96))
* Refactor: optimize CSS, remove multiple font loadings ([#84650d7](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/84650d704a752d35eabc2cea6d77876f26e9795f))
* Refactor: optimize loading time by using `preload` and `preconnect` ([#0a9facc](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/0a9facc325f2a7e94b17f471244a2f03547d79a3))

## 2025-09-18

* Feature: added Plausible analytics instead of Google + self-made solution (hopefully) ([#03753fc](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/03753fcf4520bf50f12ab49cdb60802a8dc3aa72))

## 2025-09-17

* Major release: changing platform from Material for MkDocs to 11ty ([#5a2b5aa](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/5a2b5aaabe699798d2586cb9833c065b2fccf1a8))

## 2025-05-07

* Feature: changed footer for future articles to reply by email ([#e79d172](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/e79d172ca14694757460aeb52408f13a45b5cb1a))
* Fix: removed unnecessary space in footer ([#cc34775](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/cc347751ef985c46621cf3f0a224a0658f0b9eee))

## 2025-04-04

* Feature: added views counter in metadata block on every blog post page ([#c57d695](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/c57d695b99bc4f23d1853910ab445de346130ea2))

## 2025-03-04

* Feature: added horizontal status bar that shows the progress of the page ([#80a975f](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/80a975f59a1874fc4f9a197278ec0b25cb07d0f6))
* Feature: added categories to sort posts by complexity ([#80a975f](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/80a975f59a1874fc4f9a197278ec0b25cb07d0f6))
* Chore: posts with more than 1 image are now organized by subfolers in assets ([#80a975f](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/80a975f59a1874fc4f9a197278ec0b25cb07d0f6))
* Chore: updated script to create a new post ([#80a975f](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/80a975f59a1874fc4f9a197278ec0b25cb07d0f6))
* Chore: updated anchor symbol ([#ca7b661](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/ca7b6616ddf021ab6e6ec35657a0593245c72b86))
* Feature: added page view counter on each page ([#99ec073](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/99ec073e954e4856efa5cdb0349609fe73730a2f))

## 2025-02-24

* Feature: removing calls to Google Fonts API by accessing local fonts ([#1c75236](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/1c752360bb534a3d543407510a684ae0fbef8629))
* Feature: increasing font size to improve readability ([#1c75236](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/1c752360bb534a3d543407510a684ae0fbef8629))
* Feature: removing calls to GitHub to fetch userpic (also changing it to a new one) ([#1c75236](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/1c752360bb534a3d543407510a684ae0fbef8629))
* Docs: moving changelog from "About" page to separate `CHANGELOG.md` file ([#c17880b](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/c17880b3324f579c656bcd92373295e42998f3d5))
* Feature: changing Licence (GPL-3.0 => CC BY 4.0) ([#6b5ebab](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/6b5ebaba0d9f40cfe3d121b41902fe4f57b5fd54))

## 2025-02-23

* Fix: bringing back broken tags thanks to Material for MkDocs update ([#ea77498](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/ea77498897d4507551fc3b460a449f90063e0705))

## 2025-01-10

* Feature: added "Buy me a coffee" button at the bottom ([#8e06cbf](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/8e06cbfe8df7f6ddb83890d5e0cef8e54bcfbdc5))
* Fix: updated the footer: moved "Not by AI" icon to [About](./about.md#not-by-ai) page; updated year ([#8e06cbf](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/8e06cbfe8df7f6ddb83890d5e0cef8e54bcfbdc5))

## 2025-01-07

* Feature: removing lightbox from post title images ([#2fabbf1](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/2fabbf11723be9b3cab33a2750308c04295f063b))

## 2024-12-11

* Feature: adding changelog to "About" page ([#706e4a1](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/706e4a17a6dada66966db33c336908a016dc0078))

## 2024-12-09

* Feature: adding lazy image loading for every post with 1+ image ([#ebc42c8](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/ebc42c8b235e907221bd8c122b9f85a2745f308b))

## 2024-12-08

* Feature: adding social cards ([#b586519](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/b586519109ec7f34466b02298f15dff9cdf681ca))
* Feature: enabling lazy image loading for test ([#b586519](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/b586519109ec7f34466b02298f15dff9cdf681ca))

## 2024-12-06

* Fix: fixing wrong pubDate parameter in RSS feed for random post, which would fetch pubDate of latest redeploy instead of the actual publication date ([#9cdcf2f](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/9cdcf2f847f2c57ebd3938c26df02cd1d5ff6552))

## 2024-11-23

* Feature: adding "Not by AI" icon at the bottom of the page ([#aff1bb8](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/aff1bb811d3196b3e5c84458548a83176220cd5e))

## 2024-11-06
* Fix: changing address for RSS feed from clunky `feed_rss_created.xml` to reasonable `feed.xml` ([#bc0d93a](https://github.com/hatedabamboo/notes.hatedabamboo.me/commit/bc0d93a987568e9a8bed09c995f027d8c5f34a90))

