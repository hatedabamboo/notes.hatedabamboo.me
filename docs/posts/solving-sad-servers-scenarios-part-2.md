---
authors:
  - hatedabamboo
date:
  created: 2024-10-09
slug: sad-servers-pt-2
tags:
  - ctf
  - docker
  - linux
  - nginx
  - postgres
  - troubleshooting
  - ssl
title: "Solving Sad Servers scenarios: part 2"
---
In this series of articles, I will attempt to solve scenarios from the website
"Sad Servers" and provide detailed explanations of the tasks and solutions. The
website is described as "Like LeetCode for Linux", offering opportunities to
train and improve debugging and operating skills with Linux.

Part 2 includes scenarios 11 to 20.

<!-- more -->

![image](../assets/solving-sad-servers-scenarios.webp)

## Other parts

- Scenarios 1 to 10: [part 1](https://notes.hatedabamboo.me/sad-servers-pt-1/)

## Scenario 11. "Minneapolis": Break a CSV file

=== "Description"

    Link to the scenario to try out yourself: [Minneapolis](https://sadservers.com/scenario/minneapolis)

    In this scenario, we need to break one large CSV file into multiple smaller
    files of equal size.

=== "Solution"

    At first, it took me a while to figure out what should be used here. I
    tried calculating how many lines each file should have and populating each
    file with this calculated amount. However, the first batch turned out to be
    35 KB, which was larger than the allowed file size. So, I started thinking.

    What is the tool to print the first line of a file? It's `head -n 1`.
    What is the tool to print lines from 1 to 180? It's also
    `head -n 180 | tail -n 179`.
    And what is the tool to print the first 32 KB of data after the first line?
    You guessed it, it's `head` again -- with a little help from `tail`.

    So, the solution will look like this.

    First, we count the length of the file:

    ```shell
    $ wc -l data.csv
    1793 data.csv
    ```

    The first line is the header, so we will need all but the first. Next, we
    will check how much data is in the first line and determine how much data
    we can extract from the original file each time without exceeding the 32 KB
    limit.

    ```shell
    $ HEADER=$(head -n 1 data.csv)
    $ echo $HEADER | wc -c
    372
    $ echo $((32*1024-372))
    32396
    $ CONST=32396
    ```

    Now we have two variables: `HEADER`, which contains the first line of the
    file, and `CONST`, which holds the number of bytes we can use to populate
    each file.

    Since the files we need to create start from 0, we will populate the first
    file separately, and all the others in a loop:

    ```shell
    $ echo $HEADER > data-00.csv; tail -n 1792 data.csv | head -c $CONST >> data-00.csv
    $ for i in {1..9}; do echo $HEAD > "data-0${i}.csv"; tail -n 1792 data.csv | head -c $(($CONST*$(($i+1)))) | tail -c $CONST >> "data-0${i}.csv"; done
    $ ls -lh | grep "data-"
    -rw-r--r-- 1 admin admin  32K Oct  6 14:10 data-00.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-01.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-02.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-03.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-04.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-05.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-06.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-07.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-08.csv
    -rw-r--r-- 1 admin admin  32K Oct  6 14:14 data-09.csv
    $ bash -x agent/check.sh
    OK
    ```

    What's that loop? Let's break it down. Since the first file (`data-00.csv`)
    is already populated, we only need to fill the remaining files, from `01`
    to `09`. We print the last 1792 lines from the original file (excluding the
    first line), and in each iteration of the loop, we print consecutive 32 KB
    chunks of data.

    Since the first 32 KB chunk has already been taken, in each loop iteration,
    we choose the first 64 KB (`CONST` multiplied by `i + 1`, where `i` is the
    number of chunks to print) and then subtract only the last 32 KB of that
    chunk.

    Finally, we verify the correctness of our solution using a local script,
    and it confirms that everything works correctly.

## Scenario 12. "Saint Paul": Merge Many CSVs files

=== "Description"

    Link to the scenario to try out yourself: [Saint Paul](https://sadservers.com/scenario/st-paul)

    In this scenario, we will merge CSV files into one large CSV file. This
    seems like a reverse version of the previous task, and it looks pretty fun.

=== "Solution"

    So, we need to merge multiple CSV files into one, leaving only a single
    header at the very beginning of the file. Makes sense. Let's begin.

    I have a feeling that, as usual, this task has several possible approaches.
    I came up with the quickest and simplest one, in my opinion.

    First, let's save the header somewhere so we don't lose it.

    ```shell
    $ HEADER=$(head -n 1 polldayregistrations_enregistjourduscrutin10001.csv)
    ```

    Next, we'll remove all the headers from the CSV files. For this, we can use
    `sed` and its handy feature to delete lines by their number.

    ```shell
    $ sed -i '1d' *.csv
    ```

    Lastly, we will populate the final file with the saved header and append
    all the smaller files without their headers. After that, we can check our
    solution to ensure everything has been merged correctly.

    ```shell
    $ echo $HEADER > all.csv; cat polldayregistrations_enregistjourduscrutin*.csv >> all.csv
    $ wc -l all.csv
    72461 all.csv # just to be sure
    $ bash agent/check.sh
    OK
    ```

## Scenario 13. "Bata": Find in /proc

=== "Description"

    Link to the scenario to try out yourself: [Bata](https://sadservers.com/scenario/bata)

    In this scenario, we will find the secret value in a file located in the
    `/proc` pseudo-filesystem. Sounds easy enough.

=== "Solution"

    Ooooh, deep hacky stuff, interesting.

    First, let's try to find a non-zero-sized file in `/proc/sys`.

    ```shell
    $ cd /proc/sys
    $ find . -type f ! -size 0c
    $ find . -type f | wc -l
    1108
    ```

    Hmm, not quite what I was expecting. But at the same time, it makes sense.
    `/proc` is a pseudo-filesystem and thus does not have actual files written
    to the disk or memory.

    Okay, let's try good old brute force:

    ```shell
    $ find . -type f | xargs grep secret 2>/dev/null
    ./kernel/core_pattern:secret:<password>
    ```

    Here, I redirect `stderr` to `/dev/null` so that I only get files
    containing the string and not errors indicating that I have no access to
    certain files.

    And there it is—our secret password. Let's wrap it up by populating the
    secret file and checking the solution.

    ```shell
    $ realpath kernel/core_pattern
    /proc/sys/kernel/core_pattern
    $ cat $(realpath kernel/core_pattern ) | awk -F':' '{print $2}' > /home/admin/secret.txt
    $ bash /home/admin/agent/check.sh
    OK
    ```

## Scenario 14: "Geneva": Renew an SSL Certificate

=== "Description"

    Link to the scenario to try out yourself: [Geneva](https://sadservers.com/scenario/geneva)

    In this scenario, we will update the SSL certificate of the running server.

=== "Solution"

    I’m going to be honest: I Googled the solution to this task, as I don’t
    remember (and nobody does, I think) the specific commands to issue a
    self-signed certificate. Actually, it’s just one command, but still.

    So, the logic is as follows: we have to generate a self-signed pair of a
    certificate and key to verify that our TLS connection is safe and sound.
    Additionally, we need to preserve the original subject of the certificate
    (issuer company, location, country, etc.).

    My solution looks like this: First, we check the subject of the existing
    certificate. Then we generate a new certificate and key pair with the
    aforementioned subject, using the RSA algorithm, with a 10-year expiration
    (don’t do this in production; it’s very unsafe) and no DES (no prompt for a
    passphrase). After that, we back up the existing certificates (for safety's
    sake) and replace them with our newly generated ones. Lastly, we reload
    Nginx and check for the validity of the solution.

    ```shell
    $ echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -subject
    subject=CN = localhost, O = Acme, OU = IT Department, L = Geneva, ST = Geneva, C = CH
    $ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/CN=localhost/O=Acme/OU=IT Department/L=Geneva/ST=Geneva/C=CH"
    Generating a RSA private key
    ....................................++++
    ..........................................++++
    writing new private key to 'key.pem'
    -----
    $ echo $? # just in case
    0
    $ sudo mv *pem /etc/nginx/ssl
    $ cd /etc/nginx/ssl
    $ sudo mv nginx.crt{,.bk}; sudo mv nginx.key{,.bk}
    $ sudo mv cert.pem nginx.crt; sudo mv key.pem nginx.key
    $ sudo nginx -t
    nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
    nginx: configuration file /etc/nginx/nginx.conf test is successful
    $ sudo nginx -s reload
    $ echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates
    notBefore=Oct  6 15:27:09 2024 GMT
    notAfter=Oct  4 15:27:09 2034 GMT
    $ echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -subject
    subject=CN = localhost, O = Acme, OU = IT Department, L = Geneva, ST = Geneva, C = CH
    $ bash /home/admin/agent/check.sh
    OK
    ```

    In modern administration, the manual renewal of SSL certificates is a thing
    of the past, thanks to Certbot[^2] and Let's Encrypt[^3]. Because of this,
    we usually don't have to use the `openssl` program that much. Personally, I
    use it only to check certificate dates, verify website certificates, and
    sometimes to generate random strings. For these purposes, it’s more than
    sufficient to write some custom shell functions or aliases[^4]. For more
    complex usage, there are some pretty good cheatsheets[^5] available, and,
    of course, the official documentation[^6].

## Scenario 15: "Manhattan": can't write data into database

=== "Description"

    Link to the scenario to try out yourself: [Manhattan](https://sadservers.com/scenario/manhattan)

    In this scenario, we will figure out why PostgreSQL can't write data and
    fix the issue.

=== "Solution"

    This step marks the transition from easy tasks to the "Medium" level. Or so
    I thought.

    Usually, the issue of something being unable to write data is tied to one
    of two reasons: it either lacks access or there is no free space. Let's
    start with the simplest one:

    ```shell
    # df
    Filesystem      1K-blocks    Used Available Use% Mounted on
    udev               229200       0    229200   0% /dev
    tmpfs               47660    1520     46140   4% /run
    /dev/nvme1n1p1    8026128 1233668   6363204  17% /
    tmpfs              238300       0    238300   0% /dev/shm
    tmpfs                5120       0      5120   0% /run/lock
    tmpfs              238300       0    238300   0% /sys/fs/cgroup
    /dev/nvme1n1p15    126710     278    126432   1% /boot/efi
    /dev/nvme0n1      8378368 8378340        28 100% /opt/pgdata
    ```

    Yep, and there it is. Let's find out why it's filled to the brim.

    ```shell
    # cd /opt/pgdata/
    # ls -la
    total 8285624
    drwxr-xr-x  3 postgres postgres         82 May 21  2022 .
    drwxr-xr-x  3 root     root           4096 May 21  2022 ..
    -rw-r--r--  1 root     root             69 May 21  2022 deleteme
    -rw-r--r--  1 root     root     7516192768 May 21  2022 file1.bk
    -rw-r--r--  1 root     root      967774208 May 21  2022 file2.bk
    -rw-r--r--  1 root     root         499712 May 21  2022 file3.bk
    drwx------ 19 postgres postgres       4096 May 21  2022 main
    ```

    As you can see, there are several files of unreasonable size located near
    the database root directory (`main`). Let's delete them and restart the
    database to see if that helps.

    ```shell
    # rm deleteme file*.bk
    # systemctl restart postgresql
    # ss -ntupl | grep 5432
    tcp   LISTEN 0      128                           127.0.0.1:5432        0.0.0.0:*                         users:(("postgres",pid=919,fd=5))
    ```

    Very nice! The listening port indicates that the database is alive and
    accepting connections. Let's finish the task by using the provided command
    and check our solution.

    ```shell
    # sudo -u postgres psql -c "insert into persons(name) values ('jane smith');" -d dt
    INSERT 0 1
    # bash /home/admin/agent/check.sh
    OK
    ```

    Honestly, I was astonished that the entire task took me only 3 minutes:

    ```text
    Solution is correct, you made a sad server happy, congrats!
    It took you 3 minutes and 6 seconds.
    You used 0 clues.
    Your earned 2 points.
    ```

    I was expecting a bit more of a challenge.

## Scenario 16: "Tokyo": can't serve web file

=== "Description"

    Link to the scenario to try out yourself: [Tokyo](https://sadservers.com/scenario/tokyo)

    In this scenario, we will figure out why the web server does not serve a
    specific local file.

=== "Solution"

    Usually, the problem of a web server not being able to serve a certain file
    is due to a lack of necessary permissions. Let's check them.

    ```shell
    # cd /var/www/html
    # ls -l
    total 4
    -rw------- 1 root root 16 Aug  1  2022 index.html
    ```

    Okay, this file actually has root-level access only, so let's change the
    permissions and check again.

    ```shell
    # chmod 666 index.html
    # curl 127.0.0.1:80
    ^C
    # curl -v 127.0.0.1:80
    *   Trying 127.0.0.1:80...
    ^C
    ```

    Well, that's something. My initial idea was completely off track. We can't
    even connect to the dedicated port, which is honestly surprising. Let's
    see how our iptables are configured.

    ```shell
    # iptables -nvL
    Chain INPUT (policy ACCEPT 1296 packets, 102K bytes)
    pkts bytes target     prot opt in     out     source               destination
      12   720 DROP       tcp  --  *      *       0.0.0.0/0            0.0.0.0/0            tcp dpt:80

    Chain FORWARD (policy ACCEPT 0 packets, 0 bytes)
    pkts bytes target     prot opt in     out     source               destination

    Chain OUTPUT (policy ACCEPT 1232 packets, 478K bytes)
    pkts bytes target     prot opt in     out     source               destination
    ```

    And here it is. The first rule drops all packets targeted at 80/TCP, which
    is our web server. That's an easy fix.

    ```shell
    # iptables -D INPUT 1
    # curl 127.0.0.1:80
    hello sadserver
    ```

    And we have successfully fixed the issue.

    In modern times, when we typically don't work with hardware servers
    directly, `iptables` have been replaced by virtual entities like
    Security Groups[^7] and more user-friendly software like UFW[^8]. However,
    they still remain the de facto default firewall software on almost every
    Linux machine, which makes them, if not necessary to learn, at least
    important to remember that they exist.

## Scenario 17. "Cape Town": Borked Nginx

=== "Description"

    Link to the scenario to try out yourself: [Cape Town](https://sadservers.com/scenario/capetown)

    In this scenario, we will figure out why Nginx is not responding on
    127.0.0.1 and fix this issue.

=== "Solution"

    This task looked pretty simple at first glance. Since it's stated in the
    task definition that Nginx is managed by systemd, let's check the unit and
    see what the error is. And there it is:

    ```text
    unexpected ";" in /etc/nginx/sites-enabled/default:1
    ```

    Let's fix the semicolon (don't forget `sudo`) and see our welcome pa --
    wait, what the hell is this?

    ```shell
    $ sudo systemctl restart nginx
    $ curl 127.0.0.1:80
    <html>
    <head><title>500 Internal Server Error</title></head>
    <body>
    <center><h1>500 Internal Server Error</h1></center>
    <hr><center>nginx/1.18.0</center>
    </body>
    </html>
    ```

    This is interesting. Let's check the Nginx logs.

    ```shell
    2024/10/09 07:17:41 [crit] 829#829: *1 open() "/var/www/html/index.nginx-debian.html" failed (24: Too many open files), client: 127.0.0.1, server: _, request: "HEAD / HTTP/1.1", host: "127.0.0.1"
    2024/10/09 07:17:58 [crit] 829#829: *2 open() "/var/www/html/index.nginx-debian.html" failed (24: Too many open files), client: 127.0.0.1, server: _, request: "GET / HTTP/1.1", host: "127.0.0.1"
    ```

    Well, this is unexpected. But we can work with that. Linux sets limits for
    open files (and not just for them) to manage resources and prevent users
    from overwhelming the system with garbage. However, these limits can be
    configured per session. Let's do exactly that.

    ```shell
    $ ulimit -n
    1024
    $ ulimit -n 65535
    $ ulimit -n
    65535
    $ sudo systemctl restart nginx
    $ curl 127.0.0.1:80
    <html>
    <head><title>500 Internal Server Error</title></head>
    <body>
    <center><h1>500 Internal Server Error</h1></center>
    <hr><center>nginx/1.18.0</center>
    </body>
    </html>
    $ sudo su
    # ulimit
    unlimited
    # ulimit -n
    1024
    # ulimit -n 65535
    # curl 127.0.0.1:80
    <html>
    <head><title>500 Internal Server Error</title></head>
    <body>
    <center><h1>500 Internal Server Error</h1></center>
    <hr><center>nginx/1.18.0</center>
    </body>
    </html>
    ```

    It seems that this theory is not working either. Let's check one more
    thing: the systemd unit file.

    ```shell
    # systemctl cat nginx
    # /etc/systemd/system/nginx.service
    [Unit]
    Description=The NGINX HTTP and reverse proxy server
    After=syslog.target network-online.target remote-fs.target nss-lookup.target
    Wants=network-online.target

    [Service]
    Type=forking
    PIDFile=/run/nginx.pid
    ExecStartPre=/usr/sbin/nginx -t
    ExecStart=/usr/sbin/nginx
    ExecReload=/usr/sbin/nginx -s reload
    ExecStop=/bin/kill -s QUIT $MAINPID
    PrivateTmp=true
    LimitNOFILE=10

    [Install]
    WantedBy=multi-user.target
    # vim /etc/systemd/system/nginx.service
    # systemctl daemon-reload
    # systemctl restart nginx
    # curl 127.0.0.1:80
    <!DOCTYPE html>
    <html>
    <head>
    <title>Welcome to nginx!</title>
    <style>
        body {
            width: 35em;
            margin: 0 auto;
            font-family: Tahoma, Verdana, Arial, sans-serif;
        }
    </style>
    </head>
    <body>
    <h1>Welcome to nginx!</h1>
    <p>If you see this page, the nginx web server is successfully installed and
    working. Further configuration is required.</p>

    <p>For online documentation and support please refer to
    <a href="http://nginx.org/">nginx.org</a>.<br/>
    Commercial support is available at
    <a href="http://nginx.com/">nginx.com</a>.</p>

    <p><em>Thank you for using nginx.</em></p>
    </body>
    </html>
    ```

    And there it is! The `LimitNOFILE=10` option in the unit file limits the
    number of open files for the process, much like `ulimit`, but at the
    process level instead of the session level. That's why the previous actions
    didn't succeed—the parameter was defined in the unit file! 

    After changing the systemd Nginx unit file, don't forget to re-read the
    file (`systemctl daemon-reload`) and restart Nginx. 

    This was a fun challenge. Way to go!

## Scenario 18. "Salta": Docker container won't start

=== "Description"

    Link to the scenario to try out yourself: [Salta](https://sadservers.com/scenario/salta)

    In this scenario, we will build a container and run it to receive the
    successful "Hello World!" when accessing its port.

=== "Solution"

    Oh, I love containers and working with them. Even though I'm not super
    familiar with all their internal workings, I still enjoy their concept,
    simplicity, and convenience. Let's start by inspecting what we have in the
    directory.

    ```shell
    $ pwd
    /
    $ cd /home/admin/app
    $ ls -l
    total 108
    -rw-r--r-- 1 admin admin   523 Sep 16  2022 Dockerfile
    -rw-r--r-- 1 admin admin 95602 Sep 16  2022 package-lock.json
    -rw-r--r-- 1 admin admin   274 Sep 16  2022 package.json
    -rw-r--r-- 1 admin admin   442 Sep 16  2022 server.js
    $ view Dockerfile
    ```
    
    There are two mistakes: the exposed port is set to 8880 instead of 8888,
    and Node.js will try to find the `serve.js` file instead of `server.js`.
    Let's fix these issues, build the container, and start it.

    ```shell
    $ sudo docker build .
    Sending build context to Docker daemon  101.9kB
    Step 1/7 : FROM node:15.7-alpine
    ---> 706d12284dd5
    Step 2/7 : WORKDIR /usr/src/app
    ---> Using cache
    ---> 463b1571f18e
    Step 3/7 : COPY ./package*.json ./
    ---> Using cache
    ---> acfb467c80ba
    Step 4/7 : RUN npm install
    ---> Using cache
    ---> 5cad5aa08c7a
    Step 5/7 : COPY ./* ./
    ---> 3fa14ec5be32
    Step 6/7 : EXPOSE 8888
    ---> Running in 0e804b4aab61
    Removing intermediate container 0e804b4aab61
    ---> c86a752fb55a
    Step 7/7 : CMD [ "node", "server.js" ]
    ---> Running in f7acfe893d4b
    Removing intermediate container f7acfe893d4b
    ---> 44f802b9ca1f
    Successfully built 44f802b9ca1f
    $ sudo docker run -d 44f802b9ca1f
    c2d983e30eab7ee66903361a539c985aa1c9f84e8a94bb494406df8705e2b35b
    $ curl localhost:8888
    these are not the droids you're looking for
    ```

    That's a bummer. It seems we're accessing the wrong application. Let's
    check what's interfering with our solution and try to remediate it.

    ```shell
    $ sudo ss -ntupl | grep 8888
    tcp   LISTEN 0      511                            0.0.0.0:8888      0.0.0.0:*    users:(("nginx",pid=617,fd=6),("nginx",pid=616,fd=6),("nginx",pid=615,fd=6))
    tcp   LISTEN 0      511                               [::]:8888         [::]:*    users:(("nginx",pid=617,fd=7),("nginx",pid=616,fd=7),("nginx",pid=615,fd=7))
    $ sudo systemctl stop nginx
    $ sudo docker stop nervous_murdock
    nervous_murdock
    $ sudo docker run -d -p 8888:8888 44f802b9ca1f
    b2e840cd43f984acaf6d280c13cecf99a810c842ad3b53bc7c70bca5207ee021
    $ curl localhost:8888
    Hello World!
    ```

    And thus, the task is complete.

## Scenario 19. "Venice": Am I in a container?

=== "Description"

    Link to the scenario to try out yourself: [Venice](https://sadservers.com/scenario/venice)

    In this scenario, we will figure out if we're inside a container or a
    typical VM.

=== "Solution"

    This seems like a tricky task. Let's give it a try.

    ```shell
    root@i-053affe660803ffa7:/# hostnamectl
      Static hostname: i-053affe660803ffa7
            Icon name: computer-container
              Chassis: container
           Machine ID: 63c73c4425ed4630b1d72c9ed07a0bdd
              Boot ID: 1c275d50bd2142658cd032ff2143aa61
       Virtualization: container-other
     Operating System: Debian GNU/Linux 11 (bullseye)
               Kernel: Linux 5.10.0-14-cloud-amd64
         Architecture: x86-64
    ```

    Oh, wait, never mind.  

    Just kidding. It's funny, though. The more robust approach is to check
    running processes (`ps aux`) for kernel threads (`[kthreadd]`), which will
    indicate the host machine.

## Scenario 20. "Oaxaca": Close an Open File

=== "Description"

    Link to the scenario to try out yourself: [Oaxaca](https://sadservers.com/scenario/oaxaca)

    In this scenario, we will remove the file descriptor to the file without
    killing the process.

=== "Solution"

    We have another task dedicated to file descriptors (FD) and the magic
    surrounding them. Honestly, I've never encountered a situation where I
    couldn't kill the process to release the FD. So, I had to Google how one
    can close the FD without interfering with the parent process.

    ```shell
    $ cd
    $ ls -l
    total 8
    drwxr-xr-x 2 admin admin 4096 Nov 30  2022 agent
    -rwxr-xr-x 1 admin admin   43 Nov 30  2022 openfile.sh
    -rw-r--r-- 1 admin admin    0 Oct  9 08:43 somefile
    $ lsof somefile 
    COMMAND PID  USER   FD   TYPE DEVICE SIZE/OFF   NODE NAME
    bash    811 admin   77w   REG  259,1        0 272875 somefile
    $ exec 77<&-
    $ lsof somefile 
    $ bash agent/check.sh 
    OK
    ```

    And just like that, we found the corresponding FD (`77w`, which means the
    process opened the file for writing) and closed it using the `exec 77<&-`
    command.

    What does this command mean? `exec` is a built-in Bash command that
    executes commands in the current shell by replacing the command itself
    without forking it. `77` is the FD we want to operate on, and `<&-` is the
    command to close the file descriptor.

    Show this to someone without extensive Linux knowledge, and they will
    (rightfully so) think that this is nonsense and that all Linux engineers
    are madmen.

    ![Stop using unix](./../assets/stop-using-unix.png)

>>>

!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.

[^1]: [proc(5)](https://man7.org/linux/man-pages/man5/proc.5.html)
[^2]: [Certbot](https://certbot.eff.org/)
[^3]: [Let's Encrypt](https://letsencrypt.org/)
[^4]: [dotfiles](https://github.com/hatedabamboo/dotfiles/tree/master)
[^5]: [The Only OpenSSL CheatSheet You Will Need!](https://www.golinuxcloud.com/openssl-cheatsheet/)
[^6]: [OpenSSL Documentation](https://docs.openssl.org/3.0/man1/openssl/)
[^7]: [Control traffic to your AWS resources using security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)
[^8]: [UFW](https://help.ubuntu.com/community/UFW)
