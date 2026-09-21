use super::{LanKdsError, KDS_MULTICAST_GROUP, KDS_MULTICAST_PORT};
use core_domain::ids::KitchenTicketId;
use core_domain::models::kitchen::KitchenTicket;
use std::collections::VecDeque;
use std::net::{Ipv4Addr, SocketAddrV4};
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::mpsc;

/// Deduplication cache for received tickets.
/// We keep the last N received ticket IDs to prevent processing duplicates.
struct DedupeCache {
    seen_ids: VecDeque<KitchenTicketId>,
    max_size: usize,
}

impl DedupeCache {
    fn new(max_size: usize) -> Self {
        Self {
            seen_ids: VecDeque::with_capacity(max_size),
            max_size,
        }
    }

    /// Checks if a ticket ID has been seen. If not, adds it to the cache.
    /// Returns true if it was already in the cache (is a duplicate).
    fn check_and_add(&mut self, id: KitchenTicketId) -> bool {
        if self.seen_ids.contains(&id) {
            return true;
        }

        if self.seen_ids.len() >= self.max_size {
            self.seen_ids.pop_front();
        }
        self.seen_ids.push_back(id);
        false
    }
}

pub struct KdsReceiver {
    socket: Arc<UdpSocket>,
}

impl KdsReceiver {
    /// Creates a new `KdsReceiver` listening on the multicast group.
    ///
    /// # Errors
    /// Returns a `LanKdsError` if the UDP socket cannot be bound or configured.
    pub fn new() -> Result<Self, LanKdsError> {
        let bind_addr = SocketAddrV4::new(Ipv4Addr::UNSPECIFIED, KDS_MULTICAST_PORT);

        let std_socket = std::net::UdpSocket::bind(bind_addr)?;
        std_socket.set_nonblocking(true)?;

        // Ensure we can receive loops for local testing
        std_socket.set_multicast_loop_v4(true)?;

        // Join the multicast group
        std_socket.join_multicast_v4(&KDS_MULTICAST_GROUP, &Ipv4Addr::UNSPECIFIED)?;

        let socket = UdpSocket::from_std(std_socket)?;

        Ok(Self {
            socket: Arc::new(socket),
        })
    }

    /// Starts a background task to receive and deserialize tickets.
    /// Returns a receiver channel for parsed, deduplicated tickets.
    #[must_use]
    pub fn start(&self) -> mpsc::Receiver<KitchenTicket> {
        let (tx, rx) = mpsc::channel(100);
        let socket = std::sync::Arc::<tokio::net::UdpSocket>::clone(&self.socket);

        tokio::spawn(async move {
            // Keep track of the last 100 ticket IDs
            let mut cache = DedupeCache::new(100);
            let mut buf = vec![0u8; 65536];

            loop {
                match socket.recv_from(&mut buf).await {
                    Ok((len, _addr)) => {
                        let payload = &buf[..len];
                        if let Ok(ticket) = serde_json::from_slice::<KitchenTicket>(payload) {
                            if !cache.check_and_add(ticket.id) {
                                // Not a duplicate, send it to the channel
                                // If the channel is closed, just ignore it and continue
                                let _ = tx.send(ticket).await;
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("KDS Receiver error reading socket: {e}");
                    }
                }
            }
        });

        rx
    }
}
