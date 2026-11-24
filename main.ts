// Original momentum strategy for Pump.fun replay sprint.
// Deterministic: reads no clock, env, or Math.random; randomness only from state.hello.seed.
import { runBot, LAMPORTS_PER_SOL, BPS, type BuyInput, type SellInput, type BotState, type OrderInput } from './vendor/makefun-bot.ts';

const DEFAULT_STAKE = 300_000_000n; // 0.30 SOL per starter buy
const MIN_STAKE = 10_000_000n; // 0.01 SOL floor
const MIN_REAL_QUOTE = 2_000_000n; // 0.002 SOL — enter as early as possible
const PROFIT_BPS = 2500n; // +25% unrealised take-profit
const STOP_BPS = -400n; // -4% stop loss
const MAX_HOLD_SLOTS = 100; // hold longer to catch pumps
const BUY_SLIPPAGE_BPS = 3000;
const SELL_SLIPPAGE_BPS = 3000;
const MAX_OPEN = 5;

// Track entry slots since Holding has no opened_slot field; also track entered mints (one entry per coin)
const entrySlots = new Map<string, number>();
const entered = new Set<string>();
const pendingSells = new Set<string>();

function onHello(state: BotState): void {
  // nothing extra
}

function onBatch(state: BotState, batch: any): OrderInput[] | undefined {
  const orders: OrderInput[] = [];
  const slot = state.slot;
  const curves = state.curves;
  const positions = state.positions;
  const pending = state.pending;

  // exits first
  for (const [mint, pos] of positions) {
    const c = curves.get(mint);
    if (!c || pos.token_amount === 0n) continue;
    if (pendingSells.has(mint)) continue; // a sell is already in flight for this mint
    const tokens = pos.token_amount;
    const cost = pos.cost_lamports;
    const markPrice = Number(c.virtual_quote_reserves) / Number(c.virtual_token_reserves);
    const entryPrice = cost > 0n && tokens > 0n ? Number(cost) / Number(tokens) : 0;
    const pnlBps = entryPrice > 0 ? Math.round((markPrice - entryPrice) / entryPrice * 10000) : 0;
    const opened = entrySlots.get(mint) ?? slot;
    const heldSlots = slot - opened;
    if (pnlBps >= Number(PROFIT_BPS) || pnlBps <= Number(STOP_BPS) || heldSlots >= MAX_HOLD_SLOTS) {
      orders.push({
        client_id: `sell-${mint}-${slot}`,
        mint,
        side: 'sell',
        token_amount: tokens.toString(),
        max_slippage_bps: SELL_SLIPPAGE_BPS,
      });
      pendingSells.add(mint);
      entrySlots.delete(mint);
    }
  }

  // entries: only on the FIRST trade of a fresh coin (trades == 1)
  const candidates: { mint: string; curve: any }[] = [];
  for (const [mint, c] of curves) {
    if (positions.has(mint) || entered.has(mint)) continue;
    if (c.complete) continue;
    if (c.trades < 1) continue; // need at least one trade to have real reserves
    if (c.real_quote_reserves < MIN_REAL_QUOTE) continue;
    // enter on any fresh curve (one entry per coin via `entered` set)
    let hasPending = false;
    for (const po of pending.values()) {
      if (po.order.mint === mint && po.order.side === 'buy') { hasPending = true; break; }
    }
    if (hasPending) continue;
    candidates.push({ mint, curve: c });
  }

  const openCount = positions.size + [...pending.values()].filter((p: any) => p.order.side === 'buy').length;
  let buyCount = 0;
  for (const cand of candidates) {
    if (openCount + buyCount >= MAX_OPEN) break;
    const cap = state.maxBuyLamports(cand.mint);
    let stake = DEFAULT_STAKE;
    if (cap < stake) stake = cap;
    if (stake < MIN_STAKE) continue;
    orders.push({
      client_id: `buy-${cand.mint}-${slot}`,
      mint: cand.mint,
      side: 'buy',
      quote_lamports: stake.toString(),
      max_slippage_bps: BUY_SLIPPAGE_BPS,
    });
    entered.add(cand.mint);
    entrySlots.set(cand.mint, slot);
    buyCount++;
  }

  return orders.length === 0 ? undefined : orders;
}

function onDone(state: BotState): void {
  // flatten handled by harness
}

export { onHello, onBatch, onDone };

if (import.meta.main) {
  // @ts-ignore
  await runBot({ onHello, onBatch, onDone });
}