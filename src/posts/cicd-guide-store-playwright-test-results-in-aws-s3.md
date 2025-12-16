---
title: "CI/CD guide: store Playwright test results in AWS S3"
date: 2025-05-05
tags:
  - aws
  - cicd
  - s3
  - testing
layout: layouts/post.njk
permalink: /playwright-test-report-in-s3/
featured: true
---
Integrating Playwright end-to-end test reporting into a CI/CD pipeline by automatically uploading the generated reports to an AWS S3 bucket, enabling easy access and centralized storage.

<!-- more -->

![image](/assets/cicd-guide-store-playwright-test-results-in-aws-s3.webp)

Modern software development is deeply intertwined with software testing. Unit tests, integration tests, end-to-end tests -- without them, we would spend much more time fixing trivial bugs instead of actually developing software. One of the most complex test scenarios is end-to-end testing: it verifies real business functionality and replaces manual clicking with automated test suites.

In my job, I've encountered a tool called [Playwright](https://playwright.dev/) for this purpose and was greatly impressed by its capabilities. You can program it to do all the things you do manually -- and run them automatically without needing to open a browser. It's no wonder someone took the time to transform such bloatware as a modern browser into something more automation-friendly. Amazing!

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
      if: {% raw %}${{ !cancelled() }}{% endraw %}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

I just want to emphasize a few key points here.

We must use Ubuntu as the base image because Playwright dependencies rely exclusively on Debian [package distributions](https://github.com/microsoft/playwright/blob/cb74d37063dd9add760b49db001bbfa950d77e5b/packages/playwright-core/src/server/registry/dependencies.ts#L110). This should not be an issue when running tests in the pipeline, but for local setups on RHEL-based distributions, it might introduce some fun challenges.

Also, running tests on every pull request and push to main branches can be time-consuming, so it makes perfect sense to cache the bloated browser downloads (which are around 500 MB) and store them for a while. In the following example, we cache them for a day:

```yaml
    - name: Get date
      id: date
      run: echo "date=$(date +%Y-%m-%d)" >> $GITHUB_OUTPUT
    - name: Cache Playwright browsers
      id: cache-playwright-browsers
      uses: actions/cache@v4
      with:
        path: ~/.cache/ms-playwright
        key: {% raw %}playwright-browsers-${{ steps.date.outputs.date }}{% endraw %}
```

## S3 bucket setup

The first part of the configuration is done -- now let's do something about those reports, right?

Obviously, we need a bucket. So let's create one. For the sake of simplicity, I'll provide only the Terraform code here.

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

As you can see, the configuration is pretty basic. We enable a lifecycle policy to delete files after 30 days, since there's rarely a need to keep old test reports. We also attach a fairly permissive bucket policy, allowing us to view report files directly in the browser without needing to log into the AWS Web Console.

## Finalizing the report publication

After the preparation, we are now ready to run the tests and view the reports directly in our browser.

To upload files from the GitHub Actions pipeline, we need to acquire AWS credentials. Here is [the manual](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) on how to configure OIDC in AWS for GitHub, which is supported by `aws-actions/configure-aws-credentials@v4`. To retrieve the necessary credentials properly, we provide additional permissions: `id-token: write` and `contents: read`.

Then we configure the test setup as usual, and at the end, we archive the resulting report in two places: GitHub Artifacts and S3. Since we previously created fairly open access to the files in our bucket, we add a layer of obscurity by including a random UUID string in the file path. This way, any malicious actor -- should they be determined to view our failing tests -- would have to deduce at least three variables: the random UUID (complex), the PR number (trivial), and the GitHub run ID (somewhat complex).

Let's take a look at how the final GitHub Actions workflow looks.

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
          role-to-assume: {% raw %}${{ env.AWS_ASSUMED_ROLE }}{% endraw %}
          role-session-name: 'github-actions'
          aws-region: {% raw %}${{ env.AWS_REGION }}{% endraw %}
      - id: date
        run: echo "date=$(date +%Y-%m-%d)" >> $GITHUB_OUTPUT
      - name: Install dependencies
        run: npm ci
      - name: Cache Playwright browsers
        id: cache-playwright-browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: {% raw %}playwright-browsers-${{ steps.date.outputs.date }}{% endraw %}
      - name: Install Playwright browsers
        if: {% raw %}steps.cache-playwright-browsers.outputs.cache-hit != 'true'{% endraw %}
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
          aws s3 cp --recursive ./playwright-report/ s3://{% raw %}${{ env.BUCKET_NAME }}{% endraw %}/${RANDOM_ID}/PR{% raw %}${{ github.event.pull_request.number }}{% endraw %}/{% raw %}${{ github.run_id }}{% endraw %}/
          echo "Uploaded test report to S3: https://{% raw %}${{ env.BUCKET_NAME }}{% endraw %}.s3.{% raw %}${{ env.AWS_REGION }}{% endraw %}.amazonaws.com/${RANDOM_ID}/PR{% raw %}${{ github.event.pull_request.number }}{% endraw %}/{% raw %}${{ github.run_id }}{% endraw %}/index.html"
```

Of course, this solution is far from secure. To improve the safety of publishing test reports, we can use Signed URLs and serve those instead of direct links. Alternatively, we can modify the bucket policy to allow access only from [specific IP addresses](https://repost.aws/knowledge-center/block-s3-traffic-vpc-ip), such as your VPN. The possibilities are vast!

::: info Closing remarks

    As always, feel free to [disagree](https://github.com/hatedabamboo/notes.hatedabamboo.me/issues) with me, [correct](https://github.com/hatedabamboo/notes.hatedabamboo.me/pulls) my mistakes and befriend me on one of the social media platforms listed below.

:::
