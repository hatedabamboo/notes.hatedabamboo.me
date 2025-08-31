#!/usr/bin/python3

import sys
import os
from datetime import date
import urllib.parse

if len(sys.argv) < 2:
    print("Please provide a title for the topic")
    sys.exit(0)

title = " ".join(sys.argv[1:])
filename = title.translate(str.maketrans("", "", "':,/")).replace(" ", "-").lower()

post = f"{filename}.md"
image = f"{filename}.webp"
postfile = f"docs/posts/{post}"
email_subject = urllib.parse.quote(f"Reply to: {title}")

template = f"""---
authors:
  - hatedabamboo
date:
  created: {date.today().strftime('%Y-%m-%d')}
slug: TODO fill in
tags:
  - TODO fill in
categories: # TODO leave only one
  - "⬢⬡⬡ Beginner"
  - "⬢⬢⬡ Intermediate"
  - "⬢⬢⬢ Advanced"
title: "{title}"
---
<!-- Here be intro paragraph -->

<!-- more -->

![image](../assets/{image}){ .off-glb }

<!-- Here be text -->

---

<p style="text-align: center;">
<a href="mailto:reply@hatedabamboo.me?subject={email_subject}">Reply to this post ✉️</a>
</p>
"""

with open(postfile, "w") as f:
    f.write(template)

open(f"docs/assets/{image}", "a").close()
