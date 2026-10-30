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
class Attention(torch.nn.Module):
    def __init__(self,position):
        super().__init__();self.query=torch.nn.Parameter(torch.zeros(4));self.head=torch.nn.Linear(1,1);self.position=position
    def forward(self,x):
        pos=torch.eye(3).expand(x.shape[0],-1,-1) if self.position else torch.zeros(x.shape[0],3,3)
        keys=torch.cat([x[:,:,None],pos],-1)
        weight=torch.softmax((keys*self.query).sum(-1)/2,-1)
        return self.head((weight*x).sum(-1,keepdim=True)).squeeze(1)
def data(n,seed):
    x=2*torch.rand(n,3,generator=torch.Generator().manual_seed(seed))-1
    return x,(x[:,0]>0).float()
runs=[]
for seed in [1,7,17]:
    x,y=data(512,1000+seed);vx,vy=data(128,2000+seed);tx,ty=data(256,3000+seed)
    torch.manual_seed(seed);initial=Attention(True).state_dict();conditions=[]
    for position in [False,True]:
        model=Attention(position);model.load_state_dict(initial);opt=torch.optim.Adam(model.parameters(),lr=.05)
        best=float('inf');snapshot=None;history=[]
        for step in range(180):
            opt.zero_grad();loss=torch.nn.functional.binary_cross_entropy_with_logits(model(x),y);loss.backward();opt.step()
            with torch.no_grad():valid=torch.nn.functional.binary_cross_entropy_with_logits(model(vx),vy).item()
            history.append({'step':step+1,'trainLoss':loss.item(),'validationLoss':valid})
            if valid<best:best=valid;snapshot={k:v.detach().clone() for k,v in model.state_dict().items()}
        model.load_state_dict(snapshot)
        with torch.no_grad():prob=model(tx).sigmoid();pred=(prob>=.5).float()
        errors=[{'index':i,'input':tx[i].tolist(),'label':int(ty[i]),'probability':float(prob[i])} for i in range(len(ty)) if pred[i]!=ty[i]][:10]
        # Without positions the pooling is invariant to any permutation.
        if not position:
            with torch.no_grad():assert torch.allclose(model(tx),model(tx[:,[2,0,1]]),atol=1e-6)
        conditions.append({'position':position,'parameterCount':sum(p.numel() for p in model.parameters()),'accuracy':(pred==ty).float().mean().item(),'errors':errors,'history':history,'bestValidationLoss':best})
    assert conditions[0]['parameterCount']==conditions[1]['parameterCount']==6
    runs.append({'seed':seed,'conditions':conditions})
finish({'project':'p05-attention-position','protocol':{'task':'three independent U[-1,1] tokens; predict sign of token 0','causality':'classification of complete observed sequence, not next-token generation','seeds':[1,7,17],'train':512,'validation':128,'test':256,'steps':180,'optimizer':'Adam lr=.05','selection':'lowest validation loss','ablation':'fixed one-hot position keys versus zero position keys; same six parameters, initial weights, data and budget','baseline':'permutation-invariant attention pooling without positions'},'runs':runs})
