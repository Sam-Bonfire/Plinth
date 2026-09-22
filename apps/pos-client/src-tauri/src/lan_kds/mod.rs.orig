use thiserror::Error;
use std::net::Ipv4Addr;

pub mod broadcast;
pub mod receiver;

pub use broadcast::KdsBroadcaster;
pub use receiver::KdsReceiver;

/// Multicast group IP address (site-local scoped)
pub const KDS_MULTICAST_GROUP: Ipv4Addr = Ipv4Addr::new(239, 255, 0, 1);

/// Multicast port for KDS communication
pub const KDS_MULTICAST_PORT: u16 = 31415;

#[derive(Debug, Error)]
pub enum LanKdsError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;
    use core_domain::enums::kitchen::StationId;
    use core_domain::ids::{LocationId, OrderId, TenantId};
    use core_domain::models::kitchen::KitchenTicket;
    use core_domain::value_objects::preparation::PreparationSla;
    use std::time::Duration;
    use tokio::time::timeout;

    #[tokio::test]
    async fn test_broadcast_and_receive_dedupe() {
        // Setup receiver
        let receiver = KdsReceiver::new().expect("Failed to create receiver");
        let mut rx = receiver.start();

        // Setup broadcaster
        let broadcaster = KdsBroadcaster::new().await.expect("Failed to create broadcaster");

        // Give receiver a tiny bit of time to start up and join multicast
        tokio::time::sleep(Duration::from_millis(100)).await;

        let sla = PreparationSla::default_restaurant();
        let (ticket, _) = KitchenTicket::new(
            OrderId::new(),
            TenantId::new(),
            LocationId::new(),
            StationId::Grill,
            123,
            Vec::new(),
            sla,
        );

        // Broadcast the same ticket twice
        broadcaster
            .broadcast_ticket(&ticket)
            .await
            .expect("Failed to broadcast 1");

        // Slight delay to ensure order of UDP packets
        tokio::time::sleep(Duration::from_millis(50)).await;

        broadcaster
            .broadcast_ticket(&ticket)
            .await
            .expect("Failed to broadcast 2");

        // We expect exactly ONE ticket to be received because of deduplication
        let received_ticket = timeout(Duration::from_secs(1), rx.recv())
            .await
            .expect("Timeout waiting for first ticket")
            .expect("Channel closed");

        assert_eq!(received_ticket.id, ticket.id);
        assert_eq!(received_ticket.kot_number, 123);

        // Attempting to receive a second ticket should timeout
        let second = timeout(Duration::from_millis(500), rx.recv()).await;
        assert!(
            second.is_err(),
            "Expected timeout, but received a duplicate ticket"
        );
    }
}
