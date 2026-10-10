// WS handshake proof: connects to /ws/sync with a full handshake and
// expects the upgrade to be accepted, then closes cleanly.
// Hurl cannot hold a WebSocket open, so this runs beside the hurl suite
// under `mise run test:api`. Needs the edge simulator on :8787.
const base = process.env.BASE_URL ?? "http://localhost:8787";
const tenant = process.env.TENANT_ID ?? "00000000-0000-0000-0000-000000000001";
const location = process.env.LOCATION_ID ?? "00000000-0000-0000-0000-000000000002";
const staff = process.env.STAFF_ID ?? "00000000-0000-0000-0000-000000000003";

const url =
  base.replace(/^http/, "ws") +
  `/ws/sync?tenant_id=${tenant}&location_id=${location}&client_node_id=hurl-probe&staff_id=${staff}`;

const timeout = setTimeout(() => {
  console.error("WS handshake timed out waiting for open");
  process.exit(1);
}, 8000);

try {
  const ws = new WebSocket(url);
  ws.onopen = () => {
    clearTimeout(timeout);
    console.log("WS handshake accepted (101)");
    ws.close();
  };
  ws.onclose = (event) => {
    console.log(`WS closed cleanly (code=${event.code})`);
    process.exit(0);
  };
  ws.onerror = () => {
    clearTimeout(timeout);
    console.error("WS handshake rejected");
    process.exit(1);
  };
} catch (err) {
  clearTimeout(timeout);
  console.error(`WS handshake failed: ${err}`);
  process.exit(1);
}
