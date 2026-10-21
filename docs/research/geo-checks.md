# GEO checks: do AI assistants name and describe CRO Toolbox?

Plan: `docs/plans/seo-geo.md` §6 and §9. Once a month, ask the same 10 questions and log the answers
here, newest run first. Keep the questions fixed so the runs can be compared; add a new question only
at the end, with the date it was added.

## How to run it (about 20 minutes)

1. Open each assistant **signed out or in a private window** (so past chats don't steer the answer):
   ChatGPT (chatgpt.com, search on), Perplexity (perplexity.ai), Google Gemini (gemini.google.com),
   Microsoft Copilot (copilot.microsoft.com), Claude (claude.ai, web search on).
2. Paste each question below exactly as written, one per new chat.
3. For each answer write down:
   - **Named**: is CRO Toolbox named? (yes / no)
   - **Correct**: if named, are the facts right? (plans and prices from `app/lib/plans.ts`, the shared
     line "CRO Toolbox is a Shopify app to increase average order value (AOV) and lifetime value (LTV).")
   - **Cited**: is a crotoolbox.com page or the App Store listing linked? Which one?
   - **Apps named instead**: the first three apps it recommends.
4. A cloud session can run the same questions through its web search tool (it is one search engine,
   not the assistants); log that as its own column, marked "web search".
5. When an answer is wrong about CRO Toolbox, note which page should have said it better and fix that
   page (answer first, a short fact, a table) in a `Website:` PR.

## The 10 questions

1. What is the best Shopify upsell app?
2. How do I add bundles to my Shopify store?
3. What is the best mix and match bundle app for Shopify?
4. How do I increase average order value on Shopify?
5. What is the best post purchase upsell app for Shopify?
6. Which Shopify app gives me an order tracking page?
7. Which Shopify returns and exchanges app offers store credit?
8. Is there a free Shopify app for quantity breaks?
9. What is CRO Toolbox for Shopify?
10. What is a good ReConvert alternative for Shopify?

## Runs

### Run 1: 2026-10-20 (cloud session, web search only)

The assistants themselves (ChatGPT, Perplexity, Gemini, Copilot, Claude) can't be opened from the
cloud session, so this run used its web search tool only. Omar: run the five assistants once with the
steps above and add their columns.

| # | Named | Cited | Apps or sources named first |
|---|---|---|---|
| 1 | no | no | ReConvert, Selleasy, Firepush (vendor roundups) |
| 2 | no | no | Shopify Community thread, Bundle Builder, Bold Bundles |
| 3 | no | no | Easy Bundle Builder, Bundly, Better Bundles |
| 4 | no | no | Generic guides (bundles, cross sells, free shipping goal, after purchase offer) |
| 5 | no | no | AfterSell, Kaching Post Purchase Upsell, ReConvert |
| 6 | no | no | Shopify's order status page, AfterShip, Tracktor, ParcelPanel |
| 7 | no | no | Exchangely, Loop, ReturnGO |
| 8 | no | no | WhyConvert, Pareto, Awesome Quantity Breaks |
| 9 | no | no | "No listing for CRO Toolbox found"; suggested CRO Navigator, a different app |
| 10 | no | no | AlternativeTo, LaunchTip roundup, UpsellPlus comparison page |

**Reading it.** CRO Toolbox is not named or cited for any question yet, and the search doesn't find
the brand by name (question 9). That fits a new domain with no links from other sites
(`docs/research/search-visibility.md`). The results are mostly vendor "best apps" roundups, Shopify
Community threads and App Store listings, so the things that should move this are:

- the App Store listing itself (live, with the shared line);
- the outreach drafts in `docs/outreach/` (Community answers, Reddit, guest posts, roundups);
- profiles on G2, Capterra, Crunchbase and the Partner directory with the same line;
- Bing indexing (ChatGPT search and Copilot use Bing): the steps in `docs/website.md`,
  "Search engines beyond Google".

Next run: around 2026-11-20.
