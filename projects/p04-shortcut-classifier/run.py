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
def data(n,seed,condition):
    g=torch.Generator().manual_seed(seed)
    y=torch.randint(0,2,(n,),generator=g).float()
    noise=torch.randn(n,8,8,generator=g)*0.12
    shape=torch.zeros(n,8,8)
    shape[y==0,2:6,3:5]=0.8;shape[y==1,3:5,2:6]=0.8
    # Same base samples/noise in all paired evaluations; only background changes.
    bg=(2*y-1)*0.65
    if condition=='flipped':bg=-bg
    if condition=='neutral':bg=bg*0
    return (shape+noise+bg[:,None,None]).flatten(1),y
runs=[]
for seed in [1,7,17]:
    torch.manual_seed(seed);model=torch.nn.Linear(64,1);opt=torch.optim.SGD(model.parameters(),lr=0.08)
    x,y=data(256,1000+seed,'correlated');vx,vy=data(128,2000+seed,'correlated')
    best=float('inf');snapshot=None;history=[]
    for step in range(80):
        opt.zero_grad();loss=torch.nn.functional.binary_cross_entropy_with_logits(model(x).squeeze(1),y);loss.backward();opt.step()
        with torch.no_grad():valid=torch.nn.functional.binary_cross_entropy_with_logits(model(vx).squeeze(1),vy).item()
        history.append({'step':step+1,'trainLoss':loss.item(),'validationLoss':valid})
        if valid<best:best=valid;snapshot={k:v.detach().clone() for k,v in model.state_dict().items()}
    model.load_state_dict(snapshot);metrics={};examples=[]
    for cond in ['correlated','flipped','neutral']:
        tx,ty=data(256,3000+seed,cond)
        with torch.no_grad():prob=model(tx).squeeze(1).sigmoid();prediction=(prob>=.5).float()
        metrics[cond]=(prediction==ty).float().mean().item()
        examples.extend([{'condition':cond,'index':i,'label':int(ty[i]),'probability':float(prob[i]),'prediction':int(prediction[i])} for i in range(8)])
    assert all(0<=a<=1 for a in metrics.values())
    runs.append({'seed':seed,'accuracy':metrics,'history':history,'pairedExamples':examples,'bestValidationLoss':best})
finish({'project':'p04-shortcut-classifier','protocol':{'task':'8x8 bars: vertical=0 horizontal=1','train':256,'validation':128,'testPaired':256,'steps':80,'optimizer':'SGD lr=.08','selection':'lowest validation loss under correlated background','changedVariable':'background only at test','seeds':[1,7,17],'baseline':'same model, same paired test samples, correlated background','paperSupport':'Geirhos et al. section 3 / figure 2 and section 6.2; concept-inspired original synthetic task, not replication'},'runs':runs})
