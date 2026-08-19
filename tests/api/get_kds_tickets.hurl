GET http://localhost:8787/api/v1/kds/tickets
Header "X-Store-Id: store_loc_99"

HTTP 200
[Asserts]
jsonpath "$.data" count > 0
jsonpath "$.data[0].station_id" == "GRILL_01"
jsonpath "$.data[0].status" == "PENDING"
