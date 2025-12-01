---
title: "Secure Your Wi‑Fi Privacy: Randomize MAC Address with Bash"
date: 2025-12-01
tags:
  - bash
  - linux
  - networking
layout: layouts/post.njk
permalink: /securing-wifi-with-random-mac/
---
Several weeks ago, while tinkering with a Wi-Fi router in a coffee shop, a thought occurred to me: "Some networks might be blocking user activity based on MAC addresses. It might be a good idea to automate MAC address changes." So I decided to write a script that would change my laptop's MAC address.

<!-- more -->

![Title image](/assets/securing-wifi-with-random-mac.webp)

## A little bit of theory

A MAC (Media Access Control) address is the hardware address of a network interface. It's represented as a 48-bit hexadecimal value divided into six octets separated by a colon (or a hyphen, or a dot, or nothing at all if you're a psycho):

```bash
01:23:45:AB:CD:EF
```

Effectively, it serves the same purpose as an IP address: to (somewhat) uniquely identify a device. Unlike an IP address, however, it is used on [OSI](https://en.wikipedia.org/wiki/OSI_model) level 2: the data link layer.

Basically, it's the address of a physical device that's connected to a network -- via Ethernet, Wi-Fi, or Bluetooth[^1]. It allows network routers to route packets to the correct devices on a larger scale.

A MAC address consists of six octets, which can be divided into two parts: the Organizationally Unique Identifier (OUI) and the Network Interface Controller (NIC)–specific portion.

The OUI is assigned by the manufacturer and can be looked up in the [IEEE Registration Authority](https://regauth.standards.ieee.org/standards-ra-web/pub/view.html#registries). If you ever wondered who produced your Wi-Fi module (and you don't know about `sudo lshw -c network`), this is one way to find out. The NIC represents the exact hardware part used in the computer or network device. The NIC-specific portion can be duplicated across devices worldwide, but it must be unique within a given OUI.

Keeping up with me so far? Good. Let's move on.

## Trial and error

Network devices have a factory-imprinted MAC address assigned to them. These are permanent and can't be changed. But luckily for us, network interfaces on Linux machines allow admin users to override them. That I did know.

So I tried to assign a new MAC address to my wireless interface.

```bash
~ $ sudo ip link set wlp3s0 down
~ $ NEWMAC=$(openssl rand -hex 6 | sed 's/\(..\)\(..\)\(..\)\(..\)\(..\)\(..\)/\1:\2:\3:\4:\5:\6/')
~ $ sudo ip link set dev wlp3s0 address $NEWMAC
RTNETLINK answers: Cannot assign requested address
```

Hmm. Why is that? If we print the MAC we tried to assign, we'll see the following:

```bash
~ $ echo $NEWMAC
1f:85:90:cc:e0:1c
```

And what's so wrong with it? If we open the [Wikipedia page](https://en.wikipedia.org/wiki/MAC_address#Unicast_vs._multicast_%28I/G_bit%29) on MAC addresses, we'll see that the least-significant bit[^2] (LSB) of the first octet -- also known as the **I/G bit (Individual/Group)** -- can indicate either unicast (`0`) or multicast (`1`). And when we translate `1f` to binary, we get `00011111`, with the I/G bit set to `1`. It turns out that multicast addresses must not be assigned to individual devices, as they are reserved for group traffic. Thus, the error. That I did not know.

::: info

    Ackchyually, the second‑least‑significant bit of the first octet -- commonly called the **U/L (Universal/Local) bit** -- indicates how the MAC address was assigned. A `0` in the U/L bit means the address is universally administered (assigned by the manufacturer's OUI), while a `1` means it is locally administered (chosen by the user or software). Although we can set the U/L bit to either value, best practice for a MAC randomizer script is to set it to `1` so the generated address is clearly a locally administered one and avoids colliding with a genuine vendor‑assigned MAC. But we don't do that here. The more obfuscation the better, amirite?

:::

At this point, I had a lazy idea: just add retries to the script. If the command to set a new MAC address fails, just try again a few times until it succeeds. But that felt sloppy, and I wanted to do it properly from the beginning.

So I modified the script to generate a valid MAC address:

```bash
gen_rand_mac() {
  while :; do
    mac=$(openssl rand -hex 6 | sed 's/\(..\)\(..\)\(..\)\(..\)\(..\)\(..\)/\1:\2:\3:\4:\5:\6/')
    first_byte_hex=${mac%%:*}
    first_byte=$((0x$first_byte_hex))
    if (( (first_byte & 1) == 0 )); then
      echo "$mac"
      return
    fi
  done
}
```

Looking at this function, I see that it still does the same thing -- retries -- but this time it doesn't wait for the `ip` command to fail. It checks the I/G bit right away, and if the first byte is even, the function prints the acceptable MAC address.

Why even, though? If we look at the [table of numbers](https://www.eatyourbytes.com/decimal-binary-and-hexadecimal-numbers-from-0-to-255/) from 0 to 255 in binary, we see that all even numbers end with LSB == `0`, and all odd numbers end with LSB == `1`.

## Final result

The final script turned out like this:

```bash
#!/bin/bash

set -euo pipefail

gen_rand_mac() {
  while :; do
    mac=$(openssl rand -hex 6 | sed 's/\(..\)\(..\)\(..\)\(..\)\(..\)\(..\)/\1:\2:\3:\4:\5:\6/')
    first_byte_hex=${mac%%:*}
    first_byte=$((0x$first_byte_hex))
    if (( (first_byte & 1) == 0 )); then
      echo "$mac"
      return
    fi
  done
}

if [[ "$(id -u)" != "0" ]]; then
  echo "This script must be run as root, exiting..."
  exit 1
fi

WL_DEVICE=$(ip link show | awk '/^([0-9]+): wl/{print $2}' | tr -d ':')
WL_MAC=$(ip link show "$WL_DEVICE" | awk '/link\/ether/ {print $2}')
RAND_MAC=$(gen_rand_mac)

if [[ -z "$WL_DEVICE" ]]; then
  echo "Unable to find a wireless device, exiting..."
  exit 1
fi

echo "Found wireless device: $WL_DEVICE"
echo "Current $WL_DEVICE MAC address: $WL_MAC"

echo "Disabling $WL_DEVICE"
ip link set dev "$WL_DEVICE" down

echo "Setting new MAC address $RAND_MAC"
ip link set dev "$WL_DEVICE" address "$RAND_MAC"

echo "Bringing $WL_DEVICE back up"
ip link set dev "$WL_DEVICE" up

echo "Wireless back up, new MAC: $(ip link show "$WL_DEVICE" | awk '/link\/ether/ {print $2}')"

exit 0
```

It can also be found in my [dotfiles](https://github.com/hatedabamboo/dotfiles/blob/master/.exe/changemac) repository. Recently, I started adding some more complex scripts alongside [aliases](https://notes.hatedabamboo.me/bash-aliases/) and [functions](https://notes.hatedabamboo.me/bash-functions/).

The funniest part of this whole endeavor? Turns out I just recreated [macchanger](https://www.kali.org/tools/macchanger/). Man, I love IT.

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Secure%20Your%20Wi%E2%80%91Fi%20Privacy%3A%20Randomize%20MAC%20Address%20with%20Bash">Reply to this post ✉️</a></p>

[^1]: The usual method for pairing Bluetooth devices on Linux is to refer to their MAC address.
[^2]: The least-significant bit is the rightmost bit in the binary representation of a number. If you're into hacky stuff (as I am) and enjoy occasional [CTFs](https://notes.hatedabamboo.me/arg2025/) (as I do), I advise you to remember this term -- [sometimes](https://en.wikipedia.org/wiki/Steganography) it's used to conceal information.
