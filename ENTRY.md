# Pump.fun Replay Sprint — Paper Bot

A trading bot that trades 10 SOL of paper money on a replay of pump.fun chain
data. It looks at each slot's batch of `CreateEvent` / `TradeEvent` /
`CompleteEvent` events and returns the `orders` (buy/sell) to send. Orders
decided on slot s fill at slot s + 2.

## Strategy

The bot runs two simple ideas side by side, both seeded purely from
`state.hello.seed` (never from the clock, the environment, or `Math.random`):

1. **Early momentum entries.** When a new curve appears (or is seen for the
   first time) the bot looks at the trades already on it: how many, and in
   which direction. If there is real buy pressure (buy trades dominate, at
   least one trade, real quote reserves above a floor) it takes a small
   starter position, sized by `state.maxBuyLamports(mint)` so the per-mint
   size cap is never breached.
2. **Momentum follow-through / take-profit.** A held position is sold once it
   is clearly in profit (unrealised gain above `profitBps`) or cut once it is
   clearly in loss (below `stopBps`). Positions that neither move nor migrate
   are closed out by the harness itself at the end of the window (`_flatten_`
   fills), so the bot never marries a coin.

### Risk limits

- Never more than `hello.caps.max_open_positions` positions; every buy is
  capped by `state.maxBuyLamports(mint)` (the 100 bps-of-real-reserve cap).
- Slippage `max_slippage_bps` is kept moderate so a fill through the 2-slot
  latency is not rejected as `max_slippage` while still protecting against
  buying a top blindly.
- A cash buffer is left for the per-order tx fee (`base + priority`) so a
  burst of orders never ends in `insufficient_cash`.
- The 20-coin / 0.01 SOL round-trip breadth guardrail is met by spreading
  small starters across many distinct mints rather than concentrating.

### Why it should generalize

Everything the bot keys on — trade direction, reserve levels, held PnL — is a
structural property of a pump.fun curve, not a property of the specific dev
window's coins. The thresholds are expressed in bps and lamport floors taken
from `hello.fees` / `hello.caps`, so the same code behaves sensibly on the
fresh 24h final window.

## Run it

```sh
node main.ts
```