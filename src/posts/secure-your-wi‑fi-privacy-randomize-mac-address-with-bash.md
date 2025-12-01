---
title: "Secure Your Wi‑Fi Privacy: Randomize MAC Address with Bash"
date: 2025-12-01
tags:
  - linux
  - networking
layout: layouts/post.njk
permalink: /securing-wifi-with-random-mac/
---
Several weeks ago while tinkering with a Wi-Fi router in a coffee shop, a thought occurred to me: "Some networks may be blocking user activity based on their MAC addresses. It might be a sensible idea to automate MAC address changes." And so I decided to write a script that will change my laptop's MAC address.

<!-- more -->

![image](/assets/secure-your-wi‑fi-privacy-randomize-mac-address-with-bash.webp)

## A little bit of theory

MAC (media access control) address is the hardware address of the network interface. It is represented as a 48-bit hexadecimal address divided into 6 octets separated by a colon (or a hyphen, or a dot, or nothing at all, if you're a psycho):

```bash
01:23:45:AB:CD:EF
```

Effectively it serves the same purpose as an IP address: to (somewhat) uniquely identify the device. Unlike IP address, however, it is used on the [OSI](https://en.wikipedia.org/wiki/OSI_model) level 2: the data link layer.

Basically, it's an address of a physical device that's being connected to a network -- via an Ethernet, Wi-Fi, or Bluetooth[^1]. It allows network routers to route network packets to the correct devices on a bigger scale.

MAC address consists of 6 octets which can be divided into two parts: Organizationally Unique Identifier (OUI) and Network Interface Controller (NIC) specific.

The OUI is assigned by the manufacturer and can be looked up in the [IEEE Registration Authority](https://regauth.standards.ieee.org/standards-ra-web/pub/view.html#registries). If you ever wondered who produced your Wi-Fi module (and you don't know about `sudo lshw -c network`), this might be one of the ways to find out. NIC represents the exact hardware part that's used in the computer or network device. The NIC‑specific portion can be duplicated across devices worldwide, but it must be unique within a given OUI.

Keeping up with me so far? Good. Let's move on.

## Trial and error

Network devices upon their production have imprinted MAC address assigned to them. These are permanent and can't be changed. But lucky for us, network interfaces on Linux machines allow admin users to change them.

So I tried to assign a new MAC to my wireless interface.

```bash
~ $ sudo ip link set wlp3s0 down
~ $ NEWMAC=$(openssl rand -hex 6 | sed 's/\(..\)\(..\)\(..\)\(..\)\(..\)\(..\)/\1:\2:\3:\4:\5:\6/')
~ $ sudo ip link set dev wlp3s0 address $NEWMAC
RTNETLINK answers: Cannot assign requested address
```

Hmm. Why is that? If we print the MAC that we tried to assign, we will see the following:

```bash
~ $ echo $NEWMAC
1f:85:90:cc:e0:1c
```

And what's so wrong with it? If we open the [Wikipedia page](https://en.wikipedia.org/wiki/MAC_address#Unicast_vs._multicast_(I/G_bit)) on MAC address we will see  that least significant bit[^2] (LSB) in the first octet, which is also knows as I/G bit (Individual/Group), can be either unicast (`0`), or a multicast (`1`). And if we translate `1f` to binary, we will see `00011111`, exactly with I/G bit being `1`.

At this point I had a lazy idea to just add retries to the script: if the command to set a new MAC address fails, just try several more times until success. But this is a lazy approach and I wanted to do the correct thing right from the beginning.

So I modified the script to generate a MAC address:

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

Looking at this function I see that it still does the same thing -- retries -- but this time it doesn't wait for the `ip` command and checks for I/G bit right from the start. And if the first byte is even, the function will print the acceptable MAC address.

Why even, though? If we look at the [table of numbers](https://www.eatyourbytes.com/decimal-binary-and-hexadecimal-numbers-from-0-to-255/) from 0 to 255 in binary representation, we will see that all even numbers end in LSB == `0`, and all odd numbers end in LSB == `1`.

## Final result

The final script turned out to be like this:

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

It can also be found in my [dotfiles](https://github.com/hatedabamboo/dotfiles/blob/master/.exe/changemac) repository. Recently I started adding some more complex scripts alongside [aliases](https://notes.hatedabamboo.me/bash-aliases/) and [functions](https://notes.hatedabamboo.me/bash-functions/).

The funniest part of all this endeavor? Turns out I just recreated [macchanger](https://www.kali.org/tools/macchanger/). Man I love IT.

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Secure%20Your%20Wi%E2%80%91Fi%20Privacy%3A%20Randomize%20MAC%20Address%20with%20Bash">Reply to this post ✉️</a></p>

[^1]: The usual method for pairing Bluetooth devices on Linux is to refer to their MAC address.
[^2]: The least significant bit is the right-most bit in the binary representation of a number. If you're into hacky stuff (as I am) and enjoy occasional [CTFs](https://notes.hatedabamboo.me/arg2025/) (as I do), I advise you to remember this term -- [sometimes](https://en.wikipedia.org/wiki/Steganography) it's used to conceal the information.
