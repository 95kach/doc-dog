# Creating Jobs Guide

This guide walks you through submitting URLs for processing with the Chop-Chop API.

## Before You Start

Make sure you have:

- A valid API endpoint (`https://api.chop-chop.dev`)
- A URL you want to process

## Basic Usage

Submit a URL to create a new job:

```bash
curl -X POST https://api.chop-chop.dev/jobs \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

The API returns a job object immediately — processing happens in the background.

## Using Callbacks

If you don't want to poll for status, provide a `callback` URL. Chop-Chop will send a POST request to your callback when the job completes:

```bash
curl -X POST https://api.chop-chop.dev/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "callback": "https://your-app.com/webhooks/chop-chop"
  }'
```

## Polling for Results

Without a callback, poll the job status endpoint until `status` is `done`:

```javascript
async function waitForJob(jobId) {
  while (true) {
    const res = await fetch(`https://api.chop-chop.dev/jobs/${jobId}`)
    const job = await res.json()
    if (job.status === 'done') return job
    await new Promise(r => setTimeout(r, 2000))
  }
}
```

## Error Handling

A `400 Bad Request` means the URL was missing or invalid. Check the `error` field in the response for details.
