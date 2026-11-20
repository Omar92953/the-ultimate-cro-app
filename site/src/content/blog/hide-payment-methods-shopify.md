---
title: "How to hide payment methods on Shopify, like Cash on Delivery"
description: "How to hide, rename or reorder payment methods at Shopify checkout by order total, country, products or customer, for example no Cash on Delivery on big orders."
date: 2026-11-20
category: "Cart & checkout"
cover: "features/payment-rules"
coverAlt: "Shopify checkout on a demo store with a payment method hidden by a rule"
feature: "payment_rules"
---

To hide a payment method on Shopify for some orders, you need an app with payment rules: Shopify's own settings only switch a method on or off for every order. A payment rule hides, renames or moves a method at checkout when the order meets your conditions, such as Cash on Delivery hidden above a set order total or for first orders. CRO Toolbox has payment rules on every plan, including Free. Below is when hiding a method makes sense, the rules most stores use, and how to set one up.

## Why would I hide a payment method for some orders?

- **Cash on Delivery risk.** A big order paid in cash at the door is the one most likely to be refused, and you pay shipping both ways. Hiding Cash on Delivery above an amount keeps it for small orders only.
- **First orders.** A new shopper has no history with you. Some stores keep Cash on Delivery for returning customers only.
- **Countries.** A method may only work in some countries, or cost you more abroad.
- **Products.** Made to order or personalised products can't be resold if refused, so you may want them paid upfront.
- **Fees.** You can move the method with the lowest fees to the top of the list, so more shoppers pick it.

## Can Shopify hide payment methods without an app?

Not by condition. In **Settings → Payments** you can turn a method on or off, and that applies to every order. To show a method for some orders and hide it for others, Shopify uses payment customizations, which come from apps. Once a rule is saved in an app, Shopify applies it at checkout on its own.

## Which payment rules do most stores use?

1. **Hide Cash on Delivery above an order total**, for example above $150.
2. **Hide Cash on Delivery for first orders** or for guests who are not logged in.
3. **Hide a method when shipping to some countries.**
4. **Hide a method when the cart has certain products**, such as custom orders.
5. **Rename a method** so it explains itself, for example "Bank transfer (ships after payment arrives)".
6. **Move a method to the top** so the one you prefer is seen first.

Start with one rule, check a few orders, then add the next. Tell shoppers why where it helps, for example a line on your shipping page saying Cash on Delivery is available up to a set amount.

## How do I hide a payment method with CRO Toolbox?

1. Open **Cart & Checkout → Payment rules** in the app.
2. Click to add a rule. Under the method name, type the name as shoppers see it at checkout, for example Cash on Delivery or Bank transfer. The rule picks every method whose name contains that text.
3. Under **Do this**, pick **Hide it**, **Rename it** (and type the new name) or **Move it** (and pick the new position, 1 is first).
4. Switch on **Only under certain conditions** and set any of these: order total at least, order total at most, shipping to countries, the shopper (any shopper, guests, first order, or returning customers), or cart has any of these products. The rule acts when every condition you set is met.
5. Save and switch the rules on. Rules run from top to bottom, and you can move them up or down.
6. Place a test order that meets the conditions and one that doesn't, and check what checkout shows.

The same screen has delivery rules for shipping options and order limits for minimum or maximum orders. Details: [checkout rules help guide](/help/checkout/).

## How does CRO Toolbox help?

CRO Toolbox is your whole sales toolkit in one Shopify app: bundles, upsells and cross sells, store sections, loyalty and rewards, tracking and returns. Payment rules, delivery rules and order limits count together as checkout rules:

- **Free**: 3 checkout rules switched on at once.
- **Starter**, $5.99 a month: 6 checkout rules, plus every offer, bundle and storefront tool.
- **Growth**, $19.99 a month: unlimited checkout rules, plus offer results, Track and Returns pages and loyalty.

Paid plans have a 14 day free trial. See the [payment rules feature](/features/payment-rules/), the [hide payment methods page](/shopify-hide-payment-methods/) and [pricing](/pricing/). CRO Toolbox is launching soon on the Shopify App Store.

## Quick checklist

- The method's name exactly as shoppers see it at checkout
- One clear reason for each rule: risk, country, product or fees
- An order total limit for Cash on Delivery that fits your average order
- First orders and guests handled the way you want
- Rules in the right order, top to bottom
- A line on your shipping or FAQ page if a method is limited
- Two test orders: one that meets the conditions and one that doesn't
