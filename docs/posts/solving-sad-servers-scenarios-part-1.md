---
authors:
  - hatedabamboo
date:
  created: 2024-08-07
  updated: 2024-10-09
slug: sad-servers-pt-1
tags:
  - ctf
  - kubernetes
  - linux
  - postgres
  - troubleshooting
categories:
  - "⬢⬢⬡ Intermediate"
title: "Solving Sad Servers scenarios: part 1"
---
In this series of articles, I will attempt to solve scenarios from the website
"Sad Servers" and provide detailed explanations of the tasks and solutions. The
website is described as "Like LeetCode for Linux", offering opportunities to
train and improve debugging and operating skills with Linux.

Part 1 includes scenarios 1 to 11 (scenario 10 is locked behind a paywall and
will be discussed in another article).

<!-- more -->

![image](../assets/solving-sad-servers-scenarios.webp){ .off-glb }

!!! warning "09.10.2024 update"

    Since the creation of this guide a few changes have been made to Sad
    Servers: an old scenario has been removed ("Santiago"[^3]). Unfortunalety,
    it cannot be reached anymore, so it will stay here in limbo. Forever.

## Other parts

- Scenarios 11 to 20: [part 2](https://notes.hatedabamboo.me/sad-servers-pt-2/)

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

I don't expect my solutions to be the only correct ones. They are the result
of my experience and understanding of the task. As long as you get the correct
result, your solution is as good as mine.

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
    Alice in all the txt files and a specific number in the file with only one
    such name.

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
    another approach because this was kind of boring. (Turns out this file does
    not actually has the solution, but tips on how to propose one).

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

    Or I could just read the hints and solve the puzzle as it was meant to.

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

## Scenario 6. "Resumable Server": Linux Upskill Challenge

=== "Description"

    Link to the scenario to try out yourself: [Resumable Server](https://sadservers.com/scenario/luc)

    This scenario is not a puzzle at all. It's an invitation to learn Linux
    tools and programs to upgrade your skills. The set of tasks included in
    the 'Linux Upskill Challenge'[^1] is quite broad and, by the looks of it,
    may easily help you feel confident working with Linux servers or, in my
    case, refresh my memory and dust off long-unused skills.

## Scenario 7. "Lhasa": Easy Math

=== "Description"

    Link to the scenario to try out yourself: [Lhasa](https://sadservers.com/scenario/lhasa)

    This scenario asks us to calculate the average score from all the values in
    the `scores.txt` file.

=== "Solution"

    This puzzle is simple and straightforward. To calculate the arithmetic
    mean, we need to get the sum of all the values (scores) and divide it by
    the total number of scores. The `bc` tool can help us with this.

    `bc`, a byte calculator (presumably), reads input from a file or stdin and
    calculates the equation provided. Additionally, it can be configured with
    the `scale` parameter to set the precision of the resulting number.

    The file consists of two columns: the participant's number (I think) and
    their score. Since we don't need the first one (we can simply count the
    number of lines in the file), let's omit it and print the scores in a way
    that allows us to calculate the mean:

    ```shell
    TOTAL=$(cat scores.txt | wc -l)
    SUM=$(for i in $(awk '{print $2}' scores.txt); do echo -n "$i+"; done | sed 's/+$//')
    ```

    This loop will print all the scores with a `+` sign after each one, but it
    will remove the last `+` sign at the end of the line and assign the result
    to the `SUM` variable. This allows us to copy and paste it into the next
    command:

    ```shell
    echo "scale=2; ($SUM)/$TOTAL" | bc -l
    ```

    And this is our answer. In this command, we calculate the sum of all the
    scores and divide it by the total number of participants. The `scale`
    parameter ensures the precision is exactly two digits to the right of the
    decimal point.

    Thanks, `bc`!

## Scenario 8. "Bucharest": Connecting to Postgres

=== "Description"

    Link to the scenario to try out yourself: [Bucharest](https://sadservers.com/scenario/bucharest)

    This scenario asks us to fix the connection to the database. It's quite an
    important exercise, I must say, and very helpful in the real world.

=== "Solution"

    We are presented with a PostgreSQL database, but the connection is not
    working. To identify the issue, let's try connecting to it using the
    connection string provided in the task:

    ```shell
    PGPASSWORD=app1user psql -h 127.0.0.1 -d app1 -U app1user -c '\q'
    ```

    And here's the error: `FATAL:  pg_hba.conf rejects connection for host
    "127.0.0.1", user "app1user", database "app1", SSL off`. That's already a
    good start. This error message indicates that the issue is not with the
    network connection but rather with the database configuration.

    To solve this issue, we'll need to properly configure `pg_hba.conf` to
    allow local connections. HBA stands for host-based authentication. The file
    we're looking for is located in the `/etc/postgresql/VERSION/main`
    directory, in this scenario VERSION is 13. Don't forget to use `sudo`!

    ```shell
    sudo vim /etc/postgresql/13/main/pg_hba.conf
    ```

    Locate in this file the lines containing the authorization method. As you
    can see, the host connections have a `reject` status, meaning these
    connections are not allowed. Let's change them to `md5`, save the file
    (`:wq`), and restart the database to update its configuration.

    ```shell
    sudo systemctl restart postgresql
    ```

    Now, repeat the first command with `psql`. The issue has been resolved!

## Scenario 9. "Bilbao": Basic Kubernetes Problems

=== "Description"

    Link to the scenario to try out yourself: [Bilbao](https://sadservers.com/scenario/bilbao)

    In this task, we need to identify the issue with the Kubernetes deployment
    and fix the pods so that we can access the Nginx web server.

=== "Solution"

    Oh, it's been a while since my CKA certification[^2], and this is a good
    opportunity to refresh my memory.

    Let's start by observing what we have:

    ```shell
    kubectl get pods
    ```
    
    This shows us that we have a deployment called "nginx-deployment" and that
    it's not in a healthy state. Let's see what's wrong with it.

    ```shell
    kubectl describe pod nginx-deployment-67699598cc-zrj6f
    ```

    From the "Events" block, we see that there are 2 nodes, but 0 are
    available: `0/2 nodes are available: 1 node(s) didn't match Pod's node
    affinity/selector, 1 node(s) had untolerated taint
    {node.kubernetes.io/unreachable: }. preemption: 0/2 nodes are available: 2
    Preemption is not helpful for scheduling.`

    Oh shit, here we go again. Let's take a look at these nodes.

    ```shell
    kubectl get nodes
    ```

    As you can see, one node is in the "NotReady" state. The "Condition" shows
    that `Kubelet stopped posting node status`, which means we need to restart
    the kubelet. However, we don't have access to the node (or I didn't find
    the proper port for it).

    What other options do we have? Let's return to the initial scheduling
    error. We see that the pod's affinity and selectors are not matching the
    existing nodes. Let's remove them! We have a `manifest.yml` file with our
    deployment described. Let's remove the `resources` and `node_selector`
    sections and apply the new configuration:

    ```shell
    kubectl apply -f manifest.yml
    ```

    The result is:

    ```shell
    deployment.apps/nginx-deployment configured
    service/nginx-service unchanged
    ```

    And after a few moments one pod is finally alive and kicking on the
    required address.

    Was it the cleanest solution? I highly doubt that. Did it get me the
    correct result? Damn right it did!

## Scenario 11. "Gitega": Find the Bad Git Commit

=== "Description"

    Link to the scenario to try out yourself: [Gitega](https://sadservers.com/scenario/gitega)

    In this scenario, we need to find the commit in the Git repository that
    caused the test executions to fail.

=== "Solution"

    Ah, Git basics. I love them.

    Let's navigate to the `git` directory and run `go test` for the first time
    to confirm that it's failing.

    ```shell
    admin@i-0473c52173c6a3108:~/git$ go test
    --- FAIL: TestHandler (0.00s)
        main_test.go:22: handler returned unexpected body: got Hey! /
            want Hey: /
    FAIL
    exit status 1
    FAIL    github.com/fduran/git_bisect    0.005s
    ```

    Yep, it's broken alright.

    Now, we need to find the exact commit that broke the tests. For this, we'll
    use `git log` with some specific arguments:

    - `git log` shows the full history with commit hash, author, date, and
    commit message; this provides too much information.
    - `git log --oneline` shows only the first 8 characters of the commit hash
    and the commit message; this is useful for checking out commits but not for
    providing the exact commit hash.
    - `git log --pretty="format:%H"` shows only the full commit hash; this is
    what we're looking for.

    The resulting list is organized with the most recent commit on top and the
    oldest at the bottom. Although we could start from the top, it makes more
    sense to begin by examining the earliest errors in the code base.
    Therefore, we need to reverse the list:
    
    ```shell
    git log --pretty="format:%H" --reverse
    ```

    Wonderful! Now, let's switch to each commit using the `git checkout`
    command and run the tests each time:

    ```shell
    for i in $(git log --pretty="format:%H" --reverse); do
      git checkout $i &>/dev/null && go test || break
    done
    echo $i > /home/admin/solution
    ```

    This loop will break at the first unsuccessful test execution. The last
    printed commit hash is the one we're looking for.

!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.

[^1]: [Linux Upskill Challenge](https://linuxupskillchallenge.org/)
[^2]: [CKA or not CKA: my thoughts about certification and stuff](https://notes.hatedabamboo.me/cka-or-not-cka/)
[^3]: ["Santiago": Find the secret combination](#scenario-3-santiago-find-the-secret-combination)
