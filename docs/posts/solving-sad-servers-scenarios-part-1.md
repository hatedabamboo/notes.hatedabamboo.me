---
draft: true
authors:
  - hatedabamboo
date:
  created: 2024-08-05
slug: sad-servers-pt-1
tags:
  - linux
  - troubleshooting
  - ctf
title: "Solving Sad Servers scenarios: part 1"
---
In this series of articles, I will attempt to solve scenarios from the website
"Sad Servers" and provide detailed explanations of the tasks and solutions. The
website is described as "Like LeetCode for Linux", offering opportunities to
train and improve debugging and operating skills with Linux.

Part 1 includes scenarios 1 to 5.

<!-- more -->

![image](../assets/solving-sad-servers-scenarios-part-1.webp)

## Intro

Some time ago, I stumbled upon this catchy title, "Like LeetCode but for
Linux", and was immediately intrigued by the opportunity. A quick peek at the
website confirmed my expectations: it's a CTF (Capture The Flag) challenge for
Linux administrators and DevOps engineers that may be interesting, complicated,
and informative.

And it was exactly that. Plus, it was super fun. So, of course, after finishing
a few tasks, I decided to write a series of articles for these challenges, as
it's just as fun solving them as it is describing the thought process behind
the solutions.

I urge you to complete the challenges by yourself, as they may be of immense
value in improving your skills. If a task is too hard for you to crack, I will
describe solutions to them in these articles. To avoid unintentional spoilers,
solutions will be hidden under named tabs.

## Scenario 1. "Saint John": what is writing to this log file?

=== "Description"

    Link to the scenario to try out yourself: [Saint John](https://sadservers.com/scenario/saint-john)

    In this scenario, we are tasked to find the application that writes to the
    logfile and kill it.

=== "Solution"

    This task is pretty simple. The logic behind the solution goes like this:
    in order to be able to write continuously to the file, each application
    opens a file descriptor to this file, in our case `/var/log/bad.log`. All
    of the file descriptors for the application can be found under its process
    PID in the `/proc` virtual filesystem: `/proc/PID/fd`. One of the possible
    approaches is to list all the file descriptors in the `/proc` directory and
    then `grep` the needed file. But instead, we can use the handy `lsof`
    command and provide the log file as an argument to see which processes use
    this file at the moment.

    ```shell
    lsof /var/log/bad.log
    ```

    And kill the process.

    ```shell
    kill PID
    ```

## Scenario 2. "Saskatoon": counting IPs

=== "Description"

    Link to the scenario to try out yourself: [Saskatoon](https://sadservers.com/scenario/saskatoon)

    In this scenario, we have to find the most common IP address in the website
    logs and write it to a file. I cannot overstate the importance of this
    task; DoS and DDoS attacks are no joke.

=== "Solution"

    This case is clearly made for the `awk` and `sort` commands. We have the
    file; let's find the most common IP address in it. At first, let's see
    which field we will need.

    ```shell
    head /home/admin/access.log
    ```

    It looks like a typical nginx log. The IP address is the first field. Let's
    find the most active one.

    ```shell
    awk '{print $1}' /home/admin/access.log | sort | uniq -c | sort -nk 1
    ```

    Here, we print only the first field from each line of the log; then, we
    sort the addresses alphabetically. Next, we calculate the number of unique
    occurrences of each address and print the number of occurrences and the IP
    address. Finally, the last command sorts the resulting list by the numeric
    value of the first field. This address should be written to the file.
    
    The final one-liner for this scenario looks like this:

    ```shell
    awk '{print $1}' /home/admin/access.log \
      | sort \
      | uniq -c \
      | sort -nk 1 \
      | tail -n 1 \
      | awk '{print $NF}' > /home/admin/highestip.txt
    ```

## Scenario 3. "Santiago": Find the secret combination

=== "Description"

    Link to the scenario to try out yourself: [Santiago](https://sadservers.com/scenario/santiago)

    In this scenario, we have to calculate the number of lines with the name
    Alice in all the files and a specific number in the file with only one such
    name.

=== "Solution"

    This task is meant to be solved with `grep`, and we will calculate the
    number of lines containing the name "Alice" in the text files.

    ```shell
    grep Alice /home/admin/*.txt | wc -l
    ```

    `wc -l` in this command counts the number of lines from `grep` command.

    Next, we have to find a file with only one occurrence of "Alice".

    ```shell
    cd /home/admin
    for i in *.txt; do
      echo -n "$i "
      grep Alice $i | wc -l
    done
    ```

    This small loop will print the name of the file and the number of
    occurrences of names in each file. Copy the name of the file with only one
    occurrence of "Alice" in it, and let's find the number on the next line.

    ```shell
    grep -A 1 Alice file.txt
    ```

    Argument `-A 1` prints one line after the occurrence, which is exactly the
    functionality we need.
    
    Now, combine the two numbers and write them into the specified file.

    ```shell
    echo 123456 > /home/admin/solution
    ```

## Scenario 4. "The Command Line Murders"

=== "Description"

    Link to the scenario to try out yourself: [The Command Line Murders](https://sadservers.com/scenario/command-line-murders)

    Okay, this is the tricky one. This scenario asks us to find the murderer
    and write his name into the file. Quite eerie.

=== "Solution"

    This is the first task for which I had no idea how to solve it. So, upon
    entering the VM, I dove into strange possibilities. I noticed that one
    directory was actually a Git repository, so I checked what was there and
    saw a deleted file named "solution". I restored it and decided to try
    another approach because this was kind of boring.

    I tried to look for clues in the files and found very few of them. I
    attempted to read all the files, but given how many there were, I abandoned
    the idea almost immediately.

    So, I approached it from the other side. The scenario allows you to check
    your answer by providing you with the MD5 hash of the resulting string. I
    also noticed a file called "people" somewhere. Hmm.

    ```shell
    awk '{print $1, $2}' people | while read line; do
      echo -n "$line "
      echo "$line" | md5sum
    done | grep 9bba101c7369f49ca890ea96aa242dd5
    ```
    And here's how I got the name of the murderer.
    
    What's happening here? I print only the name and surname of the person, one
    by one for each line. Then, I calculate the hash of each line and print
    them both in the format "{Name} {Surname} {MD5 hash}". Finally, I search
    for the line with the specific hash, the one from the answer.
    
    I doubt that my solution is the correct one, but hey, I got the answer
    right! It's not always about the most correct approach in our line of work.
    Sometimes, the fastest solution is preferable.

## Scenario 5. "Taipei": Come a-knocking

=== "Description"

    Link to the scenario to try out yourself: [Taipei](https://sadservers.com/scenario/taipei)

    This scenario introduces port knocking as a tool to close open web services
    behind a specific sequence of TCP SYN packets. We have to find a specific
    port to knock in order to unlock the web server on `localhost:80`.

=== "Solution"

    Okay, this was the hard one. I had never encountered port knocking before
    and had no idea how it works. I had a feeling that the firewall had
    something to do with it, but unfortunately, `iptables` were locked behind
    `sudo` access.

    So, I went googling to find out what port knocking is and how to do it
    properly. It turns out there's a specific tool called `knock` for this
    purpose, which was already preinstalled in the VM. I thought that maybe I
    could find the necessary port to knock.

    ```shell
    ss -ntupl
    ```

    Several of them were there, but knocking on none of them opened the local
    web server for my requests.

    Feeling rather lost, I opted for the most basic approach: brute force.

    ```shell
    for i in $(seq 1 65535); do
      knock localhost $i
    done
    ```

    It took several seconds to complete, but after this brute force loop, I was
    able to see the desired response from the local web server. I don't know
    exactly which port it was, but we can figure it out.

    ```shell
    for i in $(seq 1 65535); do
      knock localhost $i
      curl localhost 2>/dev/null && echo "Port was $i" && break
    done
    ```

    In this script, we will iterate over all available ports until we find the
    one that, after knocking, causes `curl` to return an exit code of 0. We
    will then print the number of this port and `break` the loop.

!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.
