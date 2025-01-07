---
authors:
  - hatedabamboo
date:
  created: 2024-06-24
slug: locking-myself-off-root-access
tags:
  - linux
  - other
title: "Story time: how I locked myself out of root account and how I fixed it"
---
Yet another reason why I love Linux is the ability to shoot myself in the leg
and still be able to do something about it (or not). This approach allows very
deep configuration and understanding of the system, but at the same time, it
teaches users to be cautious of their actions. Today, I would like to tell a
story about how I locked myself out of root access (easy) and fixed it
afterward (not easy).

<!-- more -->

![image](../assets/story-time-how-i-locked-myself-out-of-root-account-and-how-i-fixed-it.webp){ .off-glb }

## Preamble

Once in a while, I get bored with my computer and decide to change something.
Sometimes this "something" is quite harmless, like configuring tmux[^1], for
example.

Other times, I get frustrated by the fact that Docker wants to get `sudo` from
me every time I'm testing something, so I decide to give my user godmode.

There are a few ways to achieve this result:

1. Log in to the console as the root user (this is very bad practice)
2. Don't ask for a password for `sudo` commands by adding the user to the
`sudoers` file (also not very good practice, but can be used to allow the user
*some* commands without a password)
3. Add the user to the necessary groups (this is *the* way)
4. And a few others

I ditched the first idea from the start, as I have already set up my user
environment to my liking and don't want to configure everything for the second
time. The second idea worked for some time, but I still had to use `sudo` every
time I typed `docker` or something. So I went with group management.

Generally, when you set up a new user, the user is granted a group of the same
name (if not specified otherwise by using the `--no-user-group` flag in the
`useradd` command). After that, user groups can be managed by using the
`usermod` command (correct) or by modifying the `/etc/group` file (bad
administrator, bad!).

*"So you added yourself to more groups, what a big deal"* -- you may say, and
you will be absolutely correct. For one exception. I added myself to all the
necessary groups, but I also deleted myself from my own group and the root
group. And I didn't even notice that something was wrong until I rebooted my
computer and had to start the docker daemon.

```shell
<username> is not in the sudoers file. This incident will be reported.
```

my console told me. And this is where the understanding started to catch up
with me. Panic mode on, trying `sudo -i` -- no luck. `sudo su` -- also no
luck. `su - root` -- you guessed it, no luck.

*"Holy shit, this might be serious"* -- I thought to myself. And it was serious.

## Fixing what should have never be broken in the first place

Lucky for me, I have 10+ years of system administration experience, and I had
some ideas.

Almost all modern GNU/Linux distributions use GRUB[^2] as a boot loader
manager. This is a small software that loads from the boot partition of your
computer and allows you to select which OS or kernel to load. It's very useful
and helpful overall, but especially in situations like this. GRUB configuration
files are responsible for configuring the OS loading process, providing
additional parameters for loading and allowing you to select special tools to
load, e.g., `memtest86+`. Usually, you should configure GRUB using configuration
files in `/etc/grub.d` and regenerate the config either via `update-grub` (for
Debian-based distributions) or via `grub2-mkconfig` (for RHEL-based
distributions).

Corporations don't want you to know this, but you can actually edit the GRUB
menu right in the bootloader window when you're prompted to choose the option
to boot. This allows you to modify the boot parameters, for example, to wait
for some hardware to spin up by increasing the sleep timer. Or, as I was going
to use, to boot into *single-user mode*.

!!! info

    Single-user mode is the mode in which a Linux system is booted with mounted
    local filesystems, but the network is not activated. It's also known as
    *"maintenance mode"* or, more precisely, *runlevel 1*.

This can be achieved by editing the boot string in the following way for
Debian-based distributions:

```shell
linux <...> rw <...> init=/bin/bash
```

and for RHEL-based distributives:

```shell
linux <...> single
```

and pressing Ctrl+X to boot this configuration.

As mentioned previously, this command will boot us into maintenance mode, which
will help to reset the root password or change files without having access to
them.

Or so I thought. Upon booting into single-user mode, I encountered the next
fun step:

```shell
Root account locked.
```

So what does this mean? It means that I'll have to improvise from now on to
solve my problem.

A quick Google search showed me an available solution using a Live USB. By
using a thumb drive and loading a live image of the distribution, I'll be able
to mount my existing filesystem, chroot into it, and change the root password
(or just mount it and add my user to the necessary groups).

Luckily, I still had my thumb drive with the Fedora image that I used to set up
my laptop. I booted from it and started mounting my OS partitions to the
existing live image.

I won't go through describing the full process here, but I'll leave a link to
the Fedora documentation[^3], which explains all the steps. Here, I will detail
only the most important steps of the process:

1. Boot OS from Live USB
2. Decrypt the hard drive and mount the partition
3. Change all that's requires a change
4. ???
5. ~~Profit~~ Reboot

And that was it. The whole process took less than an hour of actual work. It
took much longer to actually notice the lack of functionality.

!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.

[^1]: [tmux.conf](https://github.com/hatedabamboo/dotfiles/blob/master/.tmux.conf)
[^2]: [GNU GRUB](https://www.gnu.org/software/grub/)
[^3]: [Restoring the bootloader using the Live disk](https://docs.fedoraproject.org/en-US/quick-docs/grub2-bootloader/#_restoring_the_bootloader_using_the_live_disk)
