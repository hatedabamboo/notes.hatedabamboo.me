---
title: "RDS-Style Point-in-Time Recovery for Self-Hosted PostgreSQL"
date: 2026-10-14
tags:
  - aws
  - postgres
  - rds
layout: layouts/post.njk
permalink: /pitr-for-self-hosted-postgres/
---
One of the features I always found most impressive in RDS was point-in-time-recovery. Throughout my career I never had an opportunity to work deeply with database administration, so the ability to rollback the state of the DB to the exact moment seemed at least magical. Recently I finally had a chance to set up such a feature for our own databases, and today I'm going to share my experience with it and how it's done.

<!-- more -->

![Title image](/assets/rds-style-point-in-time-recovery-for-self-hosted-postgresql.webp)

## The idea of saving the data

If you read my blog, you must be at least familiar with the concept of backing up the data. It may sound silly, but it's important not only in work, but in personal life as well.

Imagine a situation: a company that claimed they will give free* unlimited** photo storage forever*** suddenly decides to reduce the storage size, then to make it cost money, and eventually sunset the service. Seem familiar? Would be a shame to loose all those years of happy memories at once.

In business backups carry less emotional attachment directly, but more of operational and reputational risks. Losing client's data may be sad for individual clients and quite costly for major institutional ones.

That's why we have backups.

The idea is quite simple: you copy the data from one place to (preferably) another, somewhere distant, and keep that copy. Backup frequency can be different -- once a month, once a week, once a day or hourly. To choose the correct schedule you first must decide how much data you can afford to loose -- this is what's called **RPO**, Recovery Point Objective. It is the time frame between your last backup and the incident that caused the data loss. The lesser RPO the better, ideally near-zero.

Closing RPO times to near-zero introduced the next level of data retention. Realtime stream of events from main database to the secondary one, keeping exact same copy of data in two separate places with seconds-to-miliseconds of lag. Seems familiar? Because it is!

Replication is the neat form of data backup that comes with additional benefits. Replicated database can be used as a read-only replica for the writer instance, splitting the load between two and increasing overall throughput.

It comes with additional complexity, though: whereas backups can be just a zipped archive of the files on a disk, replica must be exact same form of data storage (in this case, similar database instance). Archives require only storage space, replica requires compute capacity, RAM and network on top of storage.

## We have a backup, how do we restore it?

Backups in vacuum are nice to have, but useless. Who needs an archive of the data, if there's no way to use it? Hopefully you and I will never have to use it, but it's important have them nonetheless!

Restoring the data from a backup usually comes in two situations: either you're validating their correctness and validity (and you absolutely should!), or you've encountered an incident that corrupted data.

If you have a running replica instance -- you're most likely in luck! If the data corruption hasn't been replicated to another instance, all you need to do is to switch roles from master to replica and vice versa, and you're good. Complications arise if the incident was an erroneous query that altered unnecessary data and the change was replicated.

Restoring data from a hard backup takes much more time[^1], and the data loss is higher -- between the moment of incident and the last created backup, the RPO we talked about earlier.

But there is another option, that provides benefits of replication with the ability to select exact moment in time to which we want to restore the data -- point-in-time recovery, **PITR**.

## What is Point-in-time Recovery and how does it work

Modern databases are utilizing a mechanism called Write-Ahead Log (WAL). It works as follows: prior to committing a transaction (writing actual changes to tables and indices), database engine ensures that the information about that change has been flushed to the permanent storage (written to disk). This mechanism ensures that in case of an incident or database system crash, the transaction can be replayed by reading this log and applying changes from it. It also provides an additional benefit of reducing disk writes on every transaction, since we already have the WAL written to the disk, and transaction themselves can be written later in bulk for more effectiveness.

PITR utilizes WAL archiving to restore the data to the exact moment in time, before or after the incident.

This is how the restoration works. First, the physical copy of the database is restored to the state it was at the moment of the backup, point *t*. Second, the WAL is applied to that database to replay all the transactions from point *t* to the point *r*, the restoration point (before or after the incident). Finally, we turn the database back on and all the data is there, as if nothing every happened.

That is the beauty of point-in-time recovery. It's exceptionally convenient for exact data restoration. It allows reducing the amount of full-size physical backups by making them less frequent and filling the gaps with continuous WAL segments. And it utilizes the database-native mechanism for crash recovery, meaning it's already as effective as it can be.

The downside is, however, the complexity to set it up.

## Setting up PITR for PostgreSQL with pgBackRest

There are several tools that tackle the same problem in a slightly different way.

There's [WAL-G](https://github.com/wal-g/wal-g), a fairly popular backup and restoration tool for multiple database engines. There's [Databasus](https://github.com/databasus/databasus), database backup and restoration tool specifically for Postgres which is shipped with UI. There's [Barman](https://github.com/EnterpriseDB/barman), backup and recovery manager for Postgres, solving all the same problems. And there's [pgBackRest](https://pgbackrest.org/).

The variety is good, and perhaps you'll find something that suits your specific needs. During my research I stumbled upon a nice [overview article](https://dev.to/piteradyson/postgresql-backup-tools-comparison-databasus-wal-g-pgbackrest-and-barman-2kg) describing advantages and disadvantages of different methods. My final decision for our purposes landed on pgBackRest.

For starters, we need a Postgres database. It can be a standalone instance or a replicated setup. For simplicity, I will focus on standalone setup.

### Installing pgBackRest

pgBackRest can be found in the majority of package managers -- apt, yum -- and this is very simple to install.

```bash
# debian-based distributives
sudo apt update
sudo apt install -y pgbackrest
# rhel-based distributives
sudo dnf install -y pgbackrest
# and verify
pgbackrest version
```

pgBackRest runs as the same user as Postgres, so make sure all the directories are properly owned:

```bash
sudo mkdir -p /etc/pgbackrest /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest
sudo chown postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest 
sudo chmod 750 /var/lib/pgbackrest
```

### Configuring the repository

pgBackRest calls the place where backups and WAL archives are stored a repository. It can be a local directory, a mounted network drive, or an S3-compatible cloud storage. Configuration for a particular Postgres cluster is called a stanza.

#### Uploading backups to S3

Remember "copy the data to another place, preferably somewhere distant"? A backup on the same disk as the database will die together with that disk. So instead of storing everything locally let's get ourself rid of this headache and configure the stanza to upload backups directly to S3. Create a configuration file in `/etc/pgbackrest/pgbackrest.conf`[^2]:

```ini
[global]
repo1-type=s3
repo1-path=/pgbackrest
repo1-s3-bucket=my-db-backups
repo1-s3-endpoint=s3.eu-central-1.amazonaws.com
repo1-s3-region=eu-central-1
repo1-s3-key=<access key>
repo1-s3-key-secret=<secret key>
repo1-retention-full=4

[postgres]
pg1-path=/var/lib/postgresql/18/main
pg1-port=5432
```

`[postgres]` in the name of the stanza, and the most important parameter here is `pg1-path` -- the location of database files stored locally. In the example above it's set to default for Postgres 18, for different version changes only the number. If your setup is _special_, check the correct path with `SHOW data_directory;`

If the server runs on EC2 with an IAM role, replace the key pair with `repo2-s3-key-type=auto`. In case there's no ability to utilize EC2 Instance Profiles, keep permissions of the bot for this job to a bare minimum.

When archiving to remote storage it's also worth enabling asynchronous archiving, so a slow network doesn't hold up WAL processing on the database:

```ini
[global]
archive-async=y
spool-path=/var/spool/pgbackrest
```

The spool directory must exist and also be owned by `postgres`.

### Telling Postgres to ship its WAL

Now the database itself needs to hand over every finished WAL segment to pgBackRest. Add the following configuration lines in `postgresql.conf` (or whichever file you have your database configured in):

```ini
archive_mode = on
archive_command = 'pgbackrest --stanza=main archive-push %p'
archive_timeout = 60
```

`wal_level` must be `replica` or higher, but that's the default since Postgres 10, so unless someone changed it you're fine.

`archive_timeout` deserves a separate word. By default, Postgres archives a WAL segment only when it's full (16 MB). On a quiet database it may take hours. Losing hours of data sucks, so instead we tell Postgres to switch segments every 60s if there's any activity. This way in a worst case scenario only a minute of data will be lost. Worth nothing, though, that every minute segment still weighs 16 MB, but almost-emtpy one in archived form will be almost negligible in size.

Changing `archive_mode` requires a restart:

```bash
sudo systemctl restart postgresql
```

### Creating the stanza and checking everything works

```bash
sudo -u postgres pgbackrest --stanza=postgres stanza-create
sudo -u postgres pgbackrest --stanza=postgres check
```

First command initializes the repository. But `check` is more important here: it forces Postgres to switch to a new WAL segment and waits until that segment shows up in the repository. If `check` passes, archiving works. If it doesn't -- look into `/var/log/pgbackrest/` and the Postgres log; it's almost always permissions or a typo in the config.

### Taking backups

Now for some fun. To trigger the full backup we use the following commands:

```bash
sudo -u postgres pgbackrest --stanza=postgres --type=full backup
```

pgBackRest supports three types of backups:

- **full** -- copies the whole database;
- **diff** (differential) -- copies everything changed since the last _full_ backup;
- **incr** (incremental) -- copies everything changed since the last backup _of any type_.

Without `--type`, pgBackRest takes an incremental backup (or a full one, if there's nothing to increment from).

Physical backups are the basics of the data retention, but the actual magic is the continuous WAL archive between them. And they don't have to be frequent. Daily full backups are no joke load-wise and can take significant amount of time. A safe start is to make full backups weekly and on the other days just incrementally (or differentially -- here I use the terms interchangeably) back up the data:

```bash
cat <<'EOF' | sudo tee /etc/cron.d/pgbackrest
# full backup every Sunday at 01:30
30 1 * * 0    postgres  pgbackrest --stanza=postgres --type=full backup
# differential backup on all other days
30 1 * * 1-6  postgres  pgbackrest --stanza=postgres --type=diff backup
EOF
```

Old backups are cleaned up automatically after each backup, this is what `repo1-retention-full` is for. With four full backups kept and a weekly full, you can roll back anywhere between one and four weeks into the past, depending on the day. Same goes for WALs that are no longer needed.

### Testing the setup

Backups you've never restored from are a fun little surprise that you might not want to open. Setting up the database backup system we have to be sure that backups are actual consistent copies of the data and not an incident card.

```sql
CREATE TABLE important (id int, note text);
INSERT INTO important VALUES (1, 'pls do not delete me'), (2, 'and me pls');

SELECT now(); -- save the output!

DELETE FROM important;  -- oops, forgot the WHERE. been there done that, amirite?

SELECT pg_switch_wal();
```

The last line forces Postgres to close the current WAL segment and archive it right away instead of waiting for `archive_timeout`. Alternatively you can wait for a minute, if you set it so previously. This is important, because to stop at the target time, Postgres has to see WAL from _after_ that moment. If the WAL containing the `DELETE` event hasn't reached the repository yet, recovery runs out of WAL before reaching the target and refuses to finish.

Now the restore itself. To keep the data consistent Postgres must be stopped first:

```bash
sudo systemctl stop postgresql

sudo -u postgres pgbackrest --stanza=postgres \
	--delta \
    --type=time "--target=<exact copy of timestamptz from `SELECT now();` earlier>" \
    --target-action=promote \
    restore

sudo systemctl start postgresql
```

What happens here:

- pgBackRest picks the latest backup made before the target time -- our point _t_ -- and restores it into the data directory;
- `--delta` makes it reuse files already in the data directory and replace only the ones whose checksums differ, which is much faster than copying everything. Without it the data directory must be empty;
- it writes the recovery settings (`restore_command`, `recovery_target_time`) into `postgresql.auto.conf` and creates a `recovery.signal` file;
- on start, Postgres fetches WAL from the repository and replays transactions up to point _r_, the target;
- `--target-action=promote` tells Postgres to open for writes once the target is reached.

Sound complicated? It is! Let's check if the oh-so-important data is back

```sql
SELECT * FROM important;
--  id |          note
-- ----+-------------------------
--   1 | pls do not delete me
--   2 | and me pls
```

As if nothing ever happened.

### Validating backups regularly

I mentioned it earlier and I'll repeat myself: test your backups. pgBackRest has a `verify` command that checks the repository for missing or corrupted files:

```bash
sudo -u postgres pgbackrest --stanza=postgres verify
```

It's a good sanity check, but it only proves the files are intact, not that you can actually bring a database up from them. The only real proof is a restore. Ideally an automated one: a scheduled job that restores the latest backup to a throwaway instance, runs a couple of queries, and alerts if something is off. This will also tell you your real RTO -- how long a restore of your database _actually_ takes, not how long you think it will. Don't forget to add some time for panicking and figuring out what the hell is actually happening.

## Wrapping up

Before setting point-in-time recovery all by myself I though they were some advanced tech, but I didn't think it was that easy to set them up. Magic or not, this feature is so cool I actually wonder how I never encountered one in the wild (and I speak not of AWS RDS instances, but in the self-hosted scenarios). Granted, the correct setup, configuration AND periodical backup validation (restoration validation, not simply `verify`!) take so much mental load that without a DBA or a senior-level engineer it's nigh impossible to pull through. But now you know and can!

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20RDS-Style%20Point-in-Time%20Recovery%20for%20Self-Hosted%20PostgreSQL">Reply to this post ✉️</a></p>

[^1]: In business terms time between the incident and the full restoration is called **RTO**, recovery time objective. I'd call it unfuckup window.
[^2]: Older versions used `/etc/pgbackrest.conf`, and some packages still create it. pgBackRest checks `/etc/pgbackrest/pgbackrest.conf` first and falls back to the old location, so keep only one of them to avoid confusion.
