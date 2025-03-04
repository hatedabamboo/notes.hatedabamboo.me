---
authors:
  - hatedabamboo
date:
  created: 2023-12-28
slug: git-hooks
tags:
  - git
categories:
  - "⬢⬡⬡ Beginner"
title: "Git hooks: a painless way to use them"
---
Git hooks are a very handy feature in development. However, because of their
local nature, configuring them from a centralized repository perspective can be
challenging. In this note, I aim to find a convenient solution to this problem.

<!-- more -->

![Git hooks](../assets/2023-12-28-git-hooks.webp){ .off-glb }

## Overview

Git hooks are simple shell scripts that execute upon certain actions like
`pre-commit`, `prepare-commit-msg`, `post-commit`, etc. Examples of these hooks
are typically stored in the repository root within the `.git/hooks` directory.

```shell
~/repository/.git/hooks [master] $ ls
applypatch-msg.sample      post-update.sample     pre-merge-commit.sample  pre-receive.sample         update.sample
commit-msg.sample          pre-applypatch.sample  pre-push.sample          prepare-commit-msg.sample
fsmonitor-watchman.sample  pre-commit.sample      pre-rebase.sample        push-to-checkout.sample
```

To ensure the hook functions properly, it needs to be an executable script
without any extension. Sample hooks can be activated by removing the
`.sample` suffix

## The problem

The problem with the hooks, particularly from the perspective of a DevOps
engineer, lies in their distribution. They are local. And there's no simple way
to enforce users to utilize these hooks. Thus a situation appears where we can
utilize a cool feature, but users may not be aware of it or may choose not to
implement it.

## The solution

Although my approach to this problem is far from perfect, I aimed to eliminate
the most obnoxious obstacle: the requirement for user-side configuration. No
developer ever wants to delve into the git configurations and extend the
communication with it further than `git commit` and `git push` (or even less,
such as a few clicks with a mouse).

The second obstacle is, as I already mentioned, the local nature of the hooks.
For developers, the act of copying and pasting obscure bash scripts from
various sources is an even less desirable action.

I wrote a small shell script, that combines the solution for both issues. It
allows to store hooks within the repository itself AND configure them in
a a user-friendly manner.

```shell
#!/usr/bin/env bash

cd $(readlink -f $(pwd))

if [ -z $(find . -maxdepth 1 -type d -name .git) ]; then
  echo "Not a git repository"
  exit 1
fi

if [ ! -d ./git-hooks ]; then
  echo "No git-hooks directory,exiting"
  exit 1
fi

git config core.hooksPath "./git-hooks"

exit 0
```

What does this script do? When executed from the repository root, it verifies
the presence of a valid git repository, searches for the specified hooks
directory, and configures git to use this directory as the source for hooks.

In this example, all the required hooks must reside within the `git-hooks`
directory located in the repository root. Of course the path can be any, but in
such case the script has to be updated accordingly.

The script itself has to be put in the repository root as well.

Of course, hooks inside this directory must follow the same naming convention
as original hooks[^1]. After all, this is just a different
storage, not different implementation of the feature.

This allows DevOps engineer to provide all developers with the necessary
scripts to be executed during git operations and to store them within the
repository.

Moreover, it allows developers to bypass unnecessary complexities in
configuration and install all essential hooks using a single straightforward
command:

```shell
bash install-hooks.sh
```

!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.

    During the process of writing this post, the following music compositions have
    been listened to:
    [*Gojira — From Mars to Sirius*](https://open.spotify.com/album/0AvFF0HlQYvYKHaRURGZBs).

[^1]: [Customizing Git - Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
