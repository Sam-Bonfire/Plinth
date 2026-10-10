# Endpoint: GET /ws/sync
# Verification: Realtime sync WebSocket handshake contract
# Prerequisite: simulator running on {{base_url}}.

# Negative: Missing tenant_id query parameter returns 400
GET {{base_url}}/ws/sync?location_id={{location_id}}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "tenant_id"

# Negative: Missing location_id query parameter returns 400
GET {{base_url}}/ws/sync?tenant_id={{tenant_id}}
HTTP 400
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.error" contains "location_id"

# Note: the 101 upgrade itself cannot be asserted here. Hurl has no
# WebSocket support (an accepted upgrade holds the socket open and the
# case hangs), and the HearthRoom fetch handler awaits its message loop
# inline so it never returns the 101 today. The live-upgrade proof lives
# in tests/api/ws-handshake.check.mjs and the handler fix belongs to
# the sync hardening ticket (P-1610).
