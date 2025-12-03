---
title: "Advent of Sysadmin 2025"
date: 2025-12-02
tags:
  - docker
  - nginx
  - troubleshooting
layout: layouts/post.njk
permalink: /advent-of-sysadmin-2025/
---
Advent season is here! And that means advent challenges as well!

After a [disastrous attempt](https://github.com/hatedabamboo/AoC2024) at Advent of Code last year, this year I was very happy to see that Sad Servers started an Advent challenge of their own -- [Advent of Sysadmin](https://sadservers.com/advent)! And this means more challenges for us to tackle. The Advent will consist of 12 challenges. To keep things slightly more interesting, I will publish the solution to each task the day after it's released: for example, today, on December 2, I will solve the task from December 1, and so on. Have fun!

<!-- more -->

![Title image](/assets/solving-sad-servers-scenarios.webp)

## Auderghem: containers miscommunication

::: note Description

    There is an nginx Docker container that listens on port 80, the purpose of which is to redirect the traffic to two other containers statichtml1 and statichtml2 but this redirection is not working. Fix the problem.

:::

We connect to the server, and the first thing we check is the running Docker containers:

```bash
admin@i-03fc55a1924a48445:~$ docker ps
CONTAINER ID   IMAGE          COMMAND                  CREATED        STATUS         PORTS                                 NAMES
89bf0e394bb9   statichtml:2   "busybox httpd -f -v…"   26 hours ago   Up 8 seconds   3000/tcp                              statichtml2
1f96c1876662   statichtml:1   "busybox httpd -f -v…"   26 hours ago   Up 8 seconds   3000/tcp                              statichtml1
7440094fc321   nginx          "/docker-entrypoint.…"   26 hours ago   Up 8 seconds   0.0.0.0:80->80/tcp, [::]:80->80/tcp   nginx
```

We can see that the `statichtml` containers are set up to serve port 3000. Let's check if we can curl them:

```bash
admin@i-03fc55a1924a48445:~$ curl -v localhost/1
* Host localhost:80 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:80...
* Connected to localhost (::1) port 80
* using HTTP/1.x
> GET /1 HTTP/1.1
> Host: localhost
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
```

Okay, so the problem is that the `nginx` container can't reach the `statichtml{1,2}` containers. Duh. Let's see how they're configured in the web server.

```bash
admin@i-03fc55a1924a48445:~$ docker exec -ti nginx cat /etc/nginx/conf.d/default.conf
    server {
        listen 80;
        location / {
            root   /usr/share/nginx/html;
            index  index.html index.htm;
        }
        location /1 {
            rewrite ^ / break;
            proxy_pass http://statichtml1.sadservers.local;
            proxy_connect_timeout   2s;
            proxy_send_timeout      2s;
            proxy_read_timeout      2s;
        }
        location /2 {
            rewrite ^ / break;
            proxy_pass http://statichtml2.sadservers.local;
            proxy_connect_timeout   2s;
            proxy_send_timeout      2s;
            proxy_read_timeout      2s;
        }
```

The web server is configured to connect to the backends on port 80. Let's see if we can change the `default.conf`.

```bash
admin@i-03fc55a1924a48445:~$ docker inspect nginx | jq .[0].Mounts
[
  {
    "Type": "bind",
    "Source": "/home/admin/app/default.conf",
    "Destination": "/etc/nginx/conf.d/default.conf",
    "Mode": "",
    "RW": true,
    "Propagation": "rprivate"
  }
]
admin@i-03fc55a1924a48445:~$ vim app/default.conf 
admin@i-03fc55a1924a48445:~$ docker restart nginx
nginx
admin@i-03fc55a1924a48445:~$ docker exec -ti nginx cat /etc/nginx/conf.d/default.conf | grep local 
            proxy_pass http://statichtml1.sadservers.local:3000;
            proxy_pass http://statichtml2.sadservers.local:3000;
```

We can see that `default.conf` is actually mounted from the home directory of the VM we're working on, which means we can modify the file and restart the container -- which we did. Let's see if it helped:

```bash
admin@i-03fc55a1924a48445:~$ curl -v localhost/1
* Host localhost:80 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:80...
* Connected to localhost (::1) port 80
* using HTTP/1.x
> GET /1 HTTP/1.1
> Host: localhost
> User-Agent: curl/8.14.1
> Accept: */*
> 
* Request completely sent off
^C
```

No, still no luck. Let's check how the containers' network is configured.

```bash
admin@i-03fc55a1924a48445:~$ docker inspect nginx | jq .[0].NetworkSettings.Networks
{
  "bridge": {
...
  }
}
admin@i-03fc55a1924a48445:~$ docker inspect statichtml1 | jq .[0].NetworkSettings.Networks
{
  "static-net": {
    "IPAMConfig": {
      "IPv4Address": "172.172.0.11"
    },
...
}
```

Oh, so the containers are in different networks! That's a bummer, but we can fix this. As per the task, we're only allowed to restart containers. This means we can't recreate a container in a new network, so we'll have to hot-swap networks. Luckily, with bridge networks, we can do that. And since both statichtml containers share the same network, it's much more convenient to connect the `nginx` container to the `static-net` network:

```bash
admin@i-03fc55a1924a48445:~$ docker network connect static-net nginx
admin@i-03fc55a1924a48445:~$ ./agent/check.sh 
OK
```

And just like that, we've successfully finished the first task!

## Marseille: Rocky Security

::: note Description

    As the Christmas shopping season approaches, the security team has asked Mary and John to implemente more security measures. Unfortunately, this time they have broken the LAMP stack; the frontend is unable get an answer from upstream, thus they need your help again to fix it.

    The application should be able to serve the content from the webserver. 

:::

Oh, the ol' reliable. I have to say, I never actually spent meaningful time with the LAMP stack (thankfully?). My go-to web server has always been nginx, database -- Postgres, and backend language -- Python and Go. Perhaps that's why my hair is so soft and shiny, and my body smells like flower blossoms. Regardless, let's see what we're dealing with.

```bash
[admin@i-0e0450878ee67b460 etc]$ journalctl -feu httpd
Dec 02 19:44:29 i-0e0450878ee67b460.us-east-2.compute.internal systemd[1]: Starting httpd.service - The Apache HTTP Server...
Dec 02 19:44:29 i-0e0450878ee67b460.us-east-2.compute.internal (httpd)[1009]: httpd.service: Referenced but unset environment variable evaluates to an empty string: OPTIONS
Dec 02 19:44:29 i-0e0450878ee67b460.us-east-2.compute.internal systemd[1]: Started httpd.service - The Apache HTTP Server.
Dec 02 19:44:29 i-0e0450878ee67b460.us-east-2.compute.internal httpd[1009]: Server configured, listening on: port 80
^C
[admin@i-0e0450878ee67b460 etc]$ curl localhost
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>503 Service Unavailable</title>
</head><body>
<h1>Service Unavailable</h1>
<p>The server is temporarily unable to service your
request due to maintenance downtime or capacity
problems. Please try again later.</p>
</body></html>
```

Interesting -- we're getting a 503. That's unusual. Let's see what the logs have to tell us.

```bash
[admin@i-0e0450878ee67b460 etc]$ cd /var/log/httpd
bash: cd: /var/log/httpd: Permission denied
```

Are you cereal.

```bash
[admin@i-0e0450878ee67b460 etc]$ sudo su
cdcd[root@i-0e0450878ee67b460 etc]# cd /var/log/httpd
[root@i-0e0450878ee67b460 httpd]# ls -la
total 12
drwx------.  2 root root   41 Dec  2 03:38 .
drwxr-xr-x. 11 root root 4096 Dec  2 02:52 ..
-rw-r--r--.  1 root root   80 Dec  2 19:45 access_log
-rw-r--r--.  1 root root 1786 Dec  2 19:45 error_log
[root@i-0e0450878ee67b460 httpd]# cat error_log | tail -n 5
[Tue Dec 02 19:44:29.672346 2025] [suexec:notice] [pid 1009:tid 1009] AH01232: suEXEC mechanism enabled (wrapper: /usr/sbin/suexec)
[Tue Dec 02 19:44:29.701088 2025] [lbmethod_heartbeat:notice] [pid 1009:tid 1009] AH02282: No slotmem from mod_heartmonitor
[Tue Dec 02 19:44:29.703021 2025] [systemd:notice] [pid 1009:tid 1009] SELinux policy enabled; httpd running as context system_u:system_r:httpd_t:s0
[Tue Dec 02 19:44:29.718645 2025] [mpm_event:notice] [pid 1009:tid 1009] AH00489: Apache/2.4.63 (Rocky Linux) configured -- resuming normal operations
[Tue Dec 02 19:44:29.718687 2025] [core:notice] [pid 1009:tid 1009] AH00094: Command line: '/usr/sbin/httpd -D FOREGROUND'
[Tue Dec 02 19:45:05.837552 2025] [proxy:error] [pid 1038:tid 1111] (13)Permission denied: AH00957: FCGI: attempt to connect to 127.0.0.1:9001 (127.0.0.1:9001) failed
[Tue Dec 02 19:45:05.837594 2025] [proxy_fcgi:error] [pid 1038:tid 1111] [client ::1:39934] AH01079: failed to make connection to backend: 127.0.0.1
```

This looks like a misconfiguration -- let's double-check if we're right.

```bash
[root@i-0e0450878ee67b460 ~]# ss -ntupl | grep 900
tcp   LISTEN 0      4096       127.0.0.1:9000      0.0.0.0:*    users:(("php-fpm",pid=1029,fd=9),("php-fpm",pid=1028,fd=9),("php-fpm",pid=1027,fd=9),("php-fpm",pid=1026,fd=9),("php-fpm",pid=1025,fd=9),("php-fpm",pid=969,fd=7))
[root@i-0e0450878ee67b460 ~]# cd /etc/httpd/conf.d/
[root@i-0e0450878ee67b460 conf.d]# ls -la
total 24
drwxr-xr-x. 2 root root  122 Dec  2 02:52 .
drwxr-xr-x. 5 root root  105 Dec  2 02:52 ..
-rw-r--r--. 1 root root  157 Dec  2 02:52 000-default.conf
-rw-r--r--. 1 root root 2916 Aug 16 00:00 autoindex.conf
-rw-r--r--. 1 root root 1577 Apr  9  2025 php.conf
-rw-r--r--. 1 root root  400 Aug 16 00:00 README
-rw-r--r--. 1 root root 1252 Aug 16 00:00 userdir.conf
-rw-r--r--. 1 root root  653 Aug 16 00:00 welcome.conf
[root@i-0e0450878ee67b460 conf.d]# vi 000-default.conf 
[root@i-0e0450878ee67b460 conf.d]# systemctl restart httpd
```

Yes, Apache was configured to proxy requests to `127.0.0.1:9001`, but `php-fpm` served the backend on port `9000`. I changed the port to the correct one. Unfortunately, to no avail.

```bash
[root@i-0e0450878ee67b460 ~]# curl localhost
<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>503 Service Unavailable</title>
</head><body>
<h1>Service Unavailable</h1>
<p>The server is temporarily unable to service your
request due to maintenance downtime or capacity
problems. Please try again later.</p>
</body></html>
```

And this is where I got stuck. Not only have I never actually administered in‑depth Apache servers with a PHP backend, I've never seen Rocky Linux, and I had basically no idea where to look or what to look for. Fifteen minutes dedicated to solving the task seemed like a mockery. I crawled through every step once again, trying to find keywords to lead me. In the httpd logs I actually found one: SELinux.

What is SELinux? It's a Security‑Enhanced Linux kernel module that often causes more trouble than help if configured improperly -- something I've encountered many times, this time included. A quick search for "selinux apache 503" showed that the default SELinux policy blocks httpd network requests, which causes exactly this error. Oh, security, you never fail to amaze me!

```bash
[root@i-0e0450878ee67b460 conf.d]# getsebool httpd_can_network_connect 
httpd_can_network_connect --> off
```

And, of course, it was forbidden! Let's fix this issue.

```bash
[root@i-0e0450878ee67b460 conf.d]# setsebool httpd_can_network_connect 1
[root@i-0e0450878ee67b460 conf.d]# getsebool httpd_can_network_connect 
httpd_can_network_connect --> on
[root@i-0e0450878ee67b460 conf.d]# curl localhost | head -1
SadServers - LAMP Stack
[root@i-0e0450878ee67b460 conf.d]# cd
[root@i-0e0450878ee67b460 ~]# 
exit
[admin@i-0e0450878ee67b460 ~]$ ./agent/check.sh 
OK
```

And this, my friends, is a successful solution to the second task!

## Kortenberg: Can't touch this!

::: note Description

    Is "All I want for Christmas is you" already everywhere?. A bit unrelated, someone messed up the permissions in this server, the admin user can't list new directories and can't write into new files. Fix the issue.

    **NOTE**: Besides solving the problem in your current admin shell session, you need to fix it permanently, as in a new login shell for user "admin" (like the one initiated by the scenario checker) should have the problem fixed as well.

:::

Oh boy, this is going to be one of those tasks, isn't it? Let's see what exactly we're dealing with here.

```bash
admin@i-038be5ca7a3896dec:~$ ls -la
total 32
drwx------ 5 admin admin 4096 Dec  1 00:31 .
drwxr-xr-x 3 root  root  4096 Sep  7 16:29 ..
drwx------ 3 admin admin 4096 Sep  7 16:31 .ansible
-rw-r--r-- 1 admin admin  220 Jul 30 19:28 .bash_logout
-rw-r--r-- 1 admin admin 3526 Jul 30 19:28 .bashrc
-rw-r--r-- 1 admin admin  796 Dec  1 00:31 .profile
drwx------ 2 admin admin 4096 Sep  7 16:29 .ssh
-rw-r--r-- 1 admin admin    0 Sep  7 16:31 .sudo_as_admin_successful
drwxrwxrwx 2 admin admin 4096 Dec  1 00:31 agent
admin@i-038be5ca7a3896dec:~$ touch file
admin@i-038be5ca7a3896dec:~$ ls -la file
---------- 1 admin admin 0 Dec  3 21:27 file
admin@i-038be5ca7a3896dec:~$ echo >> file
bash: file: Permission denied
```

Interesting. So right from the get-go, the admin user creates a file with `000` permissions. This looks a whole lot like yet another obscure way to utilize one of the many Linux security features. But this time it's `umask` tricks. Let's check if my assumption is correct.

```bash
admin@i-038be5ca7a3896dec:~$ umask
0777
```

Yep, this is `umask` all right. But where does it get set? The description was quite straightforward that the solution has to be permanent, so changing the umask mode in the current shell won't do. This means one of the shell configuration files has to be found and altered.

```bash
admin@i-038be5ca7a3896dec:~$ cat .bashrc | grep umask
admin@i-038be5ca7a3896dec:~$ cat .profile | grep umask
# the default umask is set in /etc/profile; for setting the umask
# for ssh logins, install and configure the libpam-umask package.
admin@i-038be5ca7a3896dec:~$ grep umask /etc/profile
umask 777
admin@i-038be5ca7a3896dec:~$ sudo sed -i '/umask/d' /etc/profile
admin@i-038be5ca7a3896dec:~$ sudo su
root@i-038be5ca7a3896dec:/home/admin# su - admin
admin@i-038be5ca7a3896dec:~$ touch file2
admin@i-038be5ca7a3896dec:~$ ls -l file2
---------- 1 admin admin 0 Dec  3 21:28 file2
admin@i-038be5ca7a3896dec:~$ umask
0777
```

Dang it. I will have to be more eloquent after all.

```bash
admin@i-038be5ca7a3896dec:~$ 
logout
root@i-038be5ca7a3896dec:/home/admin# echo 'umask 0011' >> .bashrc 
root@i-038be5ca7a3896dec:/home/admin# su - admin
admin@i-038be5ca7a3896dec:~$ umask
0011
admin@i-038be5ca7a3896dec:~$ touch file3
admin@i-038be5ca7a3896dec:~$ ls -l file3
-rw-rw-rw- 1 admin admin 0 Dec  3 21:30 file3
admin@i-038be5ca7a3896dec:~$ bash agent/check.sh 
OK
```

Oh well, good enough to solve the scenario -- good enough for me.

On a sidenote, time and time again I catch myself thinking, "Oh wow, what a variety of ways Linux can be confusing and unfriendly to the user." But then again, things happen for a reason. I wanted to complain here about the ubiquitous nature of `umask` and how it's so much more confusing than the good old `chmod`, but then I realized that they serve different purposes and aren't entirely antagonistic in nature -- they're complementary. While `chmod` helps keep permissions under control after a file or directory has been created, `umask` enforces them right from the start. Effectively, it's a safety belt for when you forget a too-permissive directory somewhere in `/bin`.


---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Advent%20of%20Sysadmin%202025">Reply to this post ✉️</a></p>
