import gzip, json
from collections import Counter

path = '/home/hatch/workspace/makefun/new3/lanes-20261124/pumpfun/u-jackxyz72-pump-fun-replay-sprint-paper-bot-0b809122-kit/u-jackxyz72-pump-fun-replay-sprint-paper-bot-0b809122-kit/dataset/events/part-00000.ndjson.gz'
data = gzip.open(path).read().decode()
lines = [l for l in data.split('\n') if l.strip()]
events = [json.loads(l) for l in lines]
print('total events', len(events))
c = Counter(e['event'] for e in events)
print('event types', dict(c))
mints = set(e['mint'] for e in events)
print('distinct mints', len(mints))
slots = sorted(set(e['slot'] for e in events))
print('slots', len(slots), 'min', slots[0], 'max', slots[-1])
tc = Counter(e['mint'] for e in events if e['event']=='TradeEvent')
print('mints with trades', len(tc))
print('top trade counts', tc.most_common(10))
cre = [e for e in events if e['event']=='CreateEvent']
print('creates', len(cre))
com = [e for e in events if e['event']=='CompleteEvent']
print('complete', len(com))
rq = [int(e.get('real_quote_reserves',0)) for e in events if e['event']=='TradeEvent']
print('real_quote min/med/max', min(rq), sorted(rq)[len(rq)//2], max(rq))
rt = [int(e.get('real_token_reserves',0)) for e in events if e['event']=='TradeEvent']
print('real_token min/med/max', min(rt), sorted(rt)[len(rt)//2], max(rt))
# check part-00001 and part-00002 too
import os
kit = '/home/hatch/workspace/makefun/new3/lanes-20261124/pumpfun/u-jackxyz72-pump-fun-replay-sprint-paper-bot-0b809122-kit/u-jackxyz72-pump-fun-replay-sprint-paper-bot-0b809122-kit'
for i in range(3):
    p = f'{kit}/dataset/events/part-{i:05d}.ndjson.gz'
    if not os.path.exists(p): continue
    d = gzip.open(p).read().decode()
    ls = [l for l in d.split('\n') if l.strip()]
    evs = [json.loads(l) for l in ls]
    print(f'part-{i:05d}: {len(evs)} events, mints={len(set(e["mint"] for e in evs))}')