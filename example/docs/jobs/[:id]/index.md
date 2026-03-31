# Job Status

```
GET /jobs/:id
```

Retrieve the current status of a job.

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | The job ID returned by `POST /jobs` |

**Response** `200 OK`

While processing:

```json
{ "status": "processing" }
```

When complete:

```json
{
  "status": "done",
  "result": {
    "url": "https://example.com/article",
    "html": "<article>...</article>"
  }
}
```

**Response** `404 Not Found` — job ID does not exist.
