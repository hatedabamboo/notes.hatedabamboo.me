---
title: "2025 in review"
date: 2025-12-18
tags:
  - other
layout: layouts/post.njk
permalink: /2025-in-review/
---
The New Year is nigh, and it's time to look back at the past year. Let's take a look at some numbers and noticeable changes, however big or small they might be. Mostly related to this blog, though some may be personal.


<!-- more -->

![Title image](/assets/2025-in-review/title.webp)

## ARG:2025

The most exciting (and, sadly, disappointing) event for me this year was, of course, [ARG:2025](https://notes.hatedabamboo.me/arg2025/). It was a product of love and joy. I was extremely excited to imagine every step, how it would look, and how different people would crack the puzzles. Unfortunately, when you spend so much time on an activity, you can become so entangled in a particular way of thinking that you can't see other options. The same thing happened here. Tasks I thought would be slightly challenging turned out to be virtually impassable, because to me they seemed obvious, whereas they were not.

For perspective, here are some numbers:

1. **583** unique visitors have seen the game.
2. Out of this number, **59** solved the first puzzle.
3. **18** times, people found the correct keyword to solve the second puzzle but didn't know how to use it.
4. The number of people who solved the second puzzle? Zero. Null. None.
5. **3580** attempts were made to solve the game. In hindsight, it was not the brightest idea to put the field for the final solution right at the very beginning of the game. But it is an interesting thing nonetheless. I've seen people brute-forcing their way through the game with `curl`, `postman`, `colly`, and something called `thoth scribe engine Pyramid OS`. My favorite answer in the field was "Your mom".

Oh well. I still enjoyed the whole process a ton. And the game will stay online at least until the next one arrives. Yes, you read that right: I am going to make a second ARG. Maybe next year, maybe a bit later, but it will see the light.

## Migration to 11ty

The third year of the blog meant it was time to migrate the SSG platform for the third time. I hope this time was the last.

This time, I migrated to [11ty](https://www.11ty.dev/).

The reasons for this migration are quite simple: Material for MkDocs didn't provide the flexibility in configuration that I wanted. While it's a great platform for documentation, it turned out to be not so great for extensive blog customization (who would've thought, right?).

By the way, this move caused the following two events.

## Plausible Analytics

Migration to a new SSG platform motivated me to switch to a new analytics platform as well. Goodbye Google Analytics, hello self-hosted Plausible Analytics! At last, I can see simple graphs of visitors and views, without a billion unnecessary metrics I don't give a crap about.

![Ain't she a beaut?](/assets/2025-in-review/plausible.webp)

Switching to PA also revealed some interesting insights:

* The second most popular visitor country (after the USA) is, surprisingly, Singapore. VPN much?
* Apart from the usual Firefox, Safari, and Chrome, 3 visitors used Avast Secure Browser (why tho?), 3 used Sogou Explorer (never heard of it), 1 used Smart Lenovo Browser, and 1 used Whale Browser (what even is this?).

Here is the Top 10 most popular pages for 2025:

![Top-10](/assets/2025-in-review/top10.webp)

## Second feature on 512kb.club

I hate the modern web concept that websites should be as complex as possible, bloated with megabytes of unnecessary JavaScript and overcomplicated code. My ideal website loads almost instantly, responds very quickly, and contains as few secondary elements as possible.

Staying true to this idea, I strived to keep my blog minimal in size while keeping it useful and pretty. While sub-second loading time is a reward in itself, it's also nice to be featured among like-minded individuals and their webpages: [The 512KB Club](https://512kb.club/). Not only is this the second time my website has been featured on this page (the first being my [landing page](https://hatedabamboo.me), which is mainly a business card with no valuable content), I was even able to feature in the green team (websites < 100 KB) both times! It's just so satisfying.

![Landing](/assets/2025-in-review/landing.webp)

![Blog](/assets/2025-in-review/blog.webp)

## Public speaking

Last year, I was aiming to give two public talks. I think the resulting number was zero.

This year, however, I was lucky to present not once, not twice, but three times: at two AWS User Group Meetups (Amsterdam & Porto) and one AWS Community Day (Baltic). It was great to finally visit Amsterdam, spend a whole week in Porto, meet dozens of incredibly nice people, and present in an actual lecture hall! 10/10 would recommend.

These events were so exciting and encouraging that I even created a [separate page](https://notes.hatedabamboo.me/speaking/) dedicated to my public speaking topics. So if you're looking to invite me to an event to speak -- go right there, don't hesitate!

## Epilogue

The anniversary of my blog is in August, but I was a bit busy at the time and decided to postpone the anniversary post until the end of the year. Last year wasn't eventful anyway.

Among other things, I:

- Found a new job;
- Welcomed the 4000th visitor on my blog;
- Met John Romero [in person](https://www.instagram.com/hatedabamboo/p/DL9kllaoqoa/) (!!!);
- Introduced featured and pinned posts;
- Changed my domain name registrar from GoDaddy to AWS[^1].

Oh, and I got married!

See you next year, Merry Christmas, Happy Holidays, and a Happy New Year!

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Throwback%20Thursday%3A%202025%20and%20a%20half">Reply to this post ✉️</a></p>

[^1]: I'm very glad I discovered this possibility with the help of a colleague. I dreaded every visit of this website, it is that bad.
