#!/bin/bash

TITLE="$(echo $@ | tr ' ' '-' | tr [[:upper:]] [[:lower:]])"

filename="$(date +"%Y-%m-%d")-${TITLE}"
post="${filename}.md"
image="${filename}.webp"
postfile="docs/_posts/${post}"

cat << EOF > $postfile
---
layout:     post
title:      "$@"
date:       $(date +"%Y-%m-%d %H:%M:00 %z")
author:     Kirill Solovei
permalink:  /
tags:       
---

>>> Here be intro paragraph

<!--more-->

![image](../assets/${image})

>>> Here be text

## Links

1. 

---

As always, feel free to
[disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
mistakes and befriend me on one of the social media platforms listed below.
EOF

vim $postfile  
