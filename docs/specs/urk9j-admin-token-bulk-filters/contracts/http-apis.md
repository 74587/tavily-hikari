# HTTP API 合同

## `GET /api/tokens`

### Query

| 参数          | 类型    | 说明                                  |
| ------------- | ------- | ------------------------------------- |
| `page`        | integer | 页码，最小 1                          |
| `perPage`     | integer | 每页数量，范围 1-200                  |
| `group`       | string  | 精确匹配 `auth_tokens.group_name`     |
| `no_group`    | boolean | 只返回空分组 token                    |
| `q`           | string  | 匹配 token ID、备注、绑定用户 ID/名称 |
| `owner`       | enum    | `all`、`bound`、`unbound`             |
| `quota_state` | enum    | `normal`、`hour`、`day`、`month`      |
| `enabled`     | enum    | `all`、`active`、`frozen`             |

### Response

保持既有分页结构：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "perPage": 10
}
```

筛选必须在分页前生效；`quota_state` 基于补齐后的 runtime quota state 计算。

## `PATCH /api/tokens/batch/status`

### Request

```json
{
  "ids": ["abc1", "def2"],
  "enabled": false
}
```

### Response

```json
{
  "updated": 2,
  "missing": []
}
```

- `enabled=true` 表示激活。
- `enabled=false` 表示冻结。
- 空 ID 列表返回 `400 Bad Request`。
- `missing` 包含不存在或已软删除的 token ID。

## `DELETE /api/tokens/batch`

### Request

```json
{
  "ids": ["abc1", "def2"]
}
```

### Response

```json
{
  "updated": 2,
  "missing": []
}
```

- 删除为软删除：token 被禁用并写入 `deleted_at`。
- 空 ID 列表返回 `400 Bad Request`。
- `missing` 包含不存在或已软删除的 token ID。
