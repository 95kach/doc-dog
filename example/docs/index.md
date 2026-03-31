# Chop-Chop API

Chop-Chop is an asynchronous URL processing service. Submit a URL and receive rendered HTML.

## Quick Start

1. Submit a URL to get a `job_id`
2. Poll the job status endpoint until `status` is `done`
3. Use the `result.html` from the response

## Base URL

```
http://localhost:8080
```
