# HTTP APIs

## GET /api/keys/:id/sticky-users

- Purpose: 返回当前仍绑定到该 key 的用户分页，以及 charged credits 视图所需的聚合窗口与 7 日趋势。
- Query:
  - `page`: `integer >= 1`, default `1`
  - `per_page`: `integer 1..100`, default `20`
- Response:

```json
{
  "items": [
    {
      "user": {
        "userId": "usr_123",
        "displayName": "Ivan",
        "username": "ivanli",
        "active": true,
        "lastLoginAt": 1773200000,
        "tokenCount": 2
      },
      "lastSuccessAt": 1773280557,
      "windows": {
        "yesterday": { "successCredits": 12, "failureCredits": 1 },
        "today": { "successCredits": 8, "failureCredits": 2 },
        "month": { "successCredits": 42, "failureCredits": 5 }
      },
      "dailyBuckets": [
        {
          "bucketStart": 1772668800,
          "bucketEnd": 1772755200,
          "successCredits": 3,
          "failureCredits": 1
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "perPage": 20
}
```

## GET /api/keys/:id/sticky-nodes

- Purpose: 返回该 key 当前主备 sticky 节点，并复用 forward proxy live stats 图表字段。
- Response:

```json
{
  "rangeStart": "2026-03-15T00:00:00Z",
  "rangeEnd": "2026-03-16T00:00:00Z",
  "bucketSeconds": 3600,
  "nodes": [
    {
      "role": "primary",
      "key": "proxy_a",
      "source": "manual",
      "displayName": "Tokyo A",
      "endpointUrl": "socks5://example",
      "weight": 1,
      "available": true,
      "lastError": null,
      "penalized": false,
      "primaryAssignmentCount": 9,
      "secondaryAssignmentCount": 3,
      "stats": {
        "oneMinute": { "attempts": 0, "successRate": null, "avgLatencyMs": null },
        "fifteenMinutes": { "attempts": 3, "successRate": 1, "avgLatencyMs": 328.5 },
        "oneHour": { "attempts": 12, "successRate": 0.91, "avgLatencyMs": 341.2 },
        "oneDay": { "attempts": 96, "successRate": 0.95, "avgLatencyMs": 355.1 },
        "sevenDays": { "attempts": 544, "successRate": 0.97, "avgLatencyMs": 349.8 }
      },
      "last24h": [],
      "weight24h": []
    }
  ]
}
```

## Contract rules

- `sticky-users.items` 仅包含“当前仍绑定到该 key”的用户；已被 recent-3 裁剪掉的旧绑定不得回放。
- `windows.today` / `windows.yesterday` / `windows.month` 的口径均为 charged credits，而不是 request count。
- `dailyBuckets` 固定返回最近 7 个 server-local day 日桶；无数据的桶也要补零，便于前端稳定画图。
- `sticky-nodes.nodes` 最多返回 2 个元素，并通过 `role` 区分 `primary` / `secondary`。
- `sticky-nodes` 的节点字段必须与 `/api/stats/forward-proxy` live stats node 保持同名同义，避免前端重复定义图表转换。
