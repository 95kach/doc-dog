# Job Status

Check the processing status of a submitted job.

## Endpoint

```
GET /jobs/:job_id
```

## Path Parameters

| Parameter | Type   | Description                     |
|-----------|--------|---------------------------------|
| job_id    | string | The job ID from the submit call |

## Response — Processing

When the job is still being processed:

```json
{
  "status": "processing"
}
```

## Response — Done

When the job has completed:

```json
{
  "status": "done",
  "result": {
    "url": "https://example.com/page",
    "html": "<html>...</html>"
  }
}
```

## Example

```bash
curl http://localhost:8080/jobs/abc-123-xyz
```
