#!/usr/bin/python3

import sys
import urllib.parse
from datetime import date

if len(sys.argv) < 2:
    print("Please provide a title for the topic")
    sys.exit(0)

title = " ".join(sys.argv[1:])
filename = title.translate(str.maketrans("", "", "':,/")).replace(" ", "-").lower()

post = f"{filename}.md"
image = f"{filename}.webp"
postfile = f"src/posts/{post}"
email_subject = urllib.parse.quote(f"Reply to: {title}")

template = f"""---
title: "{title}"
date: {date.today().strftime('%Y-%m-%d')}
tags:
  - TODO fill in
layout: layouts/post.njk
permalink: /TODO fill in/
---
<!-- Here be intro paragraph -->

<!-- more -->

![Title image](/assets/{image})

<!-- Here be text -->

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject={email_subject}">Reply to this post ✉️</a></p>
"""

with open(postfile, "w") as f:
    f.write(template)

open(f"src/assets/{image}", "a").close()
