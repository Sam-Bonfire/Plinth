GET {{base_url}}/health
HTTP 200
[Asserts]
jsonpath "$.status" == "ok"
jsonpath "$.version" exists
jsonpath "$.uptime_secs" exists
jsonpath "$.d1_reachable" exists
