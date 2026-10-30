"""Three isolated training faults; deterministic CPU checks, not a benchmark."""
import argparse,json,platform
from pathlib import Path
import torch

def run(out):
 torch.set_num_threads(1);results=[]
 # Fault 1: second independent forward accumulates stale gradients.
 w=torch.tensor(2.,requires_grad=True)
 (w*3).square().backward();first=w.grad.item()
 (w*3).square().backward();stale=w.grad.item()
 w.grad=None;(w*3).square().backward();fixed=w.grad.item()
 assert (first,stale,fixed)==(36.,72.,36.)
 results.append({'fault':'stale-gradients','before':stale,'after':fixed,'expected':36.,'explanation':'A new forward does not clear leaf .grad.'})
 # Fault 2: silent sample cross-product through broadcasting.
 pred=torch.tensor([[1.],[2.],[3.]]);y=torch.tensor([1.,2.,3.])
 bad=((pred-y)**2).mean().item();good=((pred-y.reshape_as(pred))**2).mean().item()
 assert abs(bad-4/3)<1e-6 and good==0.
 results.append({'fault':'broadcast-loss','before':bad,'after':good,'expected':0.,'explanation':'Align labels to (N,1) before subtraction.'})
 # Fault 3: sample identities overlap; repair the split, not the metric.
 train=[0,1,2];bad_valid=[2,3];good_valid=[3,4]
 overlap=sorted(set(train)&set(bad_valid));clean=sorted(set(train)&set(good_valid))
 assert overlap==[2] and clean==[]
 results.append({'fault':'split-leakage','before':overlap,'after':clean,'expected':[],'explanation':'Repeated sample identity crosses the validation boundary.'})
 out.mkdir(parents=True,exist_ok=True)
 report={'environment':{'torch':torch.__version__,'python':platform.python_version(),'device':'cpu'},'checks':results,'ok':True}
 (out/'results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print('PASS three isolated faults');return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=Path('results'));run(p.parse_args().out)
