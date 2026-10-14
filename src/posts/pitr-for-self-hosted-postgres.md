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
One of the features I always found most impressive in RDS was point-in-time recovery. Throughout my career I'd never had an opportunity to work deeply with database administration, so the ability to roll back the state of a database to an exact moment seemed at least magical. Recently I finally had a chance to set up such a feature for our own databases, and today I'm going to share my experience with it and how it's done.

<!-- more -->

![Title image](/assets/pitr-for-self-hosted-postgres.webp)

## The idea of saving the data

If you read my blog, you must be at least somewhat familiar with the concept of backing up data. It may sound silly, but it's important not only at work, but in personal life as well.

Imagine a situation: a company that claimed it would give you free* unlimited** photo storage forever*** suddenly decides to reduce the storage size, then to make it cost money, and eventually sunsets the service. Sound familiar? It would be a shame to lose all those years of happy memories at once.

In business, backups carry less emotional attachment, but more operational and reputational risk. Losing clients' data may be sad for individual clients and quite costly for major institutional ones.

That's why we have backups.

The idea is quite simple: you copy the data from one place to (preferably) another, somewhere distant, and keep that copy. Backup frequency can vary -- once a month, once a week, once a day or hourly. To choose the correct schedule you first have to decide how much data you can afford to lose -- this is what's called **RPO**, Recovery Point Objective. It is the maximum acceptable time frame between your last backup and the incident that caused the data loss. The lower the RPO, the better, ideally near-zero.

Bringing RPO close to zero introduced the next level of data retention: a real-time stream of events from the main database to a secondary one, keeping an exact copy of the data in two separate places with seconds-to-milliseconds of lag. Sound familiar? Because it is!

Replication is a neat form of data redundancy that comes with additional benefits. A replicated database can be used as a read-only replica for the writer instance, splitting the read load between the two and increasing overall throughput.

It comes with additional complexity, though: whereas a backup can be just a zipped archive of the files on a disk, a replica must be the exact same kind of data storage (in this case, a similar database instance). Archives require only storage space; a replica requires compute capacity, RAM and network on top of storage.

## We have a backup, how do we restore it?

Backups in a vacuum are nice to have, but useless. Who needs an archive of the data if there's no way to use it? Hopefully you and I will never have to use them, but it's important to have them nonetheless!

Restoring data from a backup usually happens in one of two situations: either you're validating that your backups are correct and usable (and you absolutely should!), or you've encountered an incident that corrupted data.

If you have a running replica instance -- you're most likely in luck! If the data corruption hasn't been replicated to the other instance, all you need to do is switch roles from master to replica and vice versa, and you're good. Complications arise if the incident was an erroneous query that altered data it shouldn't have, and the change was replicated.

Restoring data from a hard backup takes much more time[^1], and the data loss is higher -- everything between the last created backup and the moment of the incident, the RPO we talked about earlier.

But there is another option that combines the benefits of replication with the ability to select the exact moment in time we want to restore the data to -- point-in-time recovery, **PITR**.

## What is point-in-time recovery and how does it work

Most modern databases use a mechanism called the Write-Ahead Log (WAL). It works as follows: before any change is written to the actual tables and indexes, the database engine records that change in the log and makes sure the log has been flushed to permanent storage (written to disk). A transaction counts as committed once its log record is on disk. This mechanism ensures that in case of an incident or a system crash, the transaction can be replayed by reading the log and applying the changes from it. It also provides an additional benefit of reducing disk writes on every transaction: since the WAL is already safely on disk, the changes to the tables themselves can be written later in bulk, which is more efficient.

PITR uses WAL archiving to restore the data to an exact moment in time, before or after the incident.

This is how the restoration works. First, the physical copy of the database is restored to the state it was in at the moment of the backup, point *t*. Second, the WAL is applied to that database to replay all the transactions from point *t* to point *r*, the restoration point (before or after the incident). Finally, we turn the database back on and all the data is there, as if nothing ever happened.

That is the beauty of point-in-time recovery. It's exceptionally convenient for precise data restoration. It allows reducing the number of full-size physical backups by making them less frequent and filling the gaps with continuous WAL segments. And it uses the database's native crash recovery mechanism, meaning it's already about as efficient as it can be.

The downside, however, is the complexity of setting it up.

## Setting up PITR for PostgreSQL with pgBackRest

There are several tools that tackle the same problem in slightly different ways.

There's [WAL-G](https://github.com/wal-g/wal-g), a fairly popular backup and restoration tool for multiple database engines. There's [Databasus](https://github.com/databasus/databasus), a backup and restoration tool focused on Postgres that ships with a web UI. There's [Barman](https://github.com/EnterpriseDB/barman), a backup and recovery manager for Postgres, solving all the same problems. And there's [pgBackRest](https://pgbackrest.org/).

The variety is good, and perhaps you'll find something that suits your specific needs. During my research I stumbled upon a nice [overview article](https://dev.to/piteradyson/postgresql-backup-tools-comparison-databasus-wal-g-pgbackrest-and-barman-2kg) describing the advantages and disadvantages of the different tools. My final decision for our purposes landed on pgBackRest.

For starters, we need a Postgres database. It can be a standalone instance or a replicated setup. For simplicity, I will focus on a standalone setup.

### Installing pgBackRest

pgBackRest is available in most package managers -- apt, dnf/yum -- and is very simple to install. On RHEL-based systems it comes from the PostgreSQL (PGDG) repository, so add that first if you haven't already.

```bash
# debian-based distributions
sudo apt update
sudo apt install -y pgbackrest
# rhel-based distributions
sudo dnf install -y pgbackrest
# and verify
pgbackrest version
```

pgBackRest runs as the same user as Postgres, so make sure all the directories are properly owned:

```bash
sudo mkdir -p /etc/pgbackrest /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest
sudo chown postgres:postgres /var/lib/pgbackrest /var/log/pgbackrest /var/spool/pgbackrest
sudo chmod 750 /var/lib/pgbackrest
```

### Configuring the repository

pgBackRest calls the place where backups and WAL archives are stored a repository. It can be a local directory, a mounted network drive, or cloud object storage. The configuration for a particular Postgres cluster is called a stanza. All of it lives in a single file, `/etc/pgbackrest/pgbackrest.conf`[^2].

#### Uploading backups to S3

Remember "copy the data to another place, preferably somewhere distant"? A backup on the same disk as the database will die together with that disk. So instead of storing everything locally, let's rid ourselves of this headache and configure the stanza to upload backups directly to S3:

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

`[postgres]` is the name of the stanza, and the most important parameter here is `pg1-path` -- the location of the database files on the local disk. In the example above it's set to the default for Postgres 18 on Debian/Ubuntu; for a different version only the number changes. RHEL-based systems use `/var/lib/pgsql/18/data` instead. If your setup is _special_, check the correct path with `SHOW data_directory;`

If the server runs on EC2 with an IAM role, replace the key pair with `repo1-s3-key-type=auto`. If you can't use EC2 instance profiles, keep the permissions of the IAM user for this job to the bare minimum (list, get, put and delete on that one bucket).

When archiving to remote storage it's also worth enabling asynchronous archiving, so a slow network doesn't hold up WAL processing on the database:

```ini
[global]
archive-async=y
spool-path=/var/spool/pgbackrest
```

The spool directory must exist and also be owned by `postgres`.

### Telling Postgres to ship its WAL

Now the database itself needs to hand over every finished WAL segment to pgBackRest. Add the following lines to `postgresql.conf` (or whichever file you configure your database in):

```ini
archive_mode = on
archive_command = 'pgbackrest --stanza=postgres archive-push %p'
archive_timeout = 60
```

`wal_level` must be `replica` or higher, but that's the default since Postgres 10, so unless someone changed it you're fine.

`archive_timeout` deserves a separate word. By default, Postgres archives a WAL segment only when it's full (16 MB). On a quiet database that may take hours. Losing hours of data sucks, so instead we tell Postgres to switch segments every 60 seconds if there's been any activity. This way, in the worst-case scenario, only a minute of data will be lost. Worth noting, though: every one-minute segment still weighs 16 MB, but an almost-empty one compresses to a negligible size in the archive.

Changing `archive_mode` requires a restart:

```bash
sudo systemctl restart postgresql
```

### Creating the stanza and checking everything works

```bash
sudo -u postgres pgbackrest --stanza=postgres stanza-create
sudo -u postgres pgbackrest --stanza=postgres check
```

The first command initializes the repository. But `check` is more important here: it forces Postgres to switch to a new WAL segment and waits until that segment shows up in the repository. If `check` passes, archiving works. If it doesn't -- look into `/var/log/pgbackrest/` and the Postgres log; it's almost always permissions or a typo in the config.

### Taking backups

Now for some fun. To trigger a full backup we use the following command:

```bash
sudo -u postgres pgbackrest --stanza=postgres --type=full backup
```

pgBackRest supports three types of backups:

- **full** -- copies the whole cluster (all databases at once);
- **diff** (differential) -- copies everything changed since the last _full_ backup;
- **incr** (incremental) -- copies everything changed since the last backup _of any type_.

Without `--type`, pgBackRest takes an incremental backup (or a full one, if there's nothing to increment from).

Physical backups are the foundation of data retention, but the actual magic is the continuous WAL archive between them. And they don't have to be frequent. Daily full backups are no joke load-wise and can take a significant amount of time. A safe start is to make full backups weekly, and on the other days back up only the changes. I'd go with differential backups here: each one needs only the last full backup to restore from, while incremental backups form a chain where every link has to be intact:

```bash
cat <<'EOF' | sudo tee /etc/cron.d/pgbackrest
# full backup every Sunday at 01:30
30 1 * * 0    postgres  pgbackrest --stanza=postgres --type=full backup
# differential backup on all other days
30 1 * * 1-6  postgres  pgbackrest --stanza=postgres --type=diff backup
EOF
```

Old backups are cleaned up automatically after each backup, this is what `repo1-retention-full` is for. With four full backups kept and a weekly full, you can roll back at least three weeks, and up to four depending on the day. The same goes for WAL segments that are no longer needed.

### Testing the setup

Backups you've never restored from are a fun little surprise that you might not want to open. When setting up a database backup system, we have to be sure that the backups are actual consistent copies of the data and not an incident report in a trench coat.

```sql
CREATE TABLE important (id int, note text);
INSERT INTO important VALUES (1, 'pls do not delete me'), (2, 'and me pls');

SELECT now(); -- save the output!

DELETE FROM important;  -- oops, forgot the WHERE. been there done that, amirite?

SELECT pg_switch_wal();
```

The last line forces Postgres to close the current WAL segment and archive it right away instead of waiting for `archive_timeout`. Alternatively, you can wait a minute if you set it up that way earlier. This is important, because to stop at the target time, Postgres has to see WAL from _after_ that moment. If the WAL containing the `DELETE` hasn't reached the repository yet, recovery runs out of WAL before reaching the target and refuses to finish.

Now the restore itself. To keep the data consistent, Postgres must be stopped first:

```bash
sudo systemctl stop postgresql

sudo -u postgres pgbackrest --stanza=postgres \
    --delta \
    --type=time "--target=<timestamp from SELECT now() earlier>" \
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

Sounds complicated? It is! Let's check if the oh-so-important data is back:

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

Before setting up point-in-time recovery all by myself, I thought it was some kind of advanced tech, and I didn't expect it to be that easy to set up. Magic or not, this feature is so cool I honestly wonder how I'd never encountered it in the wild (and I'm not talking about AWS RDS instances, but self-hosted setups). Granted, the correct setup, configuration AND regular backup validation (restore validation, not simply `verify`!) carry so much mental load that without a DBA or a senior-level engineer it's nigh impossible to pull off. But now you know, and you can!

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20RDS-Style%20Point-in-Time%20Recovery%20for%20Self-Hosted%20PostgreSQL">Reply to this post ✉️</a></p>

[^1]: In business terms time between the incident and the full restoration is called **RTO**, recovery time objective. I'd call it unfuckup window.
[^2]: Older versions used `/etc/pgbackrest.conf`, and some packages still create it. pgBackRest checks `/etc/pgbackrest/pgbackrest.conf` first and falls back to the old location, so keep only one of them to avoid confusion.
