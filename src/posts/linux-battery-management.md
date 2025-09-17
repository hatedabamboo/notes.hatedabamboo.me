---
title: "Linux battery management"
date: 2024-04-13
tags:
- hardware
- linux
layout: layouts/post.njk
permalink: /linux-battery-management/
---
Yet another reason why I love Linux: everything is a file. Today I would like to talk about the files that help us to understand the health of our accumulator batteries.

<!-- more -->

![Battery](/assets/2024-04-13-linux-battery-management.webp)

::: warning 12.08.2024 update

    Since I started learning Golang, one of my first ideas was to rewrite existing tools I use in Go. I’ve now added the source code for a program that has the same functionality, but written in Go -- because why not.

:::

## Batteries and Their Location

Recently I became a happy owner of Lenovo ThinkPad laptop. And of course I installed Linux as an operating system. As I intend to use for a very long time, I thought to myself: "Hey, the longer the battery lasts, the longer you can use your new shiny tech!" But how do I make my laptop battery last longer? That's where "everything is a file" linux concept comes in handy.

Assuming that everything is a file in Linux (even hardware), I thought that there definitely should be a file dedicated to my laptop battery. And I was correct.

Battery-related files can be found in a `/sys` pseudofilesystem:

```bash
[16:52:46] /sys/class/power_supply $ l
total 0
lrwxrwxrwx. 1 root root 0 Apr 13 15:25 AC -> ../../devices/pci0000:00/0000:00:14.3/PNP0C09:00/ACPI0003:00/power_supply/AC
lrwxrwxrwx. 1 root root 0 Apr 13 11:09 BAT0 -> ../../devices/LNXSYSTM:00/LNXSYBUS:00/PNP0A08:00/device:35/PNP0C09:00/PNP0C0A:00/power_supply/BAT0
```

AC, as one can guess, is a source of Alternating Current, when my laptop is connected to a power source. But *BAT0* is the one I'm looking for — the battery.

## Diving Deep Into The Battery

What do we have here?

```bash
[16:54:53] /sys/class/power_supply/BAT0 $ l
total 0
-rw-r--r--. 1 root root 4.0K Apr 11 21:34 alarm
-r--r--r--. 1 root root 4.0K Apr 11 21:34 capacity
-r--r--r--. 1 root root 4.0K Apr 11 21:34 capacity_level
-rw-r--r--. 1 root root 4.0K Apr 11 21:34 charge_behaviour
-rw-r--r--. 1 root root 4.0K Apr 10 19:08 charge_control_end_threshold
-rw-r--r--. 1 root root 4.0K Apr 10 19:08 charge_control_start_threshold
-rw-r--r--. 1 root root 4.0K Apr 11 21:34 charge_start_threshold
-rw-r--r--. 1 root root 4.0K Apr 11 21:34 charge_stop_threshold
-r--r--r--. 1 root root 4.0K Apr 11 21:34 cycle_count
lrwxrwxrwx. 1 root root    0 Apr 11 21:34 device -> ../../../PNP0C0A:00
-r--r--r--. 1 root root 4.0K Apr 11 21:34 energy_full
-r--r--r--. 1 root root 4.0K Apr 11 21:34 energy_full_design
-r--r--r--. 1 root root 4.0K Apr 11 21:34 energy_now
drwxr-xr-x. 3 root root    0 Apr 11 21:34 hwmon1
-r--r--r--. 1 root root 4.0K Apr 11 21:34 manufacturer
-r--r--r--. 1 root root 4.0K Apr 11 21:34 model_name
drwxr-xr-x. 2 root root    0 Apr 11 21:34 power
-r--r--r--. 1 root root 4.0K Apr 11 21:34 power_now
-r--r--r--. 1 root root 4.0K Apr 11 21:34 present
-r--r--r--. 1 root root 4.0K Apr 11 21:34 serial_number
-r--r--r--. 1 root root 4.0K Apr 11 21:34 status
lrwxrwxrwx. 1 root root    0 Apr 13 16:54 subsystem -> ../../../../../../../../../class/power_supply
-r--r--r--. 1 root root 4.0K Apr 11 21:34 technology
-r--r--r--. 1 root root 4.0K Apr 11 21:34 type
-rw-r--r--. 1 root root 4.0K Apr 11 21:34 uevent
-r--r--r--. 1 root root 4.0K Apr 11 21:34 voltage_min_design
-r--r--r--. 1 root root 4.0K Apr 11 21:34 voltage_now

```

Let's figure out what is what and what do we need.

Files `manufacturer`, `model_name`, `serial_number`, `technology` and `type` present battery's metadata — not particularly interesting information, but may become necessary in a scenario of replacing the battery.

`capacity` shows current battery charge in % — a very helpful information, one that we will definitely need.

Files `charge_control_start_threshold`, `charge_control_end_threshold`, `charge_start_threshold` and `charge_stop_threshold` show charge level on which battery should start charging or end charging. These values play the crucial role in battery lifecycle, as per Battery University[^1] (yes, seriously) the optimal charge range for Li-ion batteries is between 30 and 80 percent.

`cycle_count` show the current amount of charge/discharge cycles.

`energy_full`, `energy_full_design`, `energy_now` show current level of battery capacity: at full charge, full by design and current level (in µWh[^2]).

`uevent` has the information from all other sources as well, presenting a combination of power supply properties (according to linux kernel source code: power_supply.h[^3]) and their respective values. It looks like this:

```bash
[17:14:27] /sys/class/power_supply/BAT0 $ cat uevent 
POWER_SUPPLY_NAME=BAT0
POWER_SUPPLY_TYPE=Battery
POWER_SUPPLY_STATUS=Discharging
POWER_SUPPLY_PRESENT=1
POWER_SUPPLY_TECHNOLOGY=Li-poly
POWER_SUPPLY_CYCLE_COUNT=419
POWER_SUPPLY_VOLTAGE_MIN_DESIGN=11520000
POWER_SUPPLY_VOLTAGE_NOW=11163000
POWER_SUPPLY_POWER_NOW=7222000
POWER_SUPPLY_ENERGY_FULL_DESIGN=57020000
POWER_SUPPLY_ENERGY_FULL=48970000
POWER_SUPPLY_ENERGY_NOW=20480000
POWER_SUPPLY_CAPACITY=41
POWER_SUPPLY_CAPACITY_LEVEL=Normal
POWER_SUPPLY_MODEL_NAME=5B10W139
POWER_SUPPLY_MANUFACTURER=SMP
POWER_SUPPLY_SERIAL_NUMBER= 1253
```

## Figuring out how this information can help

Okay, that's some amount of data. What to do with it?

First things first, as I like writing shell scripts, I wrote a small utility calculating current battery charge, battery health percentage and charge cycles:

### Bash

```bash
#!/bin/bash

ENERGY_MAX=$(cat /sys/class/power_supply/BAT0/energy_full_design)
ENERGY_FULL=$(cat /sys/class/power_supply/BAT0/energy_full)
ENERGY_NOW=$(cat /sys/class/power_supply/BAT0/energy_now)
CAPACITY=$(echo "scale=2; (${ENERGY_FULL}*100)/${ENERGY_MAX}" | bc -l)
CYCLES=$(cat /sys/class/power_supply/BAT0/cycle_count)
CONSUMPTION=$(cat /sys/class/power_supply/BAT0/power_now)
TTL=$(echo "scale=2; (${ENERGY_NOW}/${CONSUMPTION})" | bc -l)

printf "\n%-25s %5s\n" "Battery capacity, %" "$CAPACITY"
printf "%-25s %5s\n" "Charge cycles" "$CYCLES"
printf "%-25s %5s\n\n" "Battery time left, hrs" "$TTL"
```

### Golang

```go
package main

import (
  "fmt"
  "os"
  "strconv"
  "strings"
)

const (
  F_ENERGY_FULL_DESIGN string = "/sys/class/power_supply/BAT0/energy_full_design"
  F_ENERGY_FULL        string = "/sys/class/power_supply/BAT0/energy_full"
  F_ENERGY_NOW         string = "/sys/class/power_supply/BAT0/energy_now"
  F_CYCLE_COUNT        string = "/sys/class/power_supply/BAT0/cycle_count"
  F_POWER_NOW          string = "/sys/class/power_supply/BAT0/power_now"
)

func readFileAsInt(filename string) (int, error) {
  data, err := os.ReadFile(filename)
  if err != nil {
    return 0, fmt.Errorf("unable to read file %s: %w", filename, err)
  }
  value, err := strconv.Atoi(strings.TrimSpace(string(data)))
  if err != nil {
    return 0, fmt.Errorf("unable to convert %s to int: %w", string(data), err)
  }
  return value, nil
}

func printRow(row []string, colWidths []int) {
  for i, col := range row {
    fmt.Printf("| %-*s ", colWidths[i], col)
  }
  fmt.Println("|")
}

func printSeparator(colWidths []int) {
  for _, width := range colWidths {
    fmt.Print("+")
    for i := 0; i < width+2; i++ {
      fmt.Print("-")
    }
  }
  fmt.Println("+")
}

func main() {
  var capacity, ttl float64
  headers := []string{"Parameter", "Unit", "Value"}
  colWidths := make([]int, len(headers))

  energyMax, err := readFileAsInt(F_ENERGY_FULL_DESIGN)
  if err != nil {
    fmt.Println(err)
    return
  }
  energyFull, err := readFileAsInt(F_ENERGY_FULL)
  if err != nil {
    fmt.Println(err)
    return
  }
  energyNow, err := readFileAsInt(F_ENERGY_NOW)
  if err != nil {
    fmt.Println(err)
    return
  }
  cycleCount, err := readFileAsInt(F_CYCLE_COUNT)
  if err != nil {
    fmt.Println(err)
    return
  }
  powerNow, err := readFileAsInt(F_POWER_NOW)
  if err != nil {
    fmt.Println(err)
    return
  }

  capacity = float64(energyFull*100) / float64(energyMax)
  ttl = float64(energyNow) / float64(powerNow)

  data := [][]string{
    {"Battery capacity", "%", strconv.FormatFloat(capacity, 'f', 2, 64)},
    {"Charge cycles", " ", strconv.Itoa(cycleCount)},
    {"Battery time left", "hrs", strconv.FormatFloat(ttl, 'f', 2, 64)},
  }

  for i, header := range headers {
    colWidths[i] = len(header)
  }

  for _, row := range data {
    for i, col := range row {
      if len(col) > colWidths[i] {
        colWidths[i] = len(col)
      }
    }
  }

  printSeparator(colWidths)
  printRow(headers, colWidths)
  printSeparator(colWidths)
  for _, row := range data {
    printRow(row, colWidths)
  }
  printSeparator(colWidths)
}

```

and it will show something like this:

```bash
# Bash
Battery capacity, %       85.88
Charge cycles               419
Battery time left, hrs     2.28

# Golang
+-------------------+------+-------+
| Parameter         | Unit | Value |
+-------------------+------+-------+
| Battery capacity  | %    | 87.09 |
| Charge cycles     |      | 499   |
| Battery time left | hrs  | 4.16  |
+-------------------+------+-------+
```

But numbers are not everything. I would also like to modify my battery settings so it will last longer!

This can be done by modifying values of `charge_*_threshold` files:

```bash
sudo -i
echo 80 > /sys/class/power_supply/BAT0/charge_stop_threshold
echo 80 > /sys/class/power_supply/BAT0/charge_control_end_threshold
echo 40 > /sys/class/power_supply/BAT0/charge_start_threshold
echo 40 > /sys/class/power_supply/BAT0/charge_control_start_threshold
```

This way the battery will start charging only when it's lower than 40% and stop charging when it reaches 80%, thus effectively prolonging laptop's life.

Values 40 and 80 may vary for your own liking.

## Other tools

If you're not like me and don't enjoy delving deep into the Linux filesystem, there are tools available on the internet to do exactly what I've described earlier.

For viewing information about the battery, there's the `upower` utility, which displays information about power sources available in the system.

For adjusting battery charge thresholds, there are open-source solutions like the Gnome extension "*Battery Health Charging*"[^4] (which I currently use) and many others, depending on your graphical environment and operating system.

::: info

    N.B.: All actions above have been performed on Fedora Linux 39, actual files and their location may vary.

:::

::: info Closing remarks

    As always, feel free to [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my mistakes and befriend me on one of the social media platforms listed below.

    During the process of writing this post, the following music compositions have been listened to:
    [*FromSoftware - Best Soundtracks / Demon Souls / Dark Souls / Bloodborne / Sekiro / Elden Ring*](https://www.youtube.com/watch?v=N3UYRtEMKuU).

:::

[^1]: [BU-415: How to Charge and When to Charge?](https://batteryuniversity.com/article/bu-415-how-to-charge-and-when-to-charge)
[^2]: [Linux kernel power supply class](https://www.kernel.org/doc/html/latest/power/power_supply_class.html#units)
[^3]: [power_supply.h](https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/tree/include/linux/power_supply.h?h=v6.0.11)
[^4]: [Battery Health Charging](https://extensions.gnome.org/extension/5724/battery-health-charging/)
