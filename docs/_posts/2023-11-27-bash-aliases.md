---
layout:     post
title:      "Bash aliases and why I love them"
date:       2023-11-27 14:25:00 +0200
author:     Kirill Solovei
permalink:  /bash-aliases
tags:       bash
---
I love bash. A tool as trivial as command line interface (CLI, or just console)
holds so many secrets, that even after 9 years of experience I still sometime
find something wonderful. But today I want to talk a bit about one of my
favourite tricks — aliases.

<!--more-->

![Bash aliases and where to find them](../assets/2023-11-27-bash-aliases.webp)

## A little detour

Before diving into the topic itself, I would like to brag a bit why I love
shell and bash specifically.

The reasons behind this love are very simple, I would say. I used to work with
from the very start of my career and through the years I learned about it's
upsides and tricks a lot. For example, `.rc` files, which can help you
preconfigure necessary application in the way you like. Or the fact that using
several words (as a single command) you can find necessary information in giant
text file or change one into something entirely new. And last, but not least,
goes the availability of shell everywhere (I'm speaking right now about business
applications, not your fancy macbook to watch facebook DIY videos, though even
it has a console): baremetal servers, virtual machines, EC2 instances, even
smallest Alpine containers!

## Aliases and where they live

Alias is a small word you replace the command with. For example, instead of
`docker inspect` you can write `di`, or `s` instead of `ssh`. Nice, right?
This is the magic of aliases.

In order to create one, you can use:

- `~/.profile` file
- `~/.bashrc` file
- or even separate file like I do: `~/.bash_aliases`

In the example above `~/` is the home directory of your current user, same as
`/home/your-username`.
Declaration of an alias looks like this:

```bash
alias <new word for the command>="<command you want to replace with alias>"
```

And actual example:

```bash
alias l="ls -lh --color=always"
alias ll="ls -lah --color=always"
```

And that's it! If you're going to use non-default file for your aliases, don't
forget to include it inside your shell profile:

```bash
if [ -f ~/.bash_aliases ]; then
  . ~/.bash_aliases
fi
```

After inclusion of the aliases, don't forget to update your shell profile:

```bash
source ~/.bashrc
# or
source ~/.profile
```

For the time I write this article I have 40 aliases for my day to day work.
I've seen people's rcfiles with hundreds; a little overkill, if you ask me, but
I'm not the one to judge: you choose what is appropriate for yourself.

I remember when working in VK as a systems administor, previous admins had
particular sence of humor: trying to run `nano` you were actually calling an
alias for `vim`. And trying to open file with `vim` you saw a message
threatening to do something with your balls. Ah, good ol' times.

## Epilogue

You can peek at my aliases (and all the dotfiles I use, actually) at my GitHub:

- [dotfiles](https://github.com/hatedabamboo/dotfiles)

As always, feel free to
[disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
mistakes and befriend me on one of the social media platforms listed below.

---

During the process of writing this post, the following music compositions have
been listened to:
[*2005 - 2010 Hardstyle Mix*](https://www.youtube.com/watch?v=XytcoeXiaZ0).
