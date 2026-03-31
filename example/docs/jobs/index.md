# Jobs

Manage background processing jobs.

## List jobs

```
GET /jobs
```

Returns all jobs for the current account.

**Response** `200 OK`

```json
[
  { "job_id": "j_abc123", "status": "done" },
  { "job_id": "j_def456", "status": "processing" }
]
```

---

## Create a job

```
POST /jobs
```

Submit a URL for processing. Returns immediately with a job ID.

**Request body**

```json
{ "url": "https://example.com/article" }
```

**Response** `202 Accepted`

```json
{ "status": "enqueued", "job_id": "j_abc123" }
```
