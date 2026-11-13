# Discord channel

The desk posts to a channel incoming webhook. It does not run a Discord bot and it does not send direct messages.

1. In Discord, open the channel that should receive alerts.
2. Channel settings, Integrations, Webhooks, New Webhook.
3. Name it `SSA Desk` if you want the channel list to match the payload username.
4. Copy the webhook URL into the hosted agent's environment as `DISCORD_WEBHOOK_URL`.

Do not commit that URL. A missing `DISCORD_WEBHOOK_URL` skips the HTTP post and still stores the embed JSON under the agent state directory `alerts/` so a local run and the fixture evals can inspect it.

Each accepted long is a green embed. Each accepted short is a red embed. The username is `SSA Desk`. A close is a second message on the same channel with the start date, end date, entry close, exit close, close reason, and price return. Posts are spaced about one second apart so a batch stays inside Discord's webhook limit.

The ledger, not the webhook, stops a second open alert for the same ticker and side.
