---
title: "Connect Claude to CRO Toolbox"
description: "Let Claude build sections and offers for your store as drafts you publish yourself: how to connect, what it can and cannot do, and how to disconnect."
order: 11
---

## What it does

Connect Claude (claude.ai or Claude Desktop) to CRO Toolbox and ask in plain words: "Make a size guide for my t-shirts" or "Create a 10% upsell on my best seller". Claude uses the same settings and the same plan limits as the app. **Everything it builds is a draft.** You see it in the theme editor and publish it in the app, unless you chose to allow publishing.

It can see your offers, designs, products and collections. It never sees orders, customers or emails. If it cannot do what you ask, it tells you, and you can do it in the app.

## Connect (Starter plan and up)

1. In the app open **Settings, Connect an AI assistant** and copy the address.
2. In Claude open **Settings, Connectors, Add custom connector**, paste the address and connect.
3. Claude opens a page with a **connection code** (no store address to type). In your Shopify admin open CRO Toolbox, **Settings, Connect an AI assistant**, enter the code under **Finish connecting** and press Continue. Choose **Read only** or **Read and build**. Tick **Allow publishing** only if you want Claude to make drafts live.

Developer tools such as Claude Code can use a **personal access token** made on the same page. It is shown once.

## Control

- **Disconnect** any connection on the same page; it stops working at once.
- The page lists the last 100 things assistants did, and the limits (60 calls a minute, 20 changes a minute, 200 changes a day).
- Uninstalling the app removes every connection.
