---
authors:
  - hatedabamboo
date:
  created: 2025-05-05
slug: playwright-test-report-in-s3
tags:
  - aws
  - s3
  - testing
categories:
  - "⬢⬢⬡ Intermediate"
title: "CI/CD Guide: Store Playwright Test Results in AWS S3"
---
Integrating Playwright end-to-end test reporting into a CI/CD pipeline by
automatically uploading the generated reports to an AWS S3 bucket, enabling
easy access and centralized storage.

<!-- more -->

![image](../assets/cicd-guide-store-playwright-test-results-in-aws-s3.webp)

Modern software development is deeply intertwined with software testing. Unit tests, integration tests, end-to-end tests — without them, we would spend much more time fixing trivial bugs instead of actually developing software. One of the most complex test scenarios is end-to-end testing: it verifies real business functionality and replaces manual clicking with automated test suites.

In my job, I've encountered a tool called [Playwright](https://playwright.dev/) for this purpose and was greatly impressed by its capabilities. You can program it to do all the things you do manually — and run them automatically without needing to open a browser. It's no wonder someone took the time to transform such bloatware as a modern browser into something more automation-friendly. Amazing!

The complication starts when these scenarios need to be integrated into the CI/CD pipeline. It's pretty simple when you trigger tests locally and then review the saved report in your browser. But what if you want to run tests in a centralized CI/CD tool and save the report for further review? And this is where S3 comes to save the day once again!

## GitHub Actions setup

The first step in configuring automated tests in the CI/CD pipeline is quite simple and already covered in the [Playwright documentation](https://playwright.dev/docs/ci#github-actions). The workflow configuration is pretty straightforward:

```yaml
name: Playwright Tests
on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: lts/*
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps
    - name: Run Playwright tests
      run: npx playwright test
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

I just want to emphasize a few key points here.

We must use Ubuntu as the base image, because Playwright dependencies rely solely on Debian [package distributions](https://github.com/microsoft/playwright/blob/cb74d37063dd9add760b49db001bbfa950d77e5b/packages/playwright-core/src/server/registry/dependencies.ts#L110). This should not be an issue running the tests in the pipeline, but for local setups on RHEL-based distributions it might introduce fun challenges.

Also, running tests on each pull request and push to main branches may be time consuming, so it makes total sense to cache bloated browser downloads (which are ~500Mb) and store for some time. In the following example we save the cache for a day:

```yaml
      - name: Get date
        id: date
        run: echo "date=$(date +%Y-%m-%d)" >> $GITHUB_OUTPUT
      - name: Cache Playwright browsers
        id: cache-playwright-browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-browsers-${{ steps.date.outputs.date }}
```

## S3 bucket setup

The first part of the configuration is done, now let's do something about them reports, right?

Obviously, we need a bucket. So let's create one. For the sake of simplicity I will provide only Terraform code here.

```hcl
# S3 bucket for e2e test reports
resource "aws_s3_bucket" "e2e_test_reports" {
  bucket = "playwright-test-reports"
}

# Bucket ownership controls
resource "aws_s3_bucket_ownership_controls" "e2e_test_reports" {
  bucket = aws_s3_bucket.e2e_test_reports.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Lifecycle configuration for expiration after 30 days
resource "aws_s3_bucket_lifecycle_configuration" "e2e_test_reports" {
  bucket = aws_s3_bucket.e2e_test_reports.id

  rule {
    id     = "delete-30d"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

# Public access policy for the bucket
resource "aws_s3_bucket_policy" "e2e_test_reports" {
  bucket = aws_s3_bucket.e2e_test_reports.id
  policy = data.aws_iam_policy_document.e2e_test_reports_public.json
}

# Public access block settings
resource "aws_s3_bucket_public_access_block" "e2e_test_reports" {
  bucket = aws_s3_bucket.e2e_test_reports.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Policy document for public read access
data "aws_iam_policy_document" "e2e_test_reports_public" {
  statement {
    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.e2e_test_reports.arn}/*"]
  }
}
```

As you can see, the configuration is pretty basic. We enable lifecycle policy to delete files after 30 days because there is rarely a need for old test reports. Also, we attach quite permissive bucket policy, so we would be able to view report files right from the browser without the necessity to log into the AWS Web Console.

## Finalizing the report reviews

After the preparation we are now ready to run the tests and view the reports directly in our browser. 

To upload files from GitHub Actions pipeline, we need to acquire AWS credentials. Here is [the manual](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) on how to configure OIDC in AWS for GitHub. with which `aws-actions/configure-aws-credentials@v4` helps us. To properly retrieve the necessary credentials, we provide additional permissions: `id-token: write` and `contents: read`.

The we configure test setup as usual, and in the end we archive the resulting report in 2 places: in GitHub Artifacts and upload the files to S3. As in previous step we created quite an open access to the files in our bucket, we introduce a little bit of obscurity: we add a random UUID string in the file path to our report. This way the malicious actor, should they have an absolute must to view our failing tests, will have to deduce at least 3 variables: random UUID (complex), PR number (trivial) and GitHub run ID (somewhat complex).

Let's have a look how the final GitHub Actions workflow looks like.

```yaml
name: Playwright Tests

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    env:
      BUCKET_NAME: 'playwright-test-reports'
      AWS_REGION: 'eu-west-1'
      AWS_ASSUMED_ROLE: 'arn:aws:iam::123456789012:role/github-actions-role'
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ env.AWS_ASSUMED_ROLE }}
          role-session-name: 'github-actions'
          aws-region: ${{ env.AWS_REGION }}
      - id: date
        run: echo "date=$(date +%Y-%m-%d)" >> $GITHUB_OUTPUT
      - name: Install dependencies
        run: npm ci
      - name: Cache Playwright browsers
        id: cache-playwright-browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-browsers-${{ steps.date.outputs.date }}
      - name: Install Playwright browsers
        if: steps.cache-playwright-browsers.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
      - name: Upload Test Report to S3
        if: always()
        run: |
          RANDOM_ID="$(uuidgen -r)"
          aws s3 cp --recursive ./playwright-report/ s3://${{ env.BUCKET_NAME }}/${RANDOM_ID}/PR${{ github.event.pull_request.number }}/${{ github.run_id }}/
          echo "Uploaded test report to S3: https://${{ env.BUCKET_NAME }}.s3.${{ env.AWS_REGION }}.amazonaws.com/${RANDOM_ID}/PR${{ github.event.pull_request.number }}/${{ github.run_id }}/index.html"
```

Of course, this solution is far from secure. To add more safety to publishing the test reports we can utilize Signed URLs and serve them instead of direct links. Or we can modify the bucket policy to allow access only from [specific IP addresses](https://repost.aws/knowledge-center/block-s3-traffic-vpc-ip). The possibilities are vast!


!!! abstract "Closing remarks"

    As always, feel free to
    [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with
    me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my
    mistakes and befriend me on one of the social media platforms listed below.
