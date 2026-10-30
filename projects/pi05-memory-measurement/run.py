import json
import random
import statistics
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pi-common'))
from runtime import execute,available_memory
def options(p):
    p.add_argument('--max-mib',type=int,default=8);p.add_argument('--accesses',type=int,default=262144);p.add_argument('--repeats',type=int,default=5);p.add_argument('--seed',type=int,default=17)
def percentile(values,p):
    values=sorted(values);x=(len(values)-1)*p;lo=int(x);hi=min(lo+1,len(values)-1);return values[lo]+(values[hi]-values[lo])*(x-lo)
def task(run,args):
    if not 1<=args.max_mib<=128 or not 1024<=args.accesses<=16777216 or not 5<=args.repeats<=20 or not 1<=args.seed<=2147483647: raise ValueError('invalid measurement bounds')
    available=available_memory();cap=min(args.max_mib*1024**2,128*1024**2,int(available*.25) if available else 4*1024**2)
    sizes=[s for s in (4096,16384,65536,262144,1048576,4194304,8388608,16777216,33554432,67108864,134217728) if s<=cap]
    if not sizes:raise RuntimeError('insufficient available memory for smallest buffer')
    binary=run.compile('memory');order=[(size,mode,repeat) for size in sizes for mode in (0,1) for repeat in range(args.repeats)];random.Random(args.seed).shuffle(order)
    run.result['config'].update({'bufferCapBytes':cap,'availableBytesAtStart':available,'seed':args.seed,'accessesPerSample':args.accesses,'repeatsRequested':args.repeats,'warmup':'one identical scan before timing; intentionally warm process, not claimed cold cache','testOrder':[list(x) for x in order]})
    samples=[]
    try:
        for size,mode,repeat in order:
            run.guard();sample=json.loads(run.command([binary,size,args.accesses,mode,args.seed]));sample['repeat']=repeat;sample['status']='valid';samples.append(sample)
            run.check('checksum '+str((size,mode,repeat)),sample['checksum']==sample['expectedChecksum'] and sample['accesses']==args.accesses)
    finally:
        run.measure('memory samples','ns/access',samples)
        summaries=[]
        for size in sizes:
            for mode in ('sequential','dependent-random'):
                values=[v['nsPerAccess'] for v in samples if v['bytes']==size and v['mode']==mode]
                if values:summaries.append({'bytes':size,'mode':mode,'repeats':len(values),'median':statistics.median(values),'q25':percentile(values,.25),'q75':percentile(values,.75),'iqr':percentile(values,.75)-percentile(values,.25),'status':'valid' if len(values)>=5 else 'insufficient-repeats'})
        run.measure('memory median and IQR','ns/access',summaries,'groups')
    run.check('at least five valid repeats per configuration',all(s['repeats']>=5 for s in summaries))
    run.result['missing'].append({'metric':'perf counters','status':'skipped','reason':'optional enhancement not collected; ns/access alone does not identify cache capacity'})
execute('pi05-memory-measurement',task,options)
