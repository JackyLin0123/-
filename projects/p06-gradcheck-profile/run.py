from pathlib import Path
import argparse,json,time,platform,hashlib,os
import torch
parser=argparse.ArgumentParser();parser.add_argument('--out',default='results');args=parser.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
torch.set_num_threads(1)
started=time.perf_counter()
def finish(payload):
    import ctypes
    from ctypes import wintypes
    peak=None
    if os.name=='nt':
        class Counters(ctypes.Structure):
            _fields_=[('cb',wintypes.DWORD),('faults',wintypes.DWORD)]+[(n,ctypes.c_size_t) for n in ['peakWorkingSet','workingSet','peakPaged','paged','peakNonPaged','nonPaged','pagefile','peakPagefile']]
        c=Counters();c.cb=ctypes.sizeof(c)
        ctypes.windll.kernel32.GetCurrentProcess.restype=wintypes.HANDLE
        ctypes.windll.psapi.GetProcessMemoryInfo.argtypes=[wintypes.HANDLE,ctypes.c_void_p,wintypes.DWORD]
        assert ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(c),c.cb)
        peak=c.peakWorkingSet
    payload.update(environment={'python':platform.python_version(),'torch':torch.__version__,'device':'cpu','threads':1,'platform':platform.platform()},seconds=time.perf_counter()-started,peakProcessBytes=peak,sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (out/'results.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in payload.items() if k not in ['runs','events']},ensure_ascii=False))
from torch.profiler import profile,record_function,ProfilerActivity
class Cube(torch.autograd.Function):
    @staticmethod
    def forward(ctx,x):ctx.save_for_backward(x);return x**3
    @staticmethod
    def backward(ctx,g):
        x,=ctx.saved_tensors;return g*3*x*x
class WrongCube(Cube):
    @staticmethod
    def backward(ctx,g):
        x,=ctx.saved_tensors;return g*x*x
x=torch.tensor([.7,1.2],dtype=torch.double,requires_grad=True)
correct=torch.autograd.gradcheck(Cube.apply,(x,));wrong=torch.autograd.gradcheck(WrongCube.apply,(x,),raise_exception=False)
assert correct and not wrong
inputs=torch.linspace(-1,1,32,dtype=torch.double);labels=2*inputs+.1
def train(vectorized,profiled=False):
    w=torch.nn.Parameter(torch.tensor(.2,dtype=torch.double));opt=torch.optim.SGD([w],lr=.1);history=[]
    for step in range(12):
        with record_function('data') if profiled else __import__('contextlib').nullcontext():a,b=inputs,labels
        opt.zero_grad()
        with record_function('forward_loss') if profiled else __import__('contextlib').nullcontext():
            loss=((w*a-b)**2).mean() if vectorized else sum((w*a[i]-b[i])**2 for i in range(len(a)))/len(a)
        with record_function('backward') if profiled else __import__('contextlib').nullcontext():loss.backward()
        with record_function('optimizer_step') if profiled else __import__('contextlib').nullcontext():opt.step()
        history.append(loss.item())
    return w.detach(),torch.tensor(history,dtype=torch.double)
a,ha=train(False);b,hb=train(True)
assert torch.allclose(a,b,rtol=1e-12,atol=1e-12) and torch.allclose(ha,hb,rtol=1e-12,atol=1e-12)
# Warm up both paths; time without profiler; don't assert speed direction.
train(False);train(True);timings={}
for flag,name in [(False,'loop'),(True,'vectorized')]:
    timings[name]=[]
    for repeat in range(5):
        t=time.perf_counter();train(flag);timings[name].append(time.perf_counter()-t)
with profile(activities=[ProfilerActivity.CPU],record_shapes=True) as prof:train(True,True)
# Kineto on Windows may reject non-ASCII absolute paths. Python chdir
# handles Unicode; a relative ASCII filename avoids that backend limitation.
original_cwd=Path.cwd()
try:
    os.chdir(out.resolve())
    prof.export_chrome_trace('trace.json')
finally:
    os.chdir(original_cwd)
events=[{'key':e.key,'calls':e.count,'cpuTotalUs':e.cpu_time_total,'selfCpuUs':e.self_cpu_time_total} for e in prof.key_averages()]
assert all(any(e['key']==key for e in events) for key in ['data','forward_loss','backward','optimizer_step'])
finish({'project':'p06-gradcheck-profile','gradcheck':{'correct':correct,'wrong':wrong},'protocol':{'task':'12 scalar linear-regression SGD steps on fixed 32 samples','comparison':'Python scalar loop versus vectorized equivalent loss','dtype':'float64','warmup':'one complete run per path before five measurements','timingIncludes':'model and optimizer creation plus 12 training steps, without profiler','profile':'CPU only, separate run, record_shapes=True; nested events overlap'},'equivalent':True,'finalWeight':a.item(),'lossHistory':ha.tolist(),'unprofiledSeconds':timings,'traceSha256':hashlib.sha256((out/'trace.json').read_bytes()).hexdigest(),'events':events})
