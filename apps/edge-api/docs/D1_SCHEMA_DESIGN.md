# D1 Schema Design Document

## 1. Hybrid Write Model

To support high-performance POS/KDS operations, the system employs a Hybrid Write Model. High-frequency mutations (e.g., ticket state changes, order updates) are absorbed in-memory by stateful Durable Objects (`LocationSyncRoom`).
These objects batch mutations and periodically sync them to the D1 relational database, which serves as the persistent, multi-tenant transactional source of truth. This approach dramatically reduces write latency and load on the relational store while preserving transactional integrity for long-lived records.

## 2. Hot/Cold Retention Lifecycle

The data model supports a tiered retention lifecycle for optimal cost and performance:
- **Hot Tier (D1)**: Active orders and permanent daily Z-Report/shift rollups remain in D1 for fast querying.
- **Cold Tier (R2)**: After 90 days, historical orders and detailed audit logs are archived to Cloudflare R2.
The D1 schema incorporates timestamps (e.g., `created_at`, `timestamp`) and indexes to efficiently identify and archive cold data without impacting the performance of active operations.

## 3. TenantDbSession Type-Safe Query Gateway

Security and multi-tenant isolation are strictly enforced through the `TenantDbSession` struct. This type-safe gateway wraps the raw `worker::d1::Database` and requires an authenticated `TenantContext` to instantiate.
All queries executed through this gateway must explicitly or implicitly inject parameterized `tenant_id` and `location_id` filters, preventing cross-tenant data leaks and ensuring zero cross-tenant contamination at the query level.

## 4. Edge Cache API + DO WebSocket Invalidation

To handle high-volume read workloads (such as menu reads and 86 availability checks), the system utilizes the Edge Cache API combined with DO WebSocket Invalidation.
When menu availability changes (e.g., an item is marked as 86'd), the Durable Object pushes WebSocket invalidation events to active clients and invalidates Edge Cache entries, ensuring clients immediately receive updated availability without constantly polling the D1 database.
