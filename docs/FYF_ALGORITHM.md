# Feed Your Field (FYF) Algorithm Overview

The FYF feed aims to provide a personalized, adaptive, and balanced content experience for users.

## Core Principles

1.  **Implicit Hybridization**: Instead of explicitly separating "Trending" and "Latest" feeds, the system uses a scoring function to blend these signals dynamically.
2.  **Adaptive Ranking**: The ranking mechanism adapts to the amount of available content in a field, avoiding arbitrary fixed constraints where possible.
3.  **Engagement + Recency**: Content is ranked based on a combination of engagement (likes, comments, shares, impressions) and recency (time-based decay/boost).

## Scoring Mechanism (`calculateScore`)

The `calculateScore` function in `feed.controller.js` uses the following formula:

`score = fieldBoost + engagementScore + timeBoost`

- **fieldBoost**: Higher weight given to content from fields the user has prioritized.
- **engagementScore**: Weighted sum of likes, comments, shares, and impressions.
- **timeBoost**: A dynamic boost for newer content (up to 50 hours).

This creates an unobtrusive, "smart" feed where highly engaging (trending) content rises to the top, but recent content also has a fair chance of being surfaced, creating a fresh, dynamic experience.

## Discovery and Top Posts

- **Top Posts by Field**: Aggregates engagement metrics (impressions, likes, comments) and returns the top 100 posts. If fewer than 100 posts exist, it naturally returns all available posts, handling the "not enough content" case gracefully.
- **Discovery Feed**: Uses a field-level weighted seeding model. It fetches top posts from each field, applies a hidden "seed weight" based on the field type, and then merges them to ensure a diverse, high-quality discovery experience.
