---
title: "AWS open-sourced Secrets Manager Agent: what does that mean?"
date: 2024-07-13
tags:
- aws
- secrets
layout: layouts/post.njk
permalink: /aws-sma-opensource/
featured: true
---
A few days ago, AWS open-sourced[^1] its Secrets Manager Agent, which is designed to help us users fetch secrets more easily and securely. Let's take a look at what it is, compare it with existing solutions, discuss its potential applications and limitations and how it may help us (or not) in our day-to-day operations.

<!-- more -->

![image](/assets/aws-sma-opensource.webp)

## What is the Secrets Manager Agent and what does it do?

As described by AWS:

::: quote AWS Secrets Manager Agent

    The AWS Secrets Manager Agent is a client-side HTTP service that you can use to standardize consumption of secrets from Secrets Manager across environments such as AWS Lambda, Amazon Elastic Container Service, Amazon Elastic Kubernetes Service, and Amazon Elastic Compute Cloud.

:::

So, basically, we now have a local daemon that will run in any compute environment and provide us local access to secrets stored in AWS Secrets Manager. It's written in Rust, which means that this daemon should be very lightweight (compiled binary size is 15MB) and very fast. After the first fetch of a secret by any application, it will be stored locally in memory for a certain amount of time (default TTL is 300 seconds, but can be increased up to 3600 s).

As this Agent is only a client service, it will allow only fetching secrets, but not putting or editing them. Based on your preference, you can store in cache up to 1000 secrets at a time.

The immediate selling point is the ability to cache secrets, which can be very beneficial performance-wise and cost-wise in applications with heavy API read calls: call API once, fetch from cache all other times.

## Enough theory, let's discuss real world application

As with everyone, my first thought after I heard "X went open-source" was "Hell yes, let's go!" But is it actually that good? Let's dive deeper.

### Replacing existing solutions

From the very beginning, I started to think: "Where can I use it? What clunky solution can it replace?"

The first and quite obvious solution is replacing secrets from environment variables used in containers with this very sidecar container (as explicitly described in AWS's own documentation[^2]). This way we will get rid of storing secrets locally and switch to a more secure way of operations: the container with the Agent will have to have its own credentials configured through IAM, which allows fine-grained access control.

My second thought was about fetching secrets during CI/CD pipelines. I already had a somewhat decent solution using AWS IdP and assume-role-with-web-identity[^3] in GitLab CI, but I always felt weird about it. And Agent may prove itself useful. Let's assume you have a fleet of self-hosted runners run as containers. Same as above, Agent can be configured as a sidecar container, and during the pipeline, secrets can be called from the pipeline itself (with certain adjustments to runner's shared resources configuration). Yes, I know, it's a huge stretch and kind of overengineering things, but hey, I'm trying my best here.

Speaking about existing solutions, the most obvious alternative that comes to mind is HashiCorp Vault. But in contrast to SMA, HCV is a combined client/server solution, and there are no specified clients (apart from the `vault` application itself) to retrieve secrets from storage. curl doesn't count.

### Size comparisons

Let's be honest, `awscli` and `boto3` weigh a ton. A container image with plain `python:latest` weighs 1GB (Docker Hub says its compressed size is 365MB). And this is base Python, without all the libraries one can get.

In comparison, the compiled SMA binary weighs 15MB.

I may be in the minority here, but I hate modern bloatware and bloated applications, so in my opinion, the smaller the size, the better.

### How to get secrets from inside the application

Now let's talk implementation.

Given that SMA is a local HTTP service, there are at least two ways we can get the data we want: using `curl` and `requests` from Python 3 (or `urllib`, if you'd like). Let's compare the implementation of secret retrieval using different methods.

#### AWS Secrets Manager Agent

##### Bash with curl

```bash
curl -v -H \
    "X-Aws-Parameters-Secrets-Token: $(</var/run/awssmatoken)" \
    'http://localhost:2773/secretsmanager/get?secretId=<YOUR_SECRET_ID>}'; \
    echo
```

##### Python with requests

```python
import requests
import json

# Function that fetches the secret from Secrets Manager Agent for the provided secret id. 
def get_secret():
    # Construct the URL for the GET request
    url = f"http://localhost:2773/secretsmanager/get?secretId=<YOUR_SECRET_ID>}"

    # Get the SSRF token from the token file
    with open('/var/run/awssmatoken') as fp:
        token = fp.read() 

    headers = {
        "X-Aws-Parameters-Secrets-Token": token.strip()
    }

    try:
        # Send the GET request with headers
        response = requests.get(url, headers=headers)

        # Check if the request was successful
        if response.status_code == 200:
            # Return the secret value
            return response.text
        else:
            # Handle error cases
            raise Exception(f"Status code {response.status_code} - {response.text}")

    except Exception as e:
        # Handle network errors
        raise Exception(f"Error: {e}")
```

#### Pure awscli, curl and python

Now let's compare the aforementioned solutions with the ways we used before.

##### Bash with awscli

```bash
aws secretsmanager get-secret-value --secret-id "kryptonite"
```

##### Bash with curl

```bash
curl -sX POST "https://secretsmanager.eu-west-1.amazonaws.com" \
--user "${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}" \
--aws-sigv4 "aws:amz:eu-west-1:secretsmanager" \
--header "x-amz-security-token: ${AWS_SESSION_TOKEN}" \
--header "X-Amz-Target: secretsmanager.GetSecretValue" \
--header "Content-Type: application/x-amz-json-1.1" \
--data '{
    "SecretId": "arn:aws:secretsmanager:eu-west-1:1234567890:secret:kryptonite/kryptonite-XCVQWE"
}'
```

Holy shit, curl is huge. Luckily we have awscli.

##### Python with boto3

```python
import boto3
from botocore.exceptions import ClientError

def get_kryptonite_secret():
    secret_name = "kryptonite"
    region_name = "eu-west-1"

    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        raise Exception(f"An error occurred: {e.response['Error']['Message']}")

    if 'SecretString' in get_secret_value_response:
        secret = get_secret_value_response['SecretString']
        return secret
    else:
        decoded_binary_secret = base64.b64decode(get_secret_value_response['SecretBinary'])
        return decoded_binary_secret

try:
    kryptonite_secret = get_kryptonite_secret()
    print("The secret value is:", kryptonite_secret)
except Exception as e:
    print("Error:", str(e))
```

##### Python with requests

```python
import requests
import json
import base64
from requests_aws4auth import AWS4Auth
import os

def get_kryptonite_secret():
    secret_name = "kryptonite"
    region_name = "eu-west-1"
    service = 'secretsmanager'
    
    access_key = os.environ.get('AWS_ACCESS_KEY_ID')
    secret_key = os.environ.get('AWS_SECRET_ACCESS_KEY')
    
    if not (access_key and secret_key):
        raise Exception("AWS credentials not found in environment variables")

    auth = AWS4Auth(access_key, secret_key, region_name, service, session_token=session_token)

    endpoint = f"https://secretsmanager.{region_name}.amazonaws.com"
    
    headers = {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'secretsmanager.GetSecretValue'
    }
    payload = json.dumps({"SecretId": secret_name})

    try:
        response = requests.post(endpoint, headers=headers, data=payload, auth=auth)
        response.raise_for_status()

        secret_data = response.json()

        if 'SecretString' in secret_data:
            return secret_data['SecretString']
        else:
            return base64.b64decode(secret_data['SecretBinary'])

    except requests.exceptions.RequestException as e:
        raise Exception(f"An error occurred while fetching the secret: {str(e)}")

try:
    kryptonite_secret = get_kryptonite_secret()
    print("The secret value is:", kryptonite_secret)
except Exception as e:
    print("Error:", str(e))
```

All in all, querying a local HTTP service looks a bit simpler, both in size and in complexity of the code required.

## Conclusion

Overall, Secrets Manager Agent seems a very good replacement for `awscli` in one specific scenario: fetching secrets (duh!). Cases when this is the only functionality required from awscli are not uncommon, and in my opinion, being able to reduce the amount of additional codebase required to get necessary sensitive data is a good change.

However, I can't say SMA is an extraordinary tool. Its functionality is narrow, its usage fields are small, and I had to spend a noticeable amount of time just to think of ways to use it instead of existing solutions.

It may prove nice and handy in situations when a new project is started and there's a need to operate sensitive data securely and reliably. In this scenario, introducing SMA at a very early stage of development may be beneficial. In existing projects, however, I'm sure there's already one way or another to work with secrets, as the problem itself is rather old.

I'm not sure if I will introduce SMA in my current projects, as its introduction will require much more time than it may save afterwards. Yet another service to manage, yet another codebase to keep updated. But that doesn't mean I think it's bad, not at all. It's just not fit for my goals, and it very likely may fit for yours -- I suggest you to give it a try.

::: info Closing remarks

    As always, feel free to [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my mistakes and befriend me on one of the social media platforms listed below.

:::

[^1]: [AWS Secrets Manager Agent](https://github.com/aws/aws-secretsmanager-agent)
[^2]: [Step 2: Install the Secrets Manager Agent](https://docs.aws.amazon.com/secretsmanager/latest/userguide/secrets-manager-agent.html#secrets-manager-agent-install)
[^3]: [Using AWS Parameter Store instead of Gitlab CICD Variables](https://notes.hatedabamboo.me/cicd-variables-from-aws/)
