---
title: "Automatic git commit"
date: 2023-09-14
tags:
- bash
- git
layout: layouts/post.njk
permalink: /automatic-git-commit/
---
How often you find yourself in the situation, when you're too bored to write a commit message? Personally, quite often. For this specific reason I finally managed to create a quick way to write commit messages.

<!-- more -->

![Bash is cool](/assets/2023-09-14-quick-git-commit.webp)

I love aliases in bash. They're super convenient and useful and significantly increase the speed of work. Someday I hope to write finally a post about them[^1], but for now you can check my dotfiles repository[^2] with aliases.

But lets back to the topic. I use aliases in git operations a log: `gs` instead of `git status`, `gp` instead of `git pull`, etc., etc. Recently I added one more: `gc` as for `git commit`.

`git commit` requires commit message provided inline with `-m` argument, otherwise it'll open commit message file with overview of what files have been changed. This file brought up an idea in my mind. What if I could somehow use this template automatically?

Turns out, there is such an option. `git status` shows changes that have been made in the repository. They're quite verbose, but using `git status --short` it can be minimized to one line per change using the following symbols:

```text
•   ' ' = unmodified
•   M = modified
•   T = file type changed (regular file, symbolic link or submodule)
•   A = added
•   D = deleted
•   R = renamed
•   C = copied (if config option status.renames is set to "copies")
•   U = updated but unmerged

X          Y     Meaning
-------------------------------------------------
        [AMD]   not updated
M        [ MTD]  updated in index
T        [ MTD]  type changed in index
A        [ MTD]  added to index
D                deleted from index
R        [ MTD]  renamed in index
C        [ MTD]  copied in index
[MTARC]          index and work tree matches
[ MTARC]    M    work tree changed since index
[ MTARC]    T    type changed in work tree since index
[ MTARC]    D    deleted in work tree
            R    renamed in work tree
            C    copied in work tree
-------------------------------------------------
D           D    unmerged, both deleted
A           U    unmerged, added by us
U           D    unmerged, deleted by them
U           A    unmerged, added by them
D           U    unmerged, deleted by us
A           A    unmerged, both added
U           U    unmerged, both modified
-------------------------------------------------
?           ?    untracked
!           !    ignored
-------------------------------------------------
```

They all can be used as an anchor for the quick alias, however not all of them are convenient to me in everyday operations. This brings me to creation of such command:

```bash
git status --short | sed 's/^M /Updated\t/g; s/^A /Added\t/g; s/^D /Deleted\t/g; s/ .*\// /g' | sort
```

This command will replace letters with according words, replace full filepath with only filename and sort changes alphabetically.

It can be wrapped inside the `git commit` command:

```bash
git commit -m "$(git status --short | sed 's/^M /Updated\t/g; s/^A /Added\t/g; s/^D /Deleted\t/g; s/ .*\// /g' | sort)"
```

And, finally, create a handy alias for quick commits (don't forget to escape double quotes and `$` sign!):

```bash
alias gc="git commit -m \"\$(git status --short | sed 's/^M /Updated\t/g; s/^A /Added\t/g; s/^D /Deleted\t/g; s/ .*\// /g' | sort)\""
```

This alias can be added to `~/.profile` or `~/.bashrc` and be used instead of long string or boring comments.

With this help all git operations (edit file, add file to commit, commit it and push to the repository) can be shorten to few symbols:

```bash
vim file
ga file
gc
git push
```

and commit message will look like this:

```text
Added   mock_data.sql
Added   test-query.sql
Added   query-result.sql
Updated README.md
Deleted testfile
```

::: info Closing remarks

    As always, feel free to [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my mistakes and befriend me on one of the social media platforms listed below.

:::

[^1]: [Bash aliases and why I love them](https://notes.hatedabamboo.me/bash-aliases/)
[^2]: [dotfiles](https://github.com/hatedabamboo/dotfiles)
