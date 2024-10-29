---
draft: true # TODO remove
authors:
  - hatedabamboo
date:
  created: 2024-10-26
slug: hidden-files-in-s3-bucket
tags:
  - aws
  - s3
title: "Hidden files in an S3 bucket"
---
Recently during routine backup procedure for personal files I discovered that my private bucket with only 1 archive for some reason has approximately 500 objects in it. This surprised me greatly and I decided to investigate what was the issue and how it happened.

<!-- more -->

![image](../assets/finding-invisible-objects-in-s3-bucket.webp)

## Prologue

Backup is a good habit not only for professional projects, but for personal ones as well. Your hard drive may die of old age, your cat may spill soda on your laptop, or you dog can chew on your flash drive. Transnational megacorporation may decide one day that your promo "Lifetime unlimited photo storage" package is not actually lifetime and not that unlimited after all. Accidents happen.

As an engineer, I prefer to be safe rather than to be sorry. That's why I set up a backup of my personal data once in a while (and advise you to do the same). Specifically, I store one copy of my backup archive to a local hard drive, and another copy I upload to a rather cheap AWS S3 storage.

S3 gives a great variety of storage options depending on your needs: it can be either very cheap, but with an increased retrieval time, or it can be available to download instantly, but be slightly more expensive. Also there are different nines in question depending on chosen class[^1].

But I went off track.

Usually I upload an archive to S3 when the backup is ready and forget about it, but this time something pushed me to click all the tabs in the bucket view and I discovered a curious finding.

![Objects in a bucket](./../assets/2024-10-26-objects-in-a-bucket.png)

I am 100% sure that my bucket contains only one (1) file. Where did all these files come from?

![Bucket size](./../assets/2024-10-26-bucket-size.png)

And why does my bucket weighs more than the size of the said one object in it?

## Finding Nemo

Not so long ago there was a story[^2] about a feature™ on AWS S3, that unauthorised requests to your bucket are still yours to pay. That was a bummer to say the least. Remembering that story, my first thought was that someone figured out the name of the bucket I use and used it for malitious reasons. (I don't know how it's possible to upload invisible files to someone's bucket -- but still.) Next idea was that, somehow, I managed to leave the bucket with open permissions. I checked everything -- and it wasn't the case, only publicly available bucket with my static website is open for read access, and that's it.

So why are there invisible files in my S3 bucket? And how do I find them?

I decided to use `awscli` to look for the objects. `awscli` has `s3 ls` command, which didn't show any objects except for the one that was actually there. This started to annoy me. I prepared a final solution for this situation: recreate the bucket, reupload the archive and forget about it. But lack of understanding the root cause behind this situation annoyed me even more. So I decided to push a little further.

What other options I had? I frequently use `boto3` library, so I decided to give it a go.

The library has several "list" actions as well, and I started to work with the most plausible. Unfortunately, simple `list_buckets`, `list_directory_buckets`, 
`list_object_versions`, `list_objects`, `list_objects_v2` showed me nothing. However, there were several not so straightforward actions: `list_multipart_uploads`  and `list_parts`.

```python
$ python3
Python 3.10.12 (main, Jun 11 2023, 05:26:28) [GCC 11.4.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import boto3
>>> response = s3.list_multipart_uploads(Bucket="my-cool-bucket")
>>> print(response)
{'ResponseMetadata': {'RequestId': '[REDACTED]', 'HostId': '[REDACTED]', 'HTTPStatusCode': 200, 'HTTPHeaders': {'x-amz-id-2': '[REDACTED]', 'x-amz-request-id': '[REDACTED]', 'date': 'Fri, 25 Oct 2024 10:10:42 GMT', 'content-type': 'application/xml', 'transfer-encoding': 'chunked', 'server': 'AmazonS3'}, 'RetryAttempts': 0}, 'Bucket': 'my-cool-bucket', 'KeyMarker': '', 'UploadIdMarker': '', 'NextKeyMarker': 'archive_2023.tar.gz', 'NextUploadIdMarker': '[REDACTED]', 'MaxUploads': 1000, 'IsTruncated': False, 'Uploads': [{'UploadId': '[REDACTED]', 'Key': 'archive_2023.tar.gz', 'Initiated': datetime.datetime(2023, 12, 21, 12, 1, 22, tzinfo=tzutc()), 'StorageClass': 'STANDARD', 'Owner': {'DisplayName': 'hatedabamboo', 'ID': '[REDACTED]'}, 'Initiator': {'ID': '[REDACTED]', 'DisplayName': 'hatedabamboo'}}]}
```

Well well well, what do we have here! A weird multipart upload that was created almost a year ago. Well, weird is not the correct word, it's definitely was I who started it, but I have no memory about it whatsoever. And it seems that it was never finished.

From this response we can try to find even more information.

```python
>>> response = s3.list_parts(Bucket="my-cool-bucket", Key="archive_2023.tar.gz", UploadId="[REDACTED]")
>>> print(response["Parts"])
[{'PartNumber': 1, 'LastModified': datetime.datetime(2023, 12, 21, 12, 1, 26, tzinfo=tzutc()), 'ETag': '"[REDACTED]"', 'Size': 17179870}, {'PartNumber': 2, 'LastModified': datetime.datetime(2023, 12, 21, 12, 1, 32, tzinfo=tzutc()), 'ETag': '"[REDACTED]"', 'Size': 17179870}, {'PartNumber': 3, 'LastModified': datetime.datetime(2023, 12, 21, 12, 1, 38, tzinfo=tzutc()), 'ETag': '"[REDACTED]"', 'Size': 17179870}, {'PartNumber': 4, ... (and many, many more)
>>> print(len(response["Parts"]))
457
```

And there they are, all these unkown hidden invisible objects in my bucket with a single file. It took a while to notice the issue, and to see the updated metric values. Deleting the parts themselves was piece of cake.

![After cleaning the parts](./../assets/2024-10-26-post-cleanup.png)

## Afterthought

So what happened after all?

It seems that once, using a file upload via the AWS Web console, I opted for multipart upload, which seemd to be a faster solution. Was it faster -- I don't remember. But it seems that somewhere during the process upload failed, and I had to restart from the start. But existing multipart upload kept lying there -- unnoticed, untouched, with all it's parts waiting to be removed.

This is a very counterintuitive thing for anybody who uses web console, as there's no way to find failed multipart uploads and to see their progress / parts, if you're not the one who started it or if you left the initial window. Or even if your internet connection was interrupted and the upload failed.

Multipart upload is a nice feature, but it lacks visibility for the users, and it's a huge downside. Because, in the end, it's your money on the table. I can easily imagine situations where people do not closely monitor the amount of files in their buckets and the size of it, and somewhere out there are lying dead multipart uploads and their parts and eating cent by cent your monthly budget.

!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.

[^1]: [Amazon S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/)
[^2]: [How an empty S3 bucket can make your AWS bill explode](https://medium.com/@maciej.pocwierz/how-an-empty-s3-bucket-can-make-your-aws-bill-explode-934a383cb8b1)
