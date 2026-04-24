---
title: "Project: bumpwf"
date: 2026-04-24
tags:
  - cicd
  - github
layout: layouts/post.njk
permalink: /project-bumpwf/
---
Today I maked a tool that solves one of my headaches: keeping GitHub Actions in workflows up to date and actual. In this post I'll tell a bit history about it and what can it do. 

<!-- more -->

![Title image](/assets/project-bumpwf.png)

Dependencies are pain in the butt. Nobody likes dependencies. No programming language or framework solved the dependencies problems exactly right: it's either not solving majority of the problems, or making it extremely complicated and cumbersome.

But what can be more painful that outdated dependencies in a project? Outdated dependencies in a project that are available for everyone to use and exploit! Welcome to the harsh reality of GitHub Actions.

## The problem

GitHub Actions were such a needed addition for GitHub to compete in the public market of global git repositories with GitLab, who had it's own impressive CI/CD system from the get-go, GitLab CI. Working on a more convenient solution, GitHub introduced the feature that was lacking in  GitLab CI: publicly available reusable workflows. The script that you can publish and everyone on the internet would be able to use it.

This is how GitHub Actions were born. They were quite powerful, being written in an actual programming language and not a shell-wrapper, and so convenient to use that it was hard to resist. Many actions were born, even more -- drafted to never be used or heared again. Many companies wrote their own actions incorporating (or helping to use) their products: build Docker image, perform repository security scan, you name it.

All was (somewhat) good until recently Aquasecurity's Trivy was [gravely compromised](https://www.aquasec.com/blog/trivy-supply-chain-attack-what-you-need-to-know/) during a supply chain attack on its actions workflow. And it's not the [first such case](https://thehackernews.com/2026/04/self-propagating-supply-chain-worm.html). There will definitely be more with the increasing popularity of so-called "autonomous agents" to research and exploit all possible vulnerabilities.

Wait, why am I bragging about this? Oh, right, how we can prevent this from happening.

So, the solution was pretty simple from the very beginning.

Essentially there were always two ways of referencing an action version in a workflow: either via a tag `@v1.6.9`, or via a commit hash `@de0fac2e4500dabe0009e67214ff5f5447ce83dd`. Of course everyone was using tags because they are easily readable, convenient and look nice. But there's a catch: tags can be overwritten. Which attackers successfully used in their attacks to poison workflows utilizing specific version.

## The solution

Every time I saw yet another post about supply chain attack, I thought to myself: "Hey, you should replace the tags in your repos with the hashes." And it's a very valid approach! The downside is that I had actually go to each repo, find the tag, find it's commit hash and update the workflow. And it's all such a chore. So I let it slide until the next huge attack.

During my work at [Avaturn](https://avaturn.live/) I wrote a workflow to check for updates in Helm charts and EKS add-ons. It was a convenient replacement for Dependabot for custom tools we use and I could use it in the said GitHub Actions. From there it was only one step away to write the same thing, but for actions themselves.

Unfortunately, when I tried to wrap the resulting script into a workflow, I hit the wall of GitHub restrictions. You can't update the workflow files from the workflow itself without explicif permissions in a separate token. And it makes sense: with such functionality at hand, anyone can poison regular workflow and make the job even easier[^1].

So, existing script was taken as a starting point, rewritten in Go, and filled with some additional functions.

So what exactly `bumpwf`[^2] can do?

1. Updating actions' versions in repository's workflows. Running `bumpwf` in the root of the repository will trigger the program to scan `.github/workflows` files, find used actions, parse their versions, fetch GitHub repositories, find latest versions and update the actions one-by-one:

```bash
~/repo/hatedabamboo [main] $ bumpwf
Fetching 3 repo(s)...

  Action                                        Installed version              Latest version
  ------                                        -----------------              --------------
  actions/checkout                              v6.0.2                         v6.0.2 (de0fac2)
  gautamkrishnar/blog-post-workflow             1.9.4                          1.9.6 (2786e54)
  readme-tools/github-readme-stats-action       v1.1.0                         v1.1.0 (b4d2ef3)

Outdated action(s) remaining: 1

  [1] gautamkrishnar/blog-post-workflow: 1.9.4 → 1.9.6 (2786e54)  committed on 2026-04-16

Which action to update? (number, or q to quit): 1

Updating gautamkrishnar/blog-post-workflow:
  [t] Tag:  1.9.6  (committed on 2026-04-16)
  [s] SHA:  2786e54a01b71aec80a5118c2bd6b5044e842597  (committed on 2026-04-16)
  [Enter] Skip
  Use tag or hash? (t/s/Enter): s

  Updated .github/workflows/cron-posts.yaml

  Done.

All actions updated!
```

You're able to choose whether you'd like to pin new version as a tag (not recommended in 2026) or a commit SHA (recommended in 2026).

2. Do the same as above, but automatically: with the option to choose all tags (flag `-t`) or all hashes (flag `-s`, also default option):

```bash
~/repo/hatedabamboo [main] $ bumpwf -A
Fetching 3 repo(s)...

  Action                                        Installed version              Latest version
  ------                                        -----------------              --------------
  actions/checkout                              v6.0.2                         v6.0.2 (de0fac2)
  gautamkrishnar/blog-post-workflow             1.9.4                          1.9.6 (2786e54)
  readme-tools/github-readme-stats-action       v1.1.0                         v1.1.0 (b4d2ef3)

Updating all 1 outdated action(s)...

Updating gautamkrishnar/blog-post-workflow → 2786e54a01b71aec80a5118c2bd6b5044e842597

  Updated .github/workflows/cron-posts.yaml

All actions updated!
```

3. Replace existing pinned versions (tags or hashes) with their counterparts and vice versa:

```bash
~/repo/hatedabamboo [main] $ bumpwf -r
Fetching 3 repo(s)...

Actions available for conversion: 3

  [1] actions/checkout: v6.0.2 → de0fac2  (tag→sha)
  [2] gautamkrishnar/blog-post-workflow: 1.9.4 → 6a6e64a  (tag→sha)
  [3] readme-tools/github-readme-stats-action: v1.1.0 → b4d2ef3  (tag→sha)

Which action to convert? (number, or q to quit): 1

Converting actions/checkout: v6.0.2 → de0fac2e4500dabe0009e67214ff5f5447ce83dd

  Updated .github/workflows/cron-posts.yaml
  Updated .github/workflows/readme-stats.yaml

  Done.

Actions available for conversion: 2

  [1] gautamkrishnar/blog-post-workflow: 1.9.4 → 6a6e64a  (tag→sha)
  [2] readme-tools/github-readme-stats-action: v1.1.0 → b4d2ef3  (tag→sha)

Which action to convert? (number, or q to quit): q
```

This one is particularly useful in scenarios if you (like me) don't want to spend time crawling through every action's repository.

The tool also has a nice colored output! Which can be turned off by setting the environment variable: `export NO_COLOR="yes please"` (value can be any).

## Limitations

`bumpwf` utilizes official GitHub API. They have a rather strict rate limit: for unauthorized users only 60 calls per hour. It can be omited by getting a [personal access token](https://github.com/settings/personal-access-tokens) and passing it to the environment variable `GH_TOKEN`. Or by switching VPN servers -- also works.

## Future plans

At the moment of writing this articles there are already several things I think could use some improvement: the interface itself, maybe multiple version to update to, some way of accomodating it with GitHub Actions themselves. I like the idea of the tool, I want it to become really useful in its niche, but at the same time I want to keep its functionality to a bare minimum. In the end, every tool can do only one job, but it sure as hell has to do this job right.

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Project%3A%20bumpwf">Reply to this post ✉️</a></p>

[^1]: Eventually I'm planning to come up with a solution to utilize `bumpwf` in workflows: either an example or an action.
[^2]: The name is weird, perhaps I will rename it further down the road.
