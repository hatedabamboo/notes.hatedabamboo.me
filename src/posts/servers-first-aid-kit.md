---
title: "Server's first aid kit: a quick way to determine if your server is alive and well"
date: 2023-12-24
tags:
- hardware
- servers
- troubleshooting
layout: layouts/post.njk
permalink: /servers-first-aid-kit/
---
There are a lot of posts in the internet regarding which program or tool does what in Linux systems. Usually it's a brief overview of the program's functionality, a few examples, and that's it. All from the objective point of view: what we want to achieve. But there aren't so many posts discussing the algorithms in which these programs can be used. So I decided to write a quick guide you can follow to determine whether there's a problem with a server and where it is.

<!-- more -->

![Title image](/assets/2023-12-24-servers-first-aid-kit.webp)

## First things first: w

Upon every login on the server or the VM, I almost automatically press `w`. Why? Apart from the fact that it's right under my middle finger, it shows me a brief overview of the system: who's here, who's doing what, how long the server is up, what time is it and what load it's under. This is how it looks:

```bash
ubuntu@my-cool-server:~$ w
 16:48:09 up 185 days, 23:14,  1 user,  load average: 0.01, 0.02, 0.02
USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT
ubuntu   pts/0    12.34.56.78      16:48    1.00s  0.03s  0.00s w
```

It's not very informative, but it helps to understand if something's wrong.

## Where can I see whether something went awry?

Log was, is, and always will be the very best way to gather information about application and system health.

Normal applications tend to store their logs in centralized place — `/var/log/` directory. This is the rule. If your application writes logs somewhere else, I suggest you to rethink your life. Several handy log files:

- `/var/log/syslog` and `/var/log/kern.log` can show a lot of interesting stuff
- `/var/log/auth.log` logs all log ins and log outs, a useful place to loog for dem hackers

System-wide messages are provided by `dmesg` (with the emphasis on hardware notifications) and `journalctl -xe` (for systemd operated systems with the emphasys on running applications).

## What hardware this thing runs on?

That's easy. `lshw` will show you so much information, you'd like to avoid look into it right from the start. But fret not, here's how you can:

- Figure what CPUs are there: `lshw -c cpu`
- Figure what memory slots are filled with what planks: `lshw -c memory`
- Figure what SSD/HDD/NVME do you have: `lshw -c storage`
- Take a look at network cards and interfaces: `lshw -c network`

And above all that you can format it with a JSON output just like that: `lshw -json` (and then dive even deeper with awesome `jq`).

## How's the system load?

The forefather of all system load analysis: the *`top`. There are several of them: `top`, `atop`, `htop`, you can choose any by your liking. They differ not only by representation of data, but also on the amount of information you can obtain. I'll point several facts why I use any of them:

- `top` is cool, because it's in the base package of any fill-size Linux OS. It's not super modern, but it does the thing.
- `atop` saves history so you can retroactively take a look at system load some time ago in the past. Also it's more user-friendly in its interface.
- `htop` is even more fancy in the interface and can show threads of a single running application. Comes handy in some situations.

I won't show the interface of `*top` commands here, it's always fullscreen and contains a lot of information on the system load and usage of it's resources.

Here's a cheatsheet, though:

- Most CPU intensive process? Press `c`
- Most memory intensive process? Press `m`
- Interface help? Press `?`

These instruments provide a more detailed overview on the system load and allow to find that bloody memory leaking process or the bastard who stole all the IOPS.

Apart from pressing buttons you can actually configure the interface however you like[^1], but I wouldn't bother as nowdays it's hundreds and thousands of servers under our command and we don't spend as much time as we used to anyway.

## Memory much?

The scary dream of every system administrator with a java application: the OOM Killer. This fella comes and goes and the most scary thing you can see in the `dmesg` will be:

```bash
host kernel: Out of Memory: Killed process 2592 (java).
```

I won't go deeper into the details about OOM Killer and how to avoid it (don't use Java, ha-ha), but I will answer the quick questions you may have regarding memory on the server.

How many memory is there total? `free -m` for megabytes, `free -h` for gigabytes. Or even `grep Total /proc/meminfo`

How much of it is used right now? That's `vmstat`, `vmstat -s` for more fancy and informative output.

## Is there any free space left?

That's our storage there, we have to know of it all!

`df` shows mounter filesystems, their size and free space right of the bat.

Ever heard of inodes? `df -i` has them!

But what disks are there? `lsblk` will show you just what you need: list of block (aka storage) devices as well as it's type, mount point, priority and name.

Or perhaps you need to fix the mount table using ID of the device? `blkid` got your back. Handy for cases when you don't trust device labels.

Do you wander how healty your disk is? Back when HDDs were more popular in servers we used `smartctl -a /dev/sda` (sda for example) from the package `smartmontools`. Currently SSDs and NVMEs are more popular as a storage solution. While some SSDs and NVME support SMART monitoring, it's less then common and don't provide such extensive information due to entirely another technology of data storage. As for NVME, you will have to use entirely different tool `nvme` from the `nvme-cli` package:

```bash
nvme smart-log /dev/nvme0n1
```

## But can it ping google?

The last, but not least, objective on our list, is networking. Who needs a server with a business workload, if it's not available for the user?

`ping 1.1.1.1` or even `ping 8.8.8.8` will get the basic image of the network availability.

`ip a` or `ifconfig` will show you available interfaces and if the link is up or down.

`ip r` shows available routes to the internet — sometimes there are none! My worst nightmare.

Is DNS working properly? `host example.com` is your guy. `dig google.com` will show even more information.

Internet is available, but external application still can't reach you? Check the firewall using `iptables -nvL` (if you're not using any Security Groups on AWS, presumably).

Want to see which ports are used by which processes? `ss -ntupl` will do this for you. As well as `netstat -tup`.

Want to check if external service is available? Good ol' `telnet google.com 80` still works after all these years. Fancy something else? `nc -vz google.com 80` is your choice. Feeling like a hacker? `nmap` is the tool for you. But be careful, it's more tricky and for more complicated tasks (but with extremely wide functionality).

Dad, how do I check if my webserver is up? Use `curl -I example.com` to see HTTP response code, son! Don't be afraid to add `-v` to see all these requests and responses! A very, very handy tool for debugging HTTPS, as it shows all the certificate's data you need (I'm looking at you, expiration dates!)

## Conclusion

Wow, what a trip down the memory lane. I kinda miss the old days when I had hundreds of servers to fix and troubleshoot. But as time kept going, physical infrastructure was replaces by virtual, and our skills switched along with it.

But that's a story for another time. For now, I would like to advise you to spend your time getting to know what tools you have in your console. I would even recommend write a small bullet list of your own, which you will be able to follow at any time to troubleshoot any issue at your own pace and order.

Thank you for reading!

::: info Closing remarks

    As always, feel free to [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my mistakes and befriend me on one of the social media platforms listed below.

    During the process of writing this post, the following music compositions have been listened to:
    [*The Invincible - Original Game Soundtrack*](https://www.youtube.com/watch?v=eeaRI8dVOGQ), [*2005 - 2010 Hardstyle Mix*](https://www.youtube.com/watch?v=XytcoeXiaZ0).

:::

[^1]: [How to customize the Linux top command](https://www.redhat.com/sysadmin/customize-top-command)
