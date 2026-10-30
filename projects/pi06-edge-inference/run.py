import json
import statistics
import sys
import time
import tracemalloc
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pi-common'))
from runtime import execute,input_record
from model_format import load_model,predict,digest
import numpy as np
def options(p):p.add_argument('--model',type=Path,required=True);p.add_argument('--repeats',type=int,default=101)
def percentile(values,p):
    values=sorted(values);x=(len(values)-1)*p;lo=int(x);hi=min(lo+1,len(values)-1);return values[lo]+(values[hi]-values[lo])*(x-lo)
def task(run,args):
    if not 5<=args.repeats<=10000:raise ValueError('repeats must be 5..10000')
    run.result['inputManifest']=[input_record(args.model)]
    run.result['environment']['numpy']=np.__version__
    tracemalloc.start();start=time.perf_counter_ns();p=load_model(args.model);x=np.asarray(p['testInput'],dtype=np.float32);actual=predict(p,x);cold=time.perf_counter_ns()-start
    expected=np.asarray(p['referencePrediction'],dtype=np.float32)
    run.check('PyTorch/NumPy prediction equality',np.allclose(actual,expected,atol=p['atol'],rtol=p['rtol']))
    single=np.array([predict(p,row[None,:])[0] for row in x]);run.check('single/batch equality',np.allclose(single,actual,atol=p['atol'],rtol=p['rtol']))
    run.result['config'].update({'modelDigest':digest(p),'preprocessingDigest':digest({'mean':p['mean'],'scale':p['scale'],'fitSplit':p['fitSplit'],'featureOrder':p['featureOrder']}),'testInputDigest':digest(p['testInput']),'atol':p['atol'],'rtol':p['rtol'],'repeats':args.repeats,'timing':'warm forward only; load and first forward reported separately','coldDefinition':'JSON read/validation/arrays/first prediction, excludes interpreter and NumPy import'})
    timings=[]
    for mode,input in [('single',x[:1]),('batch-8',x)]:
        predict(p,input)
        values=[]
        for i in range(args.repeats):
            if i%10==0:run.guard()
            begin=time.perf_counter_ns();prediction=predict(p,input);elapsed=time.perf_counter_ns()-begin;values.append(elapsed)
            timings.append({'mode':mode,'repeat':i,'elapsedNs':elapsed,'checksum':float(prediction.sum())})
        run.measure(mode+' latency summary','ns',[{'mode':mode,'p50':statistics.median(values),'p95':percentile(values,.95),'repeats':len(values)}],'groups')
    current,peak=tracemalloc.get_traced_memory();tracemalloc.stop()
    run.measure('inference raw latency','ns',timings)
    run.measure('prediction comparison','value',[{'index':i,'reference':float(e),'actual':float(a),'absoluteError':float(abs(e-a))} for i,(e,a) in enumerate(zip(expected,actual))])
    run.measure('cold load plus first prediction','ns',[{'elapsedNs':cold}])
    run.measure('Python traced allocations','bytes',[{'current':current,'peak':peak,'definition':'tracemalloc only, excludes full NumPy native buffers and process RSS'}])
execute('pi06-edge-inference',task,options)
