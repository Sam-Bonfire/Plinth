import { Input, Layout, Menu, Typography } from "antd";
import React, { useMemo, useState } from "react";

const { Sider, Content } = Layout;
const { Title, Paragraph } = Typography;
const { Search } = Input;

export interface DocTopic {
  id: string;
  title: string;
  content: string;
}

export interface DocsPortalProps {
  content?: DocTopic[];
}

export const filterTopics = (
  topics: DocTopic[],
  query: string,
): DocTopic[] => {
  const lowerQuery = query.toLowerCase();
  return topics.filter(
    (topic) =>
      topic.title.toLowerCase().includes(lowerQuery) ||
      topic.content.toLowerCase().includes(lowerQuery),
  );
};

const DEFAULT_CONTENT: DocTopic[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    content: "# Getting Started\n\nWelcome to PlinthOS. This guide will help you get up and running quickly. Learn about installation, configuration, and your first deployment.",
  },
  {
    id: "api-reference",
    title: "API Reference",
    content: "# API Reference\n\nDetailed documentation of all PlinthOS REST endpoints, including request/response formats, authentication, and rate limiting.",
  },
  {
    id: "webhooks",
    title: "Webhooks",
    content: "# Webhooks\n\nSubscribe to real-time events in PlinthOS. Set up webhook endpoints to receive JSON payloads for order creation, updates, and more.",
  },
  {
    id: "architecture-whitepaper",
    title: "Architecture Whitepaper",
    content: "# Architecture Whitepaper\n\nDive deep into the Hexagonal Architecture, Rust safety guarantees, and distributed systems design powering PlinthOS.",
  },
];

export const DocsPortal: React.FC<DocsPortalProps> = ({
  content = DEFAULT_CONTENT,
}): React.ReactElement => {
  const [searchQuery, setSearchQuery] = useState("");
  // Safely fallback just in case someone explicitly passed undefined or null
  const safeContent: DocTopic[] = content || [];

  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    safeContent.length > 0 && safeContent[0] ? safeContent[0].id : "",
  );

  const filteredTopics = useMemo(
    () => filterTopics(safeContent, searchQuery),
    [safeContent, searchQuery],
  );

  const selectedTopic = useMemo(
    () => safeContent.find((t) => t.id === selectedTopicId) || null,
    [safeContent, selectedTopicId],
  );

  return (
    <Layout style={{ minHeight: "600px", background: "#fff" }}>
      <Sider
        width={250}
        style={{ background: "#fafafa", padding: "16px 0", borderRight: "1px solid #f0f0f0" }}
        theme="light"
      >
        <div style={{ padding: "0 16px 16px 16px" }}>
          <Search
            placeholder="Search docs..."
            onChange={(e) => setSearchQuery(e.target.value)}
            value={searchQuery}
            allowClear
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedTopicId]}
          style={{ borderRight: 0, background: "transparent" }}
          items={filteredTopics.map((topic) => ({
            key: topic.id,
            label: topic.title,
            onClick: () => setSelectedTopicId(topic.id),
          }))}
        />
      </Sider>
      <Layout style={{ padding: "0 24px 24px" }}>
        <Content
          style={{
            padding: 24,
            margin: 0,
            background: "#fff",
            minHeight: 280,
          }}
        >
          {selectedTopic ? (
            <Typography>
              <Title level={2}>{selectedTopic.title}</Title>
              <Paragraph style={{ whiteSpace: "pre-wrap" }}>
                {selectedTopic.content}
              </Paragraph>
            </Typography>
          ) : (
            <Typography>
              <Title level={4}>No topic selected or found.</Title>
            </Typography>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};
