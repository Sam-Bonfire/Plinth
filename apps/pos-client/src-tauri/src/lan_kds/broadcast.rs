use super::{LanKdsError, KDS_MULTICAST_GROUP, KDS_MULTICAST_PORT};
use core_domain::models::kitchen::KitchenTicket;
use std::net::{Ipv4Addr, SocketAddr, SocketAddrV4};
use std::sync::Arc;
use tokio::net::UdpSocket;

#[derive(Clone)]
pub struct KdsBroadcaster {
    socket: Arc<UdpSocket>,
    target: SocketAddr,
}

impl KdsBroadcaster {
    /// Creates a new `KdsBroadcaster` bound to an ephemeral port.
    ///
    /// # Errors
    /// Returns a `LanKdsError` if the UDP socket cannot be bound or configured.
    pub async fn new() -> Result<Self, LanKdsError> {
        let bind_addr = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, 0);
        let socket = UdpSocket::bind(bind_addr).await?;

        // Enable loopback for local testing and multi-receiver same-host scenarios.
        let std_socket = socket.into_std()?;
        std_socket.set_multicast_loop_v4(true)?;

        let socket = UdpSocket::from_std(std_socket)?;

        let target = SocketAddr::V4(SocketAddrV4::new(KDS_MULTICAST_GROUP, KDS_MULTICAST_PORT));

        Ok(Self {
            socket: Arc::new(socket),
            target,
        })
    }

    /// Broadcasts a kitchen ticket to the multicast group.
    ///
    /// # Errors
    /// Returns a `LanKdsError` if serialization fails or sending over the socket fails.
    pub async fn broadcast_ticket(&self, ticket: &KitchenTicket) -> Result<(), LanKdsError> {
        let payload = serde_json::to_vec(ticket)?;
        self.socket.send_to(&payload, self.target).await?;
        Ok(())
    }
}
