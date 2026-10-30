import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pi-common'))
from runtime import execute
def options(p): p.add_argument('--rounds',type=int,default=3)
def task(run,args):
    if not 1<=args.rounds<=1000: raise ValueError('rounds must be 1..1000')
    run.result['config'].update({'rounds':args.rounds,'memoryOrder':'sequentially consistent','eventOrder':'actual serialized operation order; not wall clock'})
    binary=run.compile('concurrency',['-pthread'])
    observed=json.loads(run.command([binary,args.rounds]));run.result['events']=observed.pop('events')
    run.measure('serialized atomic event log','counter value',run.result['events'],'events')
    run.check('controlled load/store loses exactly one per round',observed['separateLoadStore']==args.rounds)
    run.check('RMW exact',observed['rmw']==2*args.rounds);run.check('mutex exact',observed['mutex']==2*args.rounds)
    for r in range(args.rounds):
        events=[e for e in run.result['events'] if e['round']==r]
        run.check('read/read/store/store round '+str(r),[e['phase'] for e in events]==['load','load','store','store'] and [e['value'] for e in events]==[r,r,r+1,r+1])
    run.measure('counter comparison','count',[observed])
execute('pi03-concurrency',task,options)
