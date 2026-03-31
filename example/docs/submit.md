# Submit URL

Submit a URL for processing. The job is queued and processed asynchronously.

## Endpoint

```
POST /
```

## Request Body

```json
{
  "url": "https://example.com/page"
}
```

| Field | Type   | Required | Description        |
|-------|--------|----------|--------------------|
| url   | string | yes      | The URL to process |

## Response — 202 Accepted

```json
{
  "status": "enqueued",
  "job_id": "abc-123-xyz"
}
```

| Field  | Type   | Description                         |
|--------|--------|-------------------------------------|
| status | string | Always `enqueued` on success        |
| job_id | string | Use this to check processing status |

## Example

```bash
curl -X POST http://localhost:8080/ \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```
